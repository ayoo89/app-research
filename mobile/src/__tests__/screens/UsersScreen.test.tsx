import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../api/admin', () => ({
  listUsers:         jest.fn(),
  resetUserPassword: jest.fn(),
  deleteUser:        jest.fn(),
}));

jest.mock('../../i18n', () => {
  const t = (key: string, params?: any) => {  // stable ref — prevents useCallback([t]) infinite loop
    if (params?.name) return `${key}:${params.name}`;
    return key;
  };
  return { useI18n: () => ({ t, lang: 'en', setLang: jest.fn() }) };
});

import UsersScreen from '../../screens/UsersScreen';
import { listUsers, resetUserPassword, deleteUser } from '../../api/admin';

const mockListUsers         = listUsers         as jest.Mock;
const mockResetUserPassword = resetUserPassword as jest.Mock;
const mockDeleteUser        = deleteUser        as jest.Mock;

const SUPER_ADMIN = { id: 'u1', email: 'sa@test.com', name: 'Super Admin', role: 'super_admin' as const, isActive: true, createdAt: '' };
const ADMIN_USER  = { id: 'u2', email: 'admin@test.com', name: 'Admin User', role: 'admin'       as const, isActive: true, createdAt: '' };
const REG_USER    = { id: 'u3', email: 'user@test.com', name: 'Regular',     role: 'user'        as const, isActive: true, createdAt: '' };
const INACTIVE    = { id: 'u4', email: 'old@test.com',  name: 'Old User',    role: 'user'        as const, isActive: false, createdAt: '' };

describe('UsersScreen — security: role-based access and user management', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads and displays the users list', async () => {
    mockListUsers.mockResolvedValueOnce([SUPER_ADMIN, ADMIN_USER, REG_USER]);
    const { findByText } = render(<UsersScreen />);
    await findByText('sa@test.com');
    await findByText('Admin User');
    await findByText('Regular');
  });

  it('security: delete button is hidden for super_admin users', async () => {
    mockListUsers.mockResolvedValueOnce([SUPER_ADMIN]);
    const { findByText, queryByText } = render(<UsersScreen />);
    await findByText('sa@test.com');
    expect(queryByText('users_delete_action')).toBeNull();
  });

  it('security: delete button is shown for admin users', async () => {
    mockListUsers.mockResolvedValueOnce([ADMIN_USER]);
    const { findAllByText } = render(<UsersScreen />);
    const deleteBtns = await findAllByText('users_delete_action');
    expect(deleteBtns.length).toBeGreaterThan(0);
  });

  it('security: delete button is shown for regular users', async () => {
    mockListUsers.mockResolvedValueOnce([REG_USER]);
    const { findAllByText } = render(<UsersScreen />);
    const deleteBtns = await findAllByText('users_delete_action');
    expect(deleteBtns.length).toBeGreaterThan(0);
  });

  it('shows inactive banner for inactive users', async () => {
    mockListUsers.mockResolvedValueOnce([INACTIVE]);
    const { findByText } = render(<UsersScreen />);
    await findByText('users_inactive');
  });

  it('shows reset password confirmation alert', async () => {
    mockListUsers.mockResolvedValueOnce([REG_USER]);
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { findAllByText } = render(<UsersScreen />);
    const resetBtns = await findAllByText('users_reset_action');
    fireEvent.press(resetBtns[0]);
    expect(alertSpy).toHaveBeenCalledWith(
      'users_reset_title',
      expect.stringContaining('Regular'),
      expect.arrayContaining([
        expect.objectContaining({ text: 'common_cancel' }),
        expect.objectContaining({ text: 'users_reset_action' }),
      ]),
    );
  });

  it('calls resetUserPassword when confirmed in alert', async () => {
    mockListUsers.mockResolvedValueOnce([REG_USER]);
    mockResetUserPassword.mockResolvedValueOnce(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { findAllByText } = render(<UsersScreen />);
    const resetBtns = await findAllByText('users_reset_action');
    fireEvent.press(resetBtns[0]);

    // Simulate pressing the confirm button in the alert
    const alertArgs = alertSpy.mock.calls[0];
    const confirmButton = (alertArgs[2] as any[]).find((b: any) => b.text === 'users_reset_action');
    await confirmButton.onPress();

    expect(mockResetUserPassword).toHaveBeenCalledWith('u3');
  });

  it('shows delete confirmation alert', async () => {
    mockListUsers.mockResolvedValueOnce([REG_USER]);
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { findAllByText } = render(<UsersScreen />);
    const deleteBtns = await findAllByText('users_delete_action');
    fireEvent.press(deleteBtns[0]);
    expect(alertSpy).toHaveBeenCalledWith(
      'users_delete_title',
      expect.stringContaining('Regular'),
      expect.arrayContaining([
        expect.objectContaining({ text: 'common_cancel' }),
        expect.objectContaining({ text: 'users_delete_action' }),
      ]),
    );
  });

  it('removes user from list after delete is confirmed', async () => {
    mockListUsers.mockResolvedValueOnce([REG_USER, ADMIN_USER]);
    mockDeleteUser.mockResolvedValueOnce(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { findAllByText, queryByText } = render(<UsersScreen />);
    const deleteBtns = await findAllByText('users_delete_action');
    fireEvent.press(deleteBtns[0]);

    const alertArgs = alertSpy.mock.calls[0];
    const confirmButton = (alertArgs[2] as any[]).find((b: any) => b.text === 'users_delete_action');
    await confirmButton.onPress();

    await waitFor(() => expect(queryByText('Regular')).toBeNull());
  });

  it('shows invite FAB and navigates to InviteUser when pressed', async () => {
    mockListUsers.mockResolvedValueOnce([]);
    const { findByLabelText } = render(<UsersScreen />);
    const fab = await findByLabelText('users_invite_action');
    fireEvent.press(fab);
    expect(mockNavigate).toHaveBeenCalledWith('InviteUser', expect.anything());
  });

  it('shows error when listUsers fails', async () => {
    mockListUsers.mockRejectedValueOnce({ message: 'Unauthorized' });
    const { findByText } = render(<UsersScreen />);
    await findByText(/Unauthorized/);
  });
});
