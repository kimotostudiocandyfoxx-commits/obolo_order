'use client';

import { useEffect, useState } from 'react';

/** useState persisted to localStorage (per-device demo state for the visual planets). */
export function useLocalState<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setV(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
  }, [key]);
  const set = (next: T | ((cur: T) => T)) =>
    setV((cur) => {
      const val = typeof next === 'function' ? (next as (c: T) => T)(cur) : next;
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch {
        /* ignore */
      }
      return val;
    });
  return [v, set] as const;
}
