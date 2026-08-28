import { createContext, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { AuthUser } from '../api/client';
import { clearSession, setSession } from '../api/client';

interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  isOwnerOrAdmin: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('koukou.user');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAdmin: user?.role === 'PLATFORM_ADMIN',
      isOwnerOrAdmin:
        user?.role === 'PROPRIETAIRE' || user?.role === 'PLATFORM_ADMIN',
      login: async (identifier: string, password: string) => {
        const res = await api.post<LoginResult>('/auth/login', {
          identifier,
          password,
        });
        if (res.user.role !== 'PLATFORM_ADMIN') {
          clearSession();
          throw new Error(
            "La console web est réservée à l'administrateur plateforme. Propriétaires et éleveurs utilisent l'application mobile.",
          );
        }
        setSession(res.accessToken, res.user);
        setUser(res.user);
        navigate('/app/platform');
      },
      logout: () => {
        clearSession();
        setUser(null);
        navigate('/login');
      },
    }),
    [navigate, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  return ctx;
}