import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveDeviceLang, type AppLang } from './locale';
import { en, fr, type TranslationKey } from './translations';

const LANG_KEY = 'app_lang';
const table = { en, fr } as const;
type Params = Record<string, string | number>;

export type TI18n = {
  lang: AppLang;
  setLang: (lang: AppLang) => void;
  t: (key: TranslationKey, params?: Params) => string;
};

const I18nContext = createContext<TI18n | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLang>(resolveDeviceLang());

  // Load persisted language on mount
  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY)
      .then((saved) => { if (saved === 'fr' || saved === 'en') setLangState(saved); })
      .catch(() => {});
  }, []);

  const setLang = useCallback((newLang: AppLang) => {
    setLangState(newLang);
    AsyncStorage.setItem(LANG_KEY, newLang).catch(() => {});
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Params) => {
      let s = table[lang][key] ?? table.en[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => { s = s.split(`{${k}}`).join(String(v)); });
      }
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): TI18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
