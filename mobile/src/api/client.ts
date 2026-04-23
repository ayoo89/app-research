import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Set EXPO_PUBLIC_API_URL in mobile/.env to override.
 * Android emulator → http://10.0.2.2:3000/api/v1
 * iOS simulator    → http://localhost:3000/api/v1
 * Physical device  → http://<your-lan-ip>:3000/api/v1
 */
const DEV_URL = 'https://productsearch-api.onrender.com/api/v1';
export const BASE_URL: string = (process.env.EXPO_PUBLIC_API_URL as string) ?? DEV_URL;
export const IMAGE_BASE_URL: string = BASE_URL.replace('/api/v1', '');

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
});

let _onUnauthenticated: (() => void) | null = null;
export function setUnauthenticatedHandler(fn: () => void) {
  _onUnauthenticated = fn;
}

// ── Request: attach JWT ───────────────────────────────────────────
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken').catch(() => null);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: auto-refresh on 401, normalise errors ──────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function drainQueue(token: string | null) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

apiClient.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (err.response?.status === 401 && original && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) =>
          refreshQueue.push((token) => {
            if (!token) { reject(err); return; }
            original.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(original));
          }),
        );
      }

      original._retry = true;
      isRefreshing    = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken').catch(() => null);
        if (!refreshToken) throw new Error('no_refresh_token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        await AsyncStorage.multiSet([
          ['accessToken',  data.accessToken],
          ['refreshToken', data.refreshToken],
          ['tokenExpiry',  String(Date.now() + 2 * 60 * 60 * 1000)],
        ]).catch(() => {});

        drainQueue(data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(original);
      } catch {
        drainQueue(null);
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'tokenExpiry']).catch(() => {});
        _onUnauthenticated?.();
      } finally {
        isRefreshing = false;
      }
    }

    const raw = (err.response?.data as any)?.message;
    const message =
      raw ??
      (err.code === 'ECONNABORTED'     ? 'Request timed out'      : null) ??
      (err.message === 'Network Error' ? 'No internet connection'  : null) ??
      'Something went wrong';

    err.message = Array.isArray(message) ? message[0] : message;
    return Promise.reject(err);
  },
);
