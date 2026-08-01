import axios from 'axios';

// Use a relative API base by default so it works in real deployments (behind Nginx/Ingress).
// Dev server / Nginx reverse proxy should forward `/api` to the backend.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

const AUTH_ERROR_DEBOUNCE_MS = 1000;
let lastAuthErrorAt = 0;

const notifyAuthExpired = (status) => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastAuthErrorAt < AUTH_ERROR_DEBOUNCE_MS) return;
  lastAuthErrorAt = now;

  try {
    window.dispatchEvent(new CustomEvent('auth:expired', { detail: { status } }));
  } catch {
    // Ignore event dispatch failures
  }
};

apiClient.interceptors.request.use((config) => {
  const storedUser = localStorage.getItem('userInfo');
  if (storedUser) {
    try {
      const { token } = JSON.parse(storedUser);
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // If parsing fails, fall back to unauthenticated calls
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';

    // Avoid treating login/register credential failures as "session expired".
    const isAuthAttempt = typeof url === 'string' && (url.includes('/auth/login') || url.includes('/auth/register'));

    if (!isAuthAttempt && status === 401) {
      try {
        localStorage.removeItem('userInfo');
      } catch {
        // Ignore storage failures
      }

      notifyAuthExpired(status);
    }

    return Promise.reject(error);
  },
);

export default apiClient;
export { API_BASE_URL };
