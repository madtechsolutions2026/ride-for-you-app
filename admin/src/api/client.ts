import axios from 'axios';

const API_BASE = '';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('rfy_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (window.location.pathname.includes('/admin') && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('rfy_admin_token');
        localStorage.removeItem('rfy_admin_user');
      }
    }
    return Promise.reject(error);
  }
);

