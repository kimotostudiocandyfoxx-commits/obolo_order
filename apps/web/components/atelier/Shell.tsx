'use client';

import type { Me } from '@obolo/shared';
import { useState } from 'react';
import { LineIcon } from '@/components/LineIcon';
import { useAuth } from '@/lib/auth';
import { openKinds, type AtelierKind } from '@/lib/atelier/unlock';
import { usePartner } from '@/lib/partner';
import { AtelierChat, newTalk } from './AtelierChat';
import { useAtelierCtx } from './ctx';
import { BluenaDrawer, ThreadsDrawer } from './Drawers';
import type { Talk } from './shelf';
import type { StoryMode } from './story';
import { BATI_THREAD, type RenderThread, type ThreadInfo } from './threads';

/**
 * Bluena is handed over on the morning of day 3 (D04-S002 sets d3.f_d04_bluena); before that there is no right drawer at
 * all (M-R212). Day 4 on is a fallback in case the flag was not kept.
 */
export const hasBluena = (me: Me | null) => !me || me.story?.['d3.f_d04_bluena'] === 'true' || me.journeyDay >= 4;

/**
 * 月で作る's frame (M-R211/M-R212): the chat in the centre, the conversations on the left ({bati} first, then the ダチ
 * threads given in `threads`), Bluena on the right from day 3. {bati}'s thread is AtelierChat; any other thread is drawn
 * by `renderThread` in the same place (see threads.ts).
 */
export function Shell({ first, threads = [], renderThread, story }: { first: AtelierKind | null; threads?: ThreadInfo[]; renderThread?: RenderThread; story?: StoryMode }) {
  const { me } = useAuth();
  const partner = usePartner();
  const ctx = useAtelierCtx();
  const day = me?.journeyDay;
  const bluena = !!story?.bluena || hasBluena(me);
  const [thread, setThread] = useState<string>(BATI_THREAD);
  const [talk, setTalk] = useState<Talk>(() => newTalk(day));
  const [firstTalk] = useState(talk.id);
  const [drawer, setDrawer] = useState<'left' | 'right' | null>(null);
  const unread = threads.some((t) => t.id !== BATI_THREAD && !!t.unread);
  const tctx = { openList: () => setDrawer('left'), openBluena: bluena ? () => setDrawer('right') : undefined };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 pb-1">
        <button onClick={() => setDrawer('left')} aria-label="会話" className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-amber-100/80">
          <LineIcon id="chat" className="h-5 w-5" />
          {unread && <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-sky-300" />}
        </button>
        {bluena && (
          <button onClick={() => setDrawer('right')} aria-label="ブルーナ" className="block h-9 w-9 overflow-hidden rounded-full border border-sky-200/40 bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ui/bluena-icon.webp" alt="" className="h-full w-full scale-125 object-cover" />
          </button>
        )}
      </div>

      {thread === BATI_THREAD ? (
        <AtelierChat key={talk.id} first={talk.id === firstTalk ? first : null} talk={talk} story={talk.id === firstTalk ? story : undefined} />
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">{renderThread?.(thread, tctx) ?? null}</div>
      )}

      {drawer === 'left' && (
        <ThreadsDrawer
          bati={{ name: partner.name, face: partner.face }}
          threads={threads}
          current={thread}
          talkId={talk.id}
          onThread={(id) => {
            setThread(id);
            setDrawer(null);
          }}
          onTalk={(t) => {
            setTalk(t);
            setThread(BATI_THREAD);
            setDrawer(null);
          }}
          onNew={() => {
            setTalk(newTalk(day));
            setThread(BATI_THREAD);
            setDrawer(null);
          }}
          onClose={() => setDrawer(null)}
        />
      )}
      {drawer === 'right' && bluena && <BluenaDrawer kinds={openKinds(day)} ctx={ctx} onClose={() => setDrawer(null)} />}
    </div>
  );
}
