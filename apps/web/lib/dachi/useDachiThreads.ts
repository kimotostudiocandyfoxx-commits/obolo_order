'use client';

import type { DachiThreadView } from '@obolo/shared';
import { useCallback, useEffect, useState } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** the faces of the story characters' threads */
export const CHARACTER_AVATAR: Record<string, string> = { kimorin: '/story/avatars/kimorin.webp', mikie: '/onboarding/mikie.webp' };

/** one row of the atelier's conversation list (components/atelier/threads.ts ThreadInfo, kept structurally the same) */
export type DachiThreadInfo = { id: string; name: string; avatar?: string; unread?: number };

const POLL_MS = 30_000;

/**
 * The ダチ threads for the atelier's left drawer (M-R212): from D04-S005c (day 3) {inviter} — or MIKIE⭐︎DRILL when there
 * is no inviter — and KIMORIN⭐︎, then any other dachi. Empty before (the server returns none until then). Checked again
 * every 30 s while the page is visible, so KIMORIN⭐︎'s lines show up during the wait.
 */
export function useDachiThreads() {
  const { me } = useAuth();
  const [list, setList] = useState<DachiThreadView[]>([]);
  const on = !!me && (me.journeyDay ?? 0) >= 3;

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

  const threads: DachiThreadInfo[] = list.map((t) => ({ id: t.id, name: t.name, avatar: t.pic ?? CHARACTER_AVATAR[t.kind], unread: t.unread ? 1 : 0 }));
  /** a thread was opened and heard: its dot goes */
  const markRead = useCallback((id: string) => setList((l) => l.map((t) => (t.id === id ? { ...t, unread: false } : t))), []);
  return { threads, list, reload, markRead };
}
