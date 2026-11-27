'use client';

import type { DachiThreadView } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { DachiThread } from '@/components/dachi/DachiThread';
import { HoldMic } from '@/components/dachi/HoldMic';
import { getApi } from '@/lib/api';

/**
 * D04-S005c (M-R212): the first voice message, inside the story. {inviter} becomes a dachi (idempotent: the caption
 * 「{inviter}がダチになった」 is just before), then their thread opens full screen — the first one that is not KIMORIN⭐︎'s:
 * {inviter}'s. M-R343: no MIKIE⭐︎DRILL stand-in before Order — her thread is never the one opened here, and the story
 * does not reach this step when nobody invited (f_inviter). While there is no thread (or it cannot be read) `fallback`
 * ({inviter}'s 「ようこそ。……あなたのつぶやき、聞こえたよ。」 as a text message) is shown instead. Sending a voice message → 'reply'; 〔あとで〕 → 'later'.
 * Works in the demo too (lib/api/demo.ts keeps the threads in this browser). `test` (the review page with no account):
 * no thread can be read, so the fallback gets the mic and the take is sent nowhere.
 */
export function DachiVoiceStep({ fallback, onDone, test = false }: { fallback: { name: string; text: string }; onDone: (answer: 'reply' | 'later') => void; test?: boolean }) {
  const [thread, setThread] = useState<DachiThreadView | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void (async () => {
      const api = getApi();
      await api.befriendInviter().catch(() => null);
      const list = await api.dachiThreads().catch(() => [] as DachiThreadView[]);
      if (live) setThread(list.find((t) => t.kind !== 'kimorin' && t.kind !== 'mikie') ?? null);
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="absolute inset-0 z-[40] flex flex-col overflow-hidden bg-[radial-gradient(130%_70%_at_50%_0%,#1d2a52_0%,#0b1027_55%,#05060f_100%)] text-amber-50">
      {/* room for the story's own corner buttons (the day, the sound; the review page's scene memo), as in the atelier step */}
      <div className="pt-safe shrink-0">
        <div className="h-12" />
      </div>
      <div className="flex items-center justify-end px-3 pb-2">
        <button
          onClick={() => onDone('later')}
          className="rounded-full border border-amber-200/50 bg-black/40 px-4 py-1.5 text-xs tracking-[0.2em] text-amber-100 backdrop-blur"
        >
          あとで
        </button>
      </div>
      {thread === undefined && <p className="py-8 text-center text-xs text-white/40">…</p>}
      {thread === null && (
        // no thread to open: the script's fallback, as a bubble
        <div className="px-4 pt-2">
          <p className="text-[11px] text-amber-100/70">{fallback.name}</p>
          <p className="mt-1 inline-block rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2 text-[15px] text-amber-50">{fallback.text}</p>
        </div>
      )}
      {thread === null && test && (
        <div className="mt-auto">
          <HoldMic onSend={async () => onDone('reply')} />
        </div>
      )}
      {thread && <DachiThread id={thread.id} thread={thread} onSent={() => onDone('reply')} />}
    </div>
  );
}
