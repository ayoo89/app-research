import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { resolveDeviceLang, type AppLang } from './locale';
import { en, fr, type TranslationKey } from './translations';

const table = { en, fr } as const;

type Params = Record<string, string | number>;

export type TI18n = {
  lang: AppLang;
  t: (key: TranslationKey, params?: Params) => string;
};

const I18nContext = createContext<TI18n | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const lang = useMemo(() => resolveDeviceLang(), []);

  const t = useCallback(
    (key: TranslationKey, params?: Params) => {
      let s = table[lang][key] ?? table.en[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          s = s.split(`{${k}}`).join(String(v));
        });
      }
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, t }), [lang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): TI18n {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
