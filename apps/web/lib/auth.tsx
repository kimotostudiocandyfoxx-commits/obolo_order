'use client';

import type { Me } from '@obolo/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getApi, tokenStore } from './api';

type Status = 'loading' | 'guest' | 'authed';

interface AuthValue {
  status: Status;
  me: Me | null;
  signIn: (token: string, me: Me) => void;
  signOut: () => Promise<void>;
  setMe: (me: Me) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!tokenStore.get()) {
      setStatus('guest');
      return;
    }
    getApi()
      .me()
      .then((u) => {
        setMe(u);
        setStatus('authed');
      })
      .catch(() => {
        tokenStore.clear();
        setStatus('guest');
      });
  }, []);

  const signIn = useCallback((token: string, u: Me) => {
    tokenStore.set(token);
    setMe(u);
    setStatus('authed');
  }, []);

  const signOut = useCallback(async () => {
    await getApi().logout();
    setMe(null);
    setStatus('guest');
  }, []);

  const value = useMemo(() => ({ status, me, signIn, signOut, setMe }), [status, me, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
