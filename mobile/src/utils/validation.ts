import { TranslationKey } from '../i18n/translations';

type TFn = (key: TranslationKey) => string;

export function validatePassword(pw: string, t: TFn): string | null {
  if (pw.length < 8)      return t('profile_pw_err_length');
  if (!/[A-Z]/.test(pw)) return t('profile_pw_err_upper');
  if (!/[0-9]/.test(pw)) return t('profile_pw_err_digit');
  return null;
}
