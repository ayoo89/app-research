import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../../screens/ProfileScreen';

const mockUpdateProfile = jest.fn();

// ProfileScreen calls useAuthStore() WITHOUT a selector → must return state directly
jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, lang: 'en', setLang: jest.fn() }),
}));

import { useAuthStore } from '../../store/authStore';

const mockState = {
  user: { id: '1', email: 'user@test.com', name: 'Test User', role: 'user' as const },
  updateProfile: mockUpdateProfile,
};

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector?: any) =>
      typeof selector === 'function' ? selector(mockState) : mockState,
    );
  });

  it('displays user email as read-only text', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('user@test.com')).toBeTruthy();
  });

  it('shows length error when new password is too short', () => {
    const { getByPlaceholderText, getByText } = render(<ProfileScreen />);
    fireEvent.changeText(getByPlaceholderText('profile_current_placeholder'), 'Current1');
    fireEvent.changeText(getByPlaceholderText('profile_new_placeholder'), 'Ab1');
    fireEvent.press(getByText('profile_save'));
    expect(getByText(/profile_pw_err_length/)).toBeTruthy();
  });

  it('shows uppercase error when new password has no uppercase', () => {
    const { getByPlaceholderText, getByText } = render(<ProfileScreen />);
    fireEvent.changeText(getByPlaceholderText('profile_current_placeholder'), 'Current1');
    fireEvent.changeText(getByPlaceholderText('profile_new_placeholder'), 'lowercase1');
    fireEvent.press(getByText('profile_save'));
    expect(getByText(/profile_pw_err_upper/)).toBeTruthy();
  });

  it('shows digit error when new password has no digit', () => {
    const { getByPlaceholderText, getByText } = render(<ProfileScreen />);
    fireEvent.changeText(getByPlaceholderText('profile_current_placeholder'), 'Current1');
    fireEvent.changeText(getByPlaceholderText('profile_new_placeholder'), 'NoDigitHere');
    fireEvent.press(getByText('profile_save'));
    expect(getByText(/profile_pw_err_digit/)).toBeTruthy();
  });

  it('shows current-password error when new password entered without current', () => {
    const { getByPlaceholderText, getByText } = render(<ProfileScreen />);
    fireEvent.changeText(getByPlaceholderText('profile_new_placeholder'), 'NewPass1');
    fireEvent.press(getByText('profile_save'));
    expect(getByText(/profile_error_current/)).toBeTruthy();
  });

  it('calls updateProfile with correct payload on valid save', async () => {
    mockUpdateProfile.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getByText } = render(<ProfileScreen />);

    fireEvent.changeText(getByPlaceholderText('profile_current_placeholder'), 'OldPass1');
    fireEvent.changeText(getByPlaceholderText('profile_new_placeholder'), 'NewPass1');
    fireEvent.press(getByText('profile_save'));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ currentPassword: 'OldPass1', newPassword: 'NewPass1' }),
      );
    });
  });
});
