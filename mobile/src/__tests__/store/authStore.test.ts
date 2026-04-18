// jest.mock is hoisted by babel — do NOT reference module-level variables in the factory.
jest.mock('../../api/client', () => ({
  apiClient: {
    post:   jest.fn(),
    get:    jest.fn(),
    patch:  jest.fn(),
    delete: jest.fn(),
  },
  setUnauthenticatedHandler: jest.fn(),
  BASE_URL: 'http://localhost:3000/api/v1',
}));

jest.mock('../../api/auth', () => ({
  updateProfile: jest.fn(),
}));

import { act } from '@testing-library/react-native';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../api/client';
import { updateProfile as apiUpdateProfile } from '../../api/auth';

// These are safe to define after the mocks are registered
const mockPost   = apiClient.post   as jest.Mock;
const mockGet    = apiClient.get    as jest.Mock;
const mockUpdate = apiUpdateProfile as jest.Mock;

const mockUser = { id: '1', email: 'test@test.com', role: 'user' as const, name: 'Test User' };

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: null, isLoading: false });
  });

  // ── login ──────────────────────────────────────────────────────────
  describe('login', () => {
    it('sets user state on successful login', async () => {
      mockPost.mockResolvedValueOnce({
        data: { accessToken: 'at', refreshToken: 'rt', user: mockUser },
      });

      await act(async () => {
        await useAuthStore.getState().login('test@test.com', 'Password1');
      });

      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('throws and does not set user on failed login', async () => {
      mockPost.mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(
        useAuthStore.getState().login('bad@test.com', 'wrong'),
      ).rejects.toThrow('Invalid credentials');

      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  // ── logout ─────────────────────────────────────────────────────────
  describe('logout', () => {
    it('clears user state after successful logout API call', async () => {
      useAuthStore.setState({ user: mockUser, isLoading: false });
      mockPost.mockResolvedValueOnce({});

      await act(async () => {
        await useAuthStore.getState().logout();
      });

      expect(useAuthStore.getState().user).toBeNull();
    });

    it('clears user even when logout API call fails (best-effort)', async () => {
      useAuthStore.setState({ user: mockUser, isLoading: false });
      mockPost.mockRejectedValueOnce(new Error('network error'));

      await act(async () => {
        await useAuthStore.getState().logout();
      });

      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  // ── updateProfile ──────────────────────────────────────────────────
  describe('updateProfile', () => {
    beforeEach(() => {
      useAuthStore.setState({ user: mockUser, isLoading: false });
    });

    it('updates name in user state when name is provided', async () => {
      mockUpdate.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useAuthStore.getState().updateProfile({ name: 'New Name' });
      });

      expect(useAuthStore.getState().user?.name).toBe('New Name');
    });

    it('preserves other user fields when only name is updated', async () => {
      mockUpdate.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useAuthStore.getState().updateProfile({ name: 'Changed' });
      });

      const u = useAuthStore.getState().user!;
      expect(u.email).toBe(mockUser.email);
      expect(u.role).toBe(mockUser.role);
      expect(u.id).toBe(mockUser.id);
    });

    it('does not change name when only password fields are in payload', async () => {
      mockUpdate.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useAuthStore.getState().updateProfile({
          currentPassword: 'old',
          newPassword: 'NewPass1',
        });
      });

      expect(useAuthStore.getState().user?.name).toBe(mockUser.name);
    });
  });

  // ── loadSession ────────────────────────────────────────────────────
  describe('loadSession', () => {
    it('sets isLoading to false and user to null when no token stored', async () => {
      await act(async () => {
        await useAuthStore.getState().loadSession();
      });

      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });
  });
});
