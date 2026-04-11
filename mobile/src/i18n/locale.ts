export type AppLang = 'fr' | 'en';

/**
 * Langue d’interface : FR si la locale du téléphone commence par « fr », sinon EN.
 */
export function resolveDeviceLang(): AppLang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    const tag = locale.replace('_', '-').toLowerCase();
    if (tag.startsWith('fr')) return 'fr';
    return 'en';
  } catch {
    return 'en';
  }
}
