'use client';

import type { Me } from '@obolo/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, getApi, tokenStore } from './api';

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
    // Only a rejected session logs out; a network hiccup while opening keeps the token (retried once).
    const load = (retry: boolean) =>
      getApi()
        .me()
        .then((u) => {
          setMe(u);
          setStatus('authed');
        })
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) {
            tokenStore.clear();
            setStatus('guest');
          } else if (retry) setTimeout(() => void load(false), 1500);
          else setStatus('guest');
        });
    void load(true);
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
