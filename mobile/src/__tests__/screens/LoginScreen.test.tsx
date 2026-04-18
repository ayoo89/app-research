import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../screens/LoginScreen';

const mockNavigate = jest.fn();
const mockLogin    = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

// LoginScreen uses: useAuthStore((s) => s.login)
jest.mock('../../store/authStore', () => ({
  useAuthStore: (selector: any) => selector({ login: mockLogin }),
}));

jest.mock('../../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, lang: 'en', setLang: jest.fn() }),
}));

describe('LoginScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders email and password fields', () => {
    const { getByLabelText } = render(<LoginScreen />);
    expect(getByLabelText('login_email')).toBeTruthy();
    expect(getByLabelText('login_password')).toBeTruthy();
  });

  it('shows fill-in error when both fields are empty on submit', () => {
    const { getByLabelText, getByText } = render(<LoginScreen />);
    fireEvent.press(getByLabelText('login_submit'));
    expect(getByText(/login_error_fill/)).toBeTruthy();
  });

  it('shows email format error when @ is missing', () => {
    const { getByLabelText, getByText } = render(<LoginScreen />);
    fireEvent.changeText(getByLabelText('login_email'), 'notanemail');
    fireEvent.changeText(getByLabelText('login_password'), 'password');
    fireEvent.press(getByLabelText('login_submit'));
    expect(getByText(/login_error_email/)).toBeTruthy();
  });

  it('does not show an error before user interacts', () => {
    const { queryByText } = render(<LoginScreen />);
    expect(queryByText(/login_error/)).toBeNull();
  });

  it('calls login with trimmed email on valid submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const { getByLabelText } = render(<LoginScreen />);

    fireEvent.changeText(getByLabelText('login_email'), '  user@example.com  ');
    fireEvent.changeText(getByLabelText('login_password'), 'MyPassword');
    fireEvent.press(getByLabelText('login_submit'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'MyPassword');
    });
  });

  it('shows error returned by login action', async () => {
    mockLogin.mockRejectedValueOnce({ message: 'Invalid credentials' });
    const { getByLabelText, findByText } = render(<LoginScreen />);

    fireEvent.changeText(getByLabelText('login_email'), 'bad@user.com');
    fireEvent.changeText(getByLabelText('login_password'), 'wrongpass');
    fireEvent.press(getByLabelText('login_submit'));

    await findByText(/Invalid credentials/);
  });

  it('navigates to ForgotPassword when link is pressed', () => {
    const { getByText } = render(<LoginScreen />);
    fireEvent.press(getByText('forgot_link'));
    expect(mockNavigate).toHaveBeenCalledWith('ForgotPassword');
  });
});
