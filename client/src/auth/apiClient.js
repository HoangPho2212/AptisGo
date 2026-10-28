import axios from 'axios';

import { ApiError } from './apiError.js';
import { emitUnauthorized } from './authEvents.js';
import { clearSession, getAccessToken } from './authStorage.js';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL || undefined,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

function getErrorMessage(error, status, payload) {
  if (typeof payload?.error === 'string' && payload.error.length > 0) {
    return payload.error;
  }

  if (error.code === 'ERR_NETWORK') {
    return 'Unable to reach the API. Check that the server is running.';
  }

  if (error.code === 'ECONNABORTED') {
    return 'The API request timed out. Please try again.';
  }

  return status ? `Request failed with status ${status}` : 'Request failed. Please try again.';
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const status = error.response?.status ?? 0;
    const payload = error.response?.data;

    if (status === 401) {
      clearSession();
      emitUnauthorized();
    }

    return Promise.reject(
      new ApiError(getErrorMessage(error, status, payload), {
        status,
        details: payload?.details,
      })
    );
  }
);
