import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * API base URL resolution (priority order):
 * 1. Android BuildConfig.API_BASE_URL  — injected at build time via -PAPI_BASE_URL=...
 * 2. process.env.API_URL               — Metro bundler env override
 * 3. Platform default                  — emulator localhost fallback for dev
 */
function resolveBaseUrl(): string {
  // BuildConfig is injected by Gradle for Android release builds
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BuildConfig } = require('react-native-build-config');
    if (BuildConfig?.API_BASE_URL && !BuildConfig.API_BASE_URL.includes('yourdomain')) {
      return BuildConfig.API_BASE_URL;
    }
  } catch {
    // react-native-build-config not installed — use fallback
  }

  if (process.env.API_URL) return process.env.API_URL;

  // Dev fallback: Android emulator uses 10.0.2.2, iOS simulator uses localhost
  // Physical device: use your machine's local IP
  return Platform.OS === 'android'
    ? 'http://192.168.1.227:3000/api/v1'
    : 'http://localhost:3000/api/v1';
}

export const BASE_URL = resolveBaseUrl();

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
});

// Lazy import to avoid circular dependency (authStore → apiClient → authStore)
let _onUnauthenticated: (() => void) | null = null;
export function setUnauthenticatedHandler(fn: () => void) {
  _onUnauthenticated = fn;
}

// ── Request: attach JWT ───────────────────────────────────────────────────────
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: handle 401, normalise errors ────────────────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    if (err.response?.status === 401) {
      await AsyncStorage.multiRemove(['accessToken', 'tokenExpiry']);
      // Trigger navigation to login via registered handler
      _onUnauthenticated?.();
    }

    // Normalise error message for UI consumption
    const message =
      (err.response?.data as any)?.message ??
      (err.code === 'ECONNABORTED' ? 'Request timed out' : null) ??
      (err.message === 'Network Error' ? 'No internet connection' : null) ??
      'Something went wrong';

    err.message = Array.isArray(message) ? message[0] : message;
    return Promise.reject(err);
  },
);
