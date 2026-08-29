import axios from 'axios';
import { Platform } from 'react-native';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokenStore';

// Live Render Cloud Backend:
const LIVE_BACKEND_URL = 'https://ride-for-you-app.onrender.com';
const LOCAL_BACKEND_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

// Use LIVE_BACKEND_URL for production APK & cloud access
const BASE_URL = LIVE_BACKEND_URL;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let sessionExpiredCallback: (() => void) | null = null;

export function setSessionExpiredListener(callback: () => void) {
  sessionExpiredCallback = callback;
}

apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response &&
      (error.response.status === 401 || error.response.status === 403) &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshTkn = await getRefreshToken();
        if (!refreshTkn) {
          throw new Error('No refresh token available');
        }

        const refreshResponse = await axios.post(`${BASE_URL}/auth/token/refresh`, {
          refreshToken: refreshTkn,
        });

        const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data;
        await setTokens(accessToken, newRefreshToken);

        isRefreshing = false;
        processQueue(null, accessToken);

        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);
        
        await clearTokens();
        if (sessionExpiredCallback) {
          sessionExpiredCallback();
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);
