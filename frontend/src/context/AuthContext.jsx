/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../api/apiClient';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [initialLoad, setInitialLoad] = useState(true);
    const [loading, setLoading] = useState(false);
    const hasCheckedSessionRef = useRef(false);
    const hasLoggedExpiryRef = useRef(false);

    const logout = useCallback(() => {
        localStorage.removeItem('userInfo');
        setUser(null);
    }, []);

    useEffect(() => {
        const handleAuthExpired = () => {
            if (!hasLoggedExpiryRef.current) {
                console.error('Session expired. Logging out.');
                hasLoggedExpiryRef.current = true;
            }
            logout();
        };

        window.addEventListener('auth:expired', handleAuthExpired);
        return () => window.removeEventListener('auth:expired', handleAuthExpired);
    }, [logout]);

    useEffect(() => {
        // React 18 StrictMode can run effects twice in development; prevent duplicate verification calls.
        if (hasCheckedSessionRef.current) return undefined;
        hasCheckedSessionRef.current = true;

        const abortController = new AbortController();

        // Check local storage for token on mount
        const checkUserLoggedIn = async () => {
            const userInfo = localStorage.getItem('userInfo');
            if (!userInfo) {
                setInitialLoad(false);
                return;
            }

            setLoading(true);

            try {
                const parsedUser = JSON.parse(userInfo);
                setUser(parsedUser);

                // Verify token when possible, but avoid forcing logout on transient/network failures.
                const { data } = await apiClient.get('/auth/profile', { signal: abortController.signal });
                setUser({ ...data, token: parsedUser.token });
            } catch (error) {
                if (error?.code === 'ERR_CANCELED') {
                    return;
                }

                const statusCode = error?.response?.status;
                if (statusCode === 401) {
                    if (!hasLoggedExpiryRef.current) {
                        console.error('Session expired. Logging out.');
                        hasLoggedExpiryRef.current = true;
                    }
                    logout();
                } else {
                    // Keep the cached session on non-auth failures (e.g. backend temporarily unavailable).
                    console.error('Profile verification skipped due to non-auth error:', error?.message || error);
                }
            } finally {
                setLoading(false);
                setInitialLoad(false);
            }
        };

        // Fire-and-forget with internal error handling.
        checkUserLoggedIn();
        return () => {
            // Best-effort cancel in-flight verification on unmount (prevents StrictMode dev double-mount noise).
            abortController.abort();
        };
    }, [logout]);

    const formatAuthErrorMessage = (error, { context } = {}) => {
        const status = error?.response?.status;
        const serverMessage = error?.response?.data?.message;
        const serverCode = error?.response?.data?.code;
        const isDev = Boolean(import.meta?.env?.DEV);

        if (!status) {
            return 'Network error. Please check your connection and try again.';
        }

        if (context === 'login' && status === 401) {
            if (serverCode === 'AUTH_USER_NOT_FOUND' || serverMessage === 'User not found') {
                return 'Account not found. Check your email/username.';
            }
            if (serverCode === 'AUTH_INVALID_PASSWORD' || serverMessage === 'Invalid password') {
                return 'Wrong password. Please try again.';
            }
            return 'Invalid email/username or password.';
        }

        if (typeof serverMessage === 'string' && serverMessage.trim()) {
            // Only surface unexpected detailed backend messages in development.
            if (isDev) return serverMessage;
            return 'Something went wrong. Please try again.';
        }

        return error?.message || 'Something went wrong. Please try again.';
    };

    const login = async (email, password) => {
        try {
            setLoading(true);
            const { data } = await apiClient.post('/auth/login', {
                email,
                password,
            });

            localStorage.setItem('userInfo', JSON.stringify(data));
            setUser(data);
            return { success: true };
        } catch (error) {
            console.error(error);
            return {
                success: false,
                message: formatAuthErrorMessage(error, { context: 'login' }),
            };
        } finally {
            setLoading(false);
        }
    };

    const register = async (name, email, password, role) => {
        try {
            setLoading(true);
            const { data } = await apiClient.post('/auth/register', {
                name,
                email,
                password,
                role,
            });

            if (data.requiresVerification) {
                return { success: true, requiresVerification: true, email: data.email };
            }

            localStorage.setItem('userInfo', JSON.stringify(data));
            setUser(data);
            return { success: true };
        } catch (error) {
            console.error(error);
            return {
                success: false,
                message: error.response && error.response.data.message
                    ? error.response.data.message
                    : error.message,
            };
        } finally {
            setLoading(false);
        }
    };

    const [unreadChatCount, setUnreadChatCount] = useState(0);

    const fetchUnreadChatCount = useCallback(async () => {
        if (!user) {
            setUnreadChatCount(0);
            return;
        }
        try {
            const { data } = await apiClient.get('/chat/conversations');
            const total = (data || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);
            setUnreadChatCount(total);
        } catch {
            // Silently ignore background unread check errors
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            setUnreadChatCount(0);
            return;
        }

        fetchUnreadChatCount();
        const interval = setInterval(fetchUnreadChatCount, 15000);
        return () => clearInterval(interval);
    }, [user, fetchUnreadChatCount]);

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading, unreadChatCount, fetchUnreadChatCount }}>
            {!initialLoad && children}
        </AuthContext.Provider>
    );
};
