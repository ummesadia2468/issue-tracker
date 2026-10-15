import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const Ctx = createContext({ mode: 'system', resolved: 'light', setMode: () => {} });
export const useTheme = () => useContext(Ctx);

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
const read = () => { try { return localStorage.getItem('theme') || 'system'; } catch { return 'system'; } };

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(read);
  const [resolved, setResolved] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));

  useEffect(() => {
    const apply = () => {
      const dark = mode === 'dark' || (mode === 'system' && systemDark());
      document.documentElement.classList.toggle('dark', dark);
      setResolved(dark ? 'dark' : 'light');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0e13' : '#0f766e');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply); // follow the device when set to "System"
    return () => mq.removeEventListener('change', apply);
  }, [mode]);

  const setMode = useCallback((m) => {
    setModeState(m);
    try { localStorage.setItem('theme', m); } catch { /* storage blocked: still works for this visit */ }
  }, []);

  return <Ctx.Provider value={{ mode, resolved, setMode }}>{children}</Ctx.Provider>;
}
