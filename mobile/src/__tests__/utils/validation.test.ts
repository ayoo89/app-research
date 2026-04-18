import { validatePassword } from '../../utils/validation';
import { TranslationKey } from '../../i18n/translations';

const t = (key: TranslationKey) => key;

describe('validatePassword', () => {
  it('returns length error for password shorter than 8 chars', () => {
    expect(validatePassword('Ab1', t)).toBe('profile_pw_err_length');
    expect(validatePassword('', t)).toBe('profile_pw_err_length');
    expect(validatePassword('Ab1defg', t)).toBe('profile_pw_err_length');
  });

  it('returns uppercase error when no uppercase letter', () => {
    expect(validatePassword('password1', t)).toBe('profile_pw_err_upper');
    expect(validatePassword('abcdefg1', t)).toBe('profile_pw_err_upper');
  });

  it('returns digit error when no digit', () => {
    expect(validatePassword('Password', t)).toBe('profile_pw_err_digit');
    expect(validatePassword('Abcdefgh', t)).toBe('profile_pw_err_digit');
  });

  it('returns null for a valid password (8 chars, uppercase, digit)', () => {
    expect(validatePassword('Password1', t)).toBeNull();
    expect(validatePassword('MyP@ss0rd', t)).toBeNull();
    expect(validatePassword('AAAAAAAA1', t)).toBeNull();
  });

  it('checks length before other rules', () => {
    expect(validatePassword('Ab1', t)).toBe('profile_pw_err_length');
  });

  it('checks uppercase before digit', () => {
    expect(validatePassword('alllower1', t)).toBe('profile_pw_err_upper');
  });

  it('uses translation function to produce the message', () => {
    const customT = (key: TranslationKey) => `translated:${key}`;
    expect(validatePassword('short', customT)).toBe('translated:profile_pw_err_length');
    expect(validatePassword('nouppercase1', customT)).toBe('translated:profile_pw_err_upper');
    expect(validatePassword('NoDigitHere', customT)).toBe('translated:profile_pw_err_digit');
  });
});
