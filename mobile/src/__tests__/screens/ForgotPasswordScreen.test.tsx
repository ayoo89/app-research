import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ForgotPasswordScreen from '../../screens/ForgotPasswordScreen';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock('../../api/auth', () => ({
  forgotPassword: jest.fn(),
}));

jest.mock('../../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, lang: 'en', setLang: jest.fn() }),
}));

import { forgotPassword } from '../../api/auth';
const mockForgotPassword = forgotPassword as jest.Mock;

describe('ForgotPasswordScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders email input and submit button', () => {
    const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />);
    expect(getByPlaceholderText('forgot_email_placeholder')).toBeTruthy();
    expect(getByText('forgot_submit')).toBeTruthy();
  });

  it('shows email format error when @ is missing', () => {
    const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />);
    fireEvent.changeText(getByPlaceholderText('forgot_email_placeholder'), 'notvalid');
    fireEvent.press(getByText('forgot_submit'));
    expect(getByText(/forgot_error_email/)).toBeTruthy();
  });

  it('shows success state after valid submission — admin notification, not self-service reset', async () => {
    mockForgotPassword.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getByText, findByText } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(getByPlaceholderText('forgot_email_placeholder'), 'user@company.com');
    fireEvent.press(getByText('forgot_submit'));

    // UC-4: success shows admin-notification message (forgot_success_body), NOT "check email for link"
    await findByText('forgot_success_title');
    expect(getByText('forgot_success_body')).toBeTruthy();
  });

  it('calls forgotPassword with trimmed email', async () => {
    mockForgotPassword.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(getByPlaceholderText('forgot_email_placeholder'), '  admin@test.com  ');
    fireEvent.press(getByText('forgot_submit'));

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith('admin@test.com');
    });
  });

  it('shows generic error when API throws', async () => {
    mockForgotPassword.mockRejectedValueOnce(new Error('Network error'));
    const { getByPlaceholderText, getByText, findByText } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(getByPlaceholderText('forgot_email_placeholder'), 'user@test.com');
    fireEvent.press(getByText('forgot_submit'));

    await findByText(/forgot_error_generic/);
  });

  it('calls goBack when back link is pressed', () => {
    const { getAllByText } = render(<ForgotPasswordScreen />);
    fireEvent.press(getAllByText('forgot_back')[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('calls goBack from success state', async () => {
    mockForgotPassword.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getByText, findByText } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(getByPlaceholderText('forgot_email_placeholder'), 'user@test.com');
    fireEvent.press(getByText('forgot_submit'));

    await findByText('forgot_success_title');
    fireEvent.press(getByText('forgot_back'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
