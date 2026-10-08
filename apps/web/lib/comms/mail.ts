'use client';

import type { CommsStatus, DmMessage } from '@obolo/shared';
import { getApi } from '@/lib/api';

/**
 * Earth mail: how new messages reach an open conversation (client decision 2026-10-08).
 *  - Firebase set up (the API says mail = 'firebase' and NEXT_PUBLIC_FIREBASE_CONFIG is set):
 *    sign in with a token from our API, then listen to dm/{pair}/messages in Firestore.
 *  - otherwise: ask the API for anything newer every few seconds.
 * Messages are always sent through the API (it checks membership, ダチ and the words).
 */
const POLL_MS = 4000;

export function watchConversation(status: CommsStatus, myId: string, peerId: string, onNew: (m: DmMessage[]) => void): () => void {
  // the server hands out the web config (GitHub Variables); a Vercel env var also works
  const firebaseConfig = status.firebaseWeb ? JSON.stringify(status.firebaseWeb) : process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (status.mail === 'firebase' && firebaseConfig) {
    let stop = () => {};
    let cancelled = false;
    void import('./firebase')
      .then((f) => f.listenConversation(firebaseConfig, myId, peerId, onNew))
      .then((s) => {
        if (cancelled) s();
        else stop = s;
      })
      .catch(() => {
        // Firebase could not start: fall back to checking every few seconds
        if (!cancelled) stop = poll(peerId, onNew);
      });
    return () => {
      cancelled = true;
      stop();
    };
  }
  return poll(peerId, onNew);
}

function poll(peerId: string, onNew: (m: DmMessage[]) => void): () => void {
  let after: string | undefined;
  let alive = true;
  const tick = async () => {
    try {
      const list = await getApi().dmMessages(peerId, after);
      if (!alive) return;
      if (list.length) {
        after = list[list.length - 1].createdAt;
        onNew(list);
      }
    } catch {
      /* offline for a moment: try again next tick */
    }
  };
  void tick();
  const id = setInterval(tick, POLL_MS);
  return () => {
    alive = false;
    clearInterval(id);
  };
}
