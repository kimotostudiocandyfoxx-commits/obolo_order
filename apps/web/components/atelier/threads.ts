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
  /** unread count, shown as a dot (no number on screen) */
  unread?: number;
};

export type ThreadCtx = {
  /** open the left drawer (the conversation list) */
  openList: () => void;
  /** open Bluena (right drawer) — undefined on day 2, when there is no Bluena yet */
  openBluena?: () => void;
};

export type RenderThread = (id: string, ctx: ThreadCtx) => ReactNode;

export const BATI_THREAD = 'bati';
