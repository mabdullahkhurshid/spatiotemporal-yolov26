import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from './tokenStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // Sends the httpOnly refresh cookie to /api/auth/*
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let refreshPromise = null;

/**
 * Get a new access token using the refresh cookie. Parallel callers share one request, because the
 * server rotates the refresh token on every refresh.
 */
export const refreshAccessToken = () => {
  refreshPromise =
    refreshPromise ||
    api
      .post('/auth/refresh', {})
      .then((response) => {
        setAccessToken(response.data.accessToken);
        return response.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  return refreshPromise;
};

const clearSession = () => {
  clearAccessToken();
  localStorage.removeItem('user');
};

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Credential endpoints return 401 for bad input; refreshing there would reload and hide the error.
    const isAuthEndpoint = /\/auth\/(login|register|verify-email|resend-verification|refresh|logout|forgotpassword|resetpassword|oauth)/.test(
      originalRequest?.url || ''
    );

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        const { accessToken } = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        clearSession();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
