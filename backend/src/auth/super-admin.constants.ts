/**
 * Compte super administrateur (synchronisé en base au démarrage).
 * En production, préférez SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD via variables d’environnement
 * et retirez les valeurs par défaut du dépôt.
 */
export const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL ?? 'mouadh.stl@gmail.com';

export const SUPER_ADMIN_PASSWORD =
  process.env.SUPER_ADMIN_PASSWORD ?? '1436528mD@';
