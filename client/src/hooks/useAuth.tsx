import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type CurrentUser, type Role } from '../lib/api';

interface AuthValue {
  user: CurrentUser | null;
  loading: boolean;
  signIn: (identifier: string, password: string, role: Role) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // The session lives in an httpOnly cookie the JS cannot read, so the only
  // way to know who is signed in is to ask the server on boot.
  const refresh = useCallback(async () => {
    try {
      const { user } = await api.get<{ user: CurrentUser }>('/api/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (identifier: string, password: string, role: Role) => {
      await api.post('/api/auth/login', { identifier, password, role });
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
