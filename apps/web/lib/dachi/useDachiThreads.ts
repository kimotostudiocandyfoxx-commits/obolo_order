'use client';

import type { DachiThreadView } from '@obolo/shared';
import { useCallback, useEffect, useState } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** the faces of the story characters' threads */
export const CHARACTER_AVATAR: Record<string, string> = { kimorin: '/story/avatars/kimorin.webp', mikie: '/onboarding/mikie.webp' };

/** one row of the atelier's conversation list (components/atelier/threads.ts ThreadInfo, kept structurally the same) */
export type DachiThreadInfo = { id: string; name: string; avatar?: string; unread?: number; /** R9: the full figure */ stand?: string };

const POLL_MS = 30_000;

/**
 * The ダチ threads for the atelier's left drawer (M-R212; client 2026-11-24: KIMORIN⭐︎ always, from the start): from D04-S005c (day 3) {inviter} — or MIKIE⭐︎DRILL when there
 * is no inviter — and KIMORIN⭐︎, then any other dachi. Empty before (the server returns none until then). Checked again
 * every 30 s while the page is visible, so KIMORIN⭐︎'s lines show up during the wait.
 */
export function useDachiThreads() {
  const { me } = useAuth();
  const [list, setList] = useState<DachiThreadView[]>([]);
  // client 2026-11-24: KIMORIN⭐︎ is everyone's ダチ — asked for from the start (the server lists KIMORIN before D04-S005c)
  const on = !!me;

  const reload = useCallback(async () => {
    if (!on) return setList([]);
    try {
      setList(await getApi().dachiThreads());
    } catch {
      /* keep what we have */
    }
  }, [on]);

  useEffect(() => {
    void reload();
    if (!on) return;
    const t = setInterval(() => document.visibilityState === 'visible' && void reload(), POLL_MS);
    const vis = () => document.visibilityState === 'visible' && void reload();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [reload, on]);

  // KIMORIN⭐︎ always (even when the server's list is empty or could not be read)
  const all: DachiThreadView[] = on && !list.some((t) => t.id === 'kimorin') ? [...list, { id: 'kimorin', kind: 'kimorin', name: 'KIMORIN⭐︎', pic: null, unread: false, lastAt: null }] : list;
  const threads: DachiThreadInfo[] = all.map((t) => ({ id: t.id, name: t.name, avatar: t.pic ?? CHARACTER_AVATAR[t.kind], unread: t.unread ? 1 : 0, stand: t.talk?.stand }));
  /** a thread was opened and heard: its dot goes */
  const markRead = useCallback((id: string) => setList((l) => l.map((t) => (t.id === id ? { ...t, unread: false } : t))), []);
  return { threads, list: all, reload, markRead };
}
