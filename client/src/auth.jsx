import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export const homeFor = (user) => (user && user.role !== 'reporter' ? '/admin' : '/dashboard');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password, remember) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password, remember } });
    setUser(d.user); return d.user;
  }, []);
  const register = useCallback(async (payload) => {
    const d = await api('/auth/register', { method: 'POST', body: payload });
    if (!d.needsVerification) setUser(d.user);
    return d;
  }, []);
  const google = useCallback(async (credential) => {
    const d = await api('/auth/google', { method: 'POST', body: { credential } });
    setUser(d.user); return d.user;
  }, []);
  const logout = useCallback(async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); }, []);

  return <Ctx.Provider value={{ user, setUser, loading, login, register, google, logout }}>{children}</Ctx.Provider>;
}
