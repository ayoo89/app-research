import { create } from 'zustand';
import { apiClient, setUnauthenticatedHandler } from '../api/client';
import { updateProfile as apiUpdateProfile, UpdateProfileData } from '../api/auth';

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
  updateProfile: (data: UpdateProfileData) => Promise<void>;
}

// ── Safe AsyncStorage wrapper ─────────────────────────────────────────────────
// AsyncStorage native module may not be available in all build configurations.
// This wrapper falls back to a no-op so the app doesn't crash on startup.
const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const AS = require('@react-native-async-storage/async-storage').default;
      return await AS.getItem(key);
    } catch { return null; }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      const AS = require('@react-native-async-storage/async-storage').default;
      await AS.setItem(key, value);
    } catch {}
  },
  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    try {
      const AS = require('@react-native-async-storage/async-storage').default;
      return await AS.multiGet(keys);
    } catch { return keys.map((k) => [k, null]); }
  },
  async multiRemove(keys: string[]): Promise<void> {
    try {
      const AS = require('@react-native-async-storage/async-storage').default;
      await AS.multiRemove(keys);
    } catch {}
  },
};

export const useAuthStore = create<AuthState>((set) => {
  setUnauthenticatedHandler(() => set({ user: null }));

  return {
    user: null,
    isLoading: true,

    login: async (email, password) => {
      const { data } = await apiClient.post('/auth/login', { email, password });
      await storage.setItem('accessToken',  data.accessToken);
      await storage.setItem('refreshToken', data.refreshToken);
      await storage.setItem('tokenExpiry',  String(Date.now() + 2 * 60 * 60 * 1000));
      set({ user: data.user });
    },

    logout: async () => {
      try { await apiClient.post('/auth/logout'); } catch { /* best-effort */ }
      await storage.multiRemove(['accessToken', 'refreshToken', 'tokenExpiry']);
      set({ user: null });
    },

    updateProfile: async (data) => {
      await apiUpdateProfile(data);
      if (data.name !== undefined) {
        set((s) => s.user ? { user: { ...s.user, name: data.name } } : {});
      }
    },

    loadSession: async () => {
      try {
        const pairs = await storage.multiGet(['accessToken', 'tokenExpiry']);
        const accessToken = pairs[0]?.[1];
        const expiry      = Number(pairs[1]?.[1] ?? 0);

        if (!accessToken || Date.now() > expiry) {
          await storage.multiRemove(['accessToken', 'refreshToken', 'tokenExpiry']);
          set({ isLoading: false });
          return;
        }

        const timer = setTimeout(() => {}, 5000);
        try {
          const { data } = await apiClient.get('/auth/me');
          set({ user: data, isLoading: false });
        } catch {
          await storage.multiRemove(['accessToken', 'refreshToken', 'tokenExpiry']);
          set({ user: null, isLoading: false });
        } finally {
          clearTimeout(timer);
        }
      } catch {
        set({ user: null, isLoading: false });
      }
    },
  };
});
