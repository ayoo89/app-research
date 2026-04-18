import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import InviteUserScreen from '../../screens/InviteUserScreen';

const mockGoBack  = jest.fn();
const mockOnDone  = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { onDone: mockOnDone } }),
}));

jest.mock('../../api/admin', () => ({
  inviteUser: jest.fn(),
}));

jest.mock('../../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, lang: 'en', setLang: jest.fn() }),
}));

import { inviteUser } from '../../api/admin';
const mockInviteUser = inviteUser as jest.Mock;

describe('InviteUserScreen — UC-1: email/password received via invitation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders email, name inputs and role selector', () => {
    const { getByPlaceholderText, getByText } = render(<InviteUserScreen />);
    expect(getByPlaceholderText('forgot_email_placeholder')).toBeTruthy();
    expect(getByPlaceholderText('invite_name_placeholder')).toBeTruthy();
    expect(getByText('Admin')).toBeTruthy();
    expect(getByText('Utilisateur')).toBeTruthy();
  });

  it('shows email error when @ is missing', () => {
    const { getByPlaceholderText, getByText } = render(<InviteUserScreen />);
    fireEvent.changeText(getByPlaceholderText('forgot_email_placeholder'), 'notanemail');
    fireEvent.changeText(getByPlaceholderText('invite_name_placeholder'), 'Alice');
    fireEvent.press(getByText('invite_submit'));
    expect(getByText(/forgot_error_email/)).toBeTruthy();
  });

  it('shows name error when name is empty', () => {
    const { getByPlaceholderText, getByText } = render(<InviteUserScreen />);
    fireEvent.changeText(getByPlaceholderText('forgot_email_placeholder'), 'alice@test.com');
    fireEvent.press(getByText('invite_submit'));
    expect(getByText(/invite_error_name/)).toBeTruthy();
  });

  it('calls inviteUser with trimmed email, name, and default role user', async () => {
    mockInviteUser.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getByText } = render(<InviteUserScreen />);

    fireEvent.changeText(getByPlaceholderText('forgot_email_placeholder'), '  alice@test.com  ');
    fireEvent.changeText(getByPlaceholderText('invite_name_placeholder'), '  Alice  ');
    fireEvent.press(getByText('invite_submit'));

    await waitFor(() => {
      expect(mockInviteUser).toHaveBeenCalledWith({
        email: 'alice@test.com',
        name: 'Alice',
        role: 'user',
      });
    });
  });

  it('calls inviteUser with admin role when Admin is selected', async () => {
    mockInviteUser.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getByText } = render(<InviteUserScreen />);

    fireEvent.press(getByText('Admin'));
    fireEvent.changeText(getByPlaceholderText('forgot_email_placeholder'), 'admin@test.com');
    fireEvent.changeText(getByPlaceholderText('invite_name_placeholder'), 'Bob');
    fireEvent.press(getByText('invite_submit'));

    await waitFor(() => {
      expect(mockInviteUser).toHaveBeenCalledWith({
        email: 'admin@test.com',
        name: 'Bob',
        role: 'admin',
      });
    });
  });

  it('calls onDone callback and navigates back on success', async () => {
    mockInviteUser.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getByText } = render(<InviteUserScreen />);

    fireEvent.changeText(getByPlaceholderText('forgot_email_placeholder'), 'user@test.com');
    fireEvent.changeText(getByPlaceholderText('invite_name_placeholder'), 'Alice');
    fireEvent.press(getByText('invite_submit'));

    await waitFor(() => {
      expect(mockOnDone).toHaveBeenCalled();
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('shows error returned by the API', async () => {
    mockInviteUser.mockRejectedValueOnce({ message: 'Email already used' });
    const { getByPlaceholderText, getByText, findByText } = render(<InviteUserScreen />);

    fireEvent.changeText(getByPlaceholderText('forgot_email_placeholder'), 'dup@test.com');
    fireEvent.changeText(getByPlaceholderText('invite_name_placeholder'), 'Alice');
    fireEvent.press(getByText('invite_submit'));

    await findByText(/Email already used/);
  });
});
