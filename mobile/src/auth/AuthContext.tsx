import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { apiFetch, ApiError } from '@/api/client';
import { CURRENT_USER, FARMS } from '@/api/mock';
import { clearSession, loadSession, saveSession, type StoredSession } from '@/api/token';
import { clearQueue } from '@/offline';
import type { Farm, PublicUser } from '@/api/types';

const DEMO_SESSION: StoredSession = { token: '', user: CURRENT_USER, farms: FARMS, activeFarmId: FARMS[0]?.id };

export type AuthMode = 'demo' | 'live';

interface AuthContextValue {
mode: AuthMode;
user: PublicUser;
farms: Farm[];
farmId: string;
activeFarmId: string;
busy: boolean;
error: string | null;
setActiveFarmId: (farmId: string) => void;
signIn: (phone: string, code: string) => Promise<boolean>;
signUp: (phone: string, fullName: string, code: string) => Promise<boolean>;
signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<StoredSession | null>(() => {
    const stored = loadSession();
    return stored?.token ? stored : DEMO_SESSION;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;
    apiFetch<Farm[]>('/farms')
      .then((farms) => {
        setSession((prev) => (prev?.token ? { ...prev, farms } : prev));
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          clearSession();
          setSession(DEMO_SESSION);
        }
      });
  }, [session?.token]);

  const signIn = useCallback(
    async (phone: string, code: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const res = await apiFetch<{ accessToken: string; user: PublicUser }>('/auth/login', {
          method: 'POST',
          body: { phone, code },
        });
        const next: StoredSession = { token: res.accessToken, user: res.user, farms: [] };
        saveSession(next);
        const farms = await apiFetch<Farm[]>('/farms');
        const full: StoredSession = { ...next, farms };
        saveSession(full);
        setSession(full);
        void queryClient.invalidateQueries();
        return true;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erreur inconnue lors de la connexion.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [queryClient],
  );

  const signUp = useCallback(
    async (phone: string, fullName: string, code: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const res = await apiFetch<{ accessToken: string; user: PublicUser }>('/auth/register', {
          method: 'POST',
          body: { phone, fullName, code },
        });
        const next: StoredSession = { token: res.accessToken, user: res.user, farms: [] };
        saveSession(next);
        const farms = await apiFetch<Farm[]>('/farms');
        const full: StoredSession = { ...next, farms };
        saveSession(full);
        setSession(full);
        void queryClient.invalidateQueries();
        return true;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erreur inconnue lors de l’inscription.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [queryClient],
  );

  const signOut = useCallback(() => {
    clearSession();
    clearQueue();
    setSession(DEMO_SESSION);
    setError(null);
    void queryClient.invalidateQueries();
  }, [queryClient]);

  const setActiveFarmId = useCallback(
    (farmId: string) => {
      const newSession: StoredSession = {
        ...session!,
        activeFarmId: farmId,
      };
      saveSession(newSession);
      setSession(newSession);
    },
    [session, saveSession],
  );

  const value = useMemo<AuthContextValue>(() => {
    const current = session ?? DEMO_SESSION;
    const activeFarmId = current.activeFarmId ?? current.farms[0]?.id;
    return {
      mode: current.token ? 'live' : 'demo',
      user: current.user,
      farms: current.farms,
      farmId: activeFarmId,
      activeFarmId,
      busy,
      error,
      signIn,
      signUp,
      signOut,
      setActiveFarmId,
    };
  }, [session, busy, error, signIn, signUp, signOut, setActiveFarmId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  return ctx;
}