import type { ReactNode } from 'react';

/**
 * The conversations in 月で作る's left drawer (M-R212). {bati} is always first (its thread is the atelier chat itself);
 * from day 3 (after D04-S005c) the threads with {inviter} and KIMORIN⭐︎ are listed below it. Every thread opens in the
 * same chat screen: the shell renders `<AtelierChat/>` for 'bati' and `renderThread(id, ctx)` for the others.
 *
 * Plug-in point for the ダチ voice messages (another agent): pass `threads` and `renderThread` to
 * `<MoonAtelier threads={…} renderThread={…} />` (app/moon/atelier/page.tsx) — no change to these files needed.
 * Which threads to list (and when, e.g. only from day 3) is decided by whoever passes them.
 */
export type ThreadInfo = {
  /** unique; 'bati' is reserved for {bati}'s own thread */
  id: string;
  name: string;
  avatar?: string;
  /** R9: their full figure (the look's standing picture) for the ダチ tab's Moon */
  stand?: string;
  /** R9: the last 7 days' messages and the newest one (the temple's great hall / plain ranking) */
  recent?: number;
  lastAt?: string | null;
  /** unread count, shown as a dot (no number on screen) */
  unread?: number;
};

export type ThreadCtx = {
  /** open the left drawer (the conversation list) */
  openList: () => void;
  /** M-R237: show only this day's talk (YYYY-MM-DD), read only — opened from the past talks' list */
  day?: string;
  /** back from that day to the list */
  closeDay?: () => void;
  /** the Moon chat's tabs (MoonTabs), to show under the thread's bar */
  banner?: ReactNode;
  /** a back control in the thread's bar (the ダチ tab: back to the row of ダチ) */
  back?: () => void;
  /** R10: the Bluena device (bottom left, beside the mic; its works can be sent into the talk) */
  openDevice?: () => void;
};

export type RenderThread = (id: string, ctx: ThreadCtx) => ReactNode;

export const BATI_THREAD = 'bati';

/**
 * R15 (client, iPad): which conversations a Moon tab's ≡ lists. {bati}'s tab: {bati}'s own talks only — never a ダチ
 * (from D04-S005c, day 3, every user has the inviter's thread, or MIKIE⭐︎DRILL's welcome when nobody invited them, and
 * it used to be listed here beside {bati}); the ダチ tab: every ダチ (KIMORIN⭐︎, the inviter / MIKIE⭐︎DRILL, the others),
 * never {bati}.
 */
export function threadsInDrawer(tab: 'bati' | 'dachi', bati: Omit<ThreadInfo, 'id'>, threads: ThreadInfo[]): ThreadInfo[] {
  return tab === 'bati' ? [{ ...bati, id: BATI_THREAD }] : threads.filter((t) => t.id !== BATI_THREAD);
}

/** R15: a link into the Moon chat with ?thread=<a ダチ> (an old drawer's, the tester bar's) opens that talk in the ダチ tab */
export function dachiLinkOf(thread: string | null | undefined): string | null {
  return thread && thread !== BATI_THREAD ? thread : null;
}
