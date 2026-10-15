import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ur from './locales/ur';
import { setLocale } from './api';

const Ctx = createContext({ lang: 'en', setLang: () => {}, t: (s) => s });
export const useI18n = () => useContext(Ctx);

/**
 * The English text itself is the key: t('Report an issue').
 * Missing Urdu translations simply fall back to English, so nothing ever breaks.
 */
export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => { try { return localStorage.getItem('lang') === 'ur' ? 'ur' : 'en'; } catch { return 'en'; } });

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    setLocale(lang === 'ur' ? 'ur-PK' : undefined);
  }, [lang]);

  const setLang = useCallback((l) => { setLangState(l); try { localStorage.setItem('lang', l); } catch { /* ignore */ } }, []);

  const t = useCallback((key, vars) => {
    let s = (lang === 'ur' && ur[key]) || key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
