/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect } from 'react';
import apiClient from '../api/apiClient';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [initialLoad, setInitialLoad] = useState(true);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Check local storage for token on mount
        const checkUserLoggedIn = async () => {
            const userInfo = localStorage.getItem('userInfo');
            if (!userInfo) {
                setInitialLoad(false);
                return;
            }

            try {
                const parsedUser = JSON.parse(userInfo);
                setUser(parsedUser);

                // Verify token when possible, but avoid forcing logout on transient/network failures.
                const { data } = await apiClient.get('/auth/profile');
                setUser({ ...data, token: parsedUser.token });
            } catch (error) {
                const statusCode = error?.response?.status;
                if (statusCode === 401 || statusCode === 403) {
                    console.error('Session expired. Logging out.');
                    logout();
                } else {
                    // Keep the cached session on non-auth failures (e.g. backend temporarily unavailable).
                    console.error('Profile verification skipped due to non-auth error:', error?.message || error);
                }
            } finally {
                setInitialLoad(false);
            }
        };

        checkUserLoggedIn();
    }, []);

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
                message: error.response && error.response.data.message
                    ? error.response.data.message
                    : error.message,
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

    const logout = () => {
        localStorage.removeItem('userInfo');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading }}>
            {!initialLoad && children}
        </AuthContext.Provider>
    );
};
