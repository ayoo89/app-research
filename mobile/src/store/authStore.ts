import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, setUnauthenticatedHandler } from '../api/client';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  // Register 401 handler so any expired-token response resets auth state
  setUnauthenticatedHandler(() => {
    set({ user: null });
  });

  return {
    user: null,
    isLoading: true,

    login: async (email, password) => {
      const { data } = await apiClient.post('/auth/login', { email, password });
      await AsyncStorage.setItem('accessToken', data.accessToken);
      const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
      await AsyncStorage.setItem('tokenExpiry', String(expiry));
      set({ user: data.user });
    },

    logout: async () => {
      await AsyncStorage.multiRemove(['accessToken', 'tokenExpiry']);
      set({ user: null });
    },

    loadSession: async () => {
      try {
        const [token, expiryStr] = await AsyncStorage.multiGet(['accessToken', 'tokenExpiry']);
        const accessToken = token[1];
        const expiry      = Number(expiryStr[1] ?? 0);

        if (!accessToken || Date.now() > expiry) {
          await AsyncStorage.multiRemove(['accessToken', 'tokenExpiry']);
          set({ isLoading: false });
          return;
        }

        const { data } = await apiClient.get('/auth/me');
        set({ user: data, isLoading: false });
      } catch {
        await AsyncStorage.multiRemove(['accessToken', 'tokenExpiry']);
        set({ user: null, isLoading: false });
      }
    },
  };
});
