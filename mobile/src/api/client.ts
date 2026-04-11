import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * API base URL — set API_URL env var or edit this directly for your setup.
 *
 * Android emulator  → 10.0.2.2  (maps to host machine localhost)
 * iOS simulator     → localhost
 * Physical device   → your machine's LAN IP (e.g. 192.168.x.x)
 */
const DEV_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:3000/api/v1'
  : 'http://localhost:3000/api/v1';

export const BASE_URL: string = (process.env.API_URL as string) ?? DEV_URL;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
});

// Lazy ref — avoids circular dependency between authStore ↔ apiClient
let _onUnauthenticated: (() => void) | null = null;
export function setUnauthenticatedHandler(fn: () => void) {
  _onUnauthenticated = fn;
}

// Attach JWT to every request
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalise errors + handle 401
apiClient.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    if (err.response?.status === 401) {
      await AsyncStorage.multiRemove(['accessToken', 'tokenExpiry']);
      _onUnauthenticated?.();
    }

    const raw = (err.response?.data as any)?.message;
    const message =
      raw ??
      (err.code === 'ECONNABORTED' ? 'Request timed out' : null) ??
      (err.message === 'Network Error' ? 'No internet connection' : null) ??
      'Something went wrong';

    err.message = Array.isArray(message) ? message[0] : message;
    return Promise.reject(err);
  },
);
