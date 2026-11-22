'use client';

import type { Me } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { LineIcon } from '@/components/LineIcon';
import { useAuth } from '@/lib/auth';
import { openKinds, type AtelierKind } from '@/lib/atelier/unlock';
import { usePartner } from '@/lib/partner';
import { AtelierChat, newTalk } from './AtelierChat';
import { BatiDay } from './DayReplay';
import { useAtelierCtx } from './ctx';
import { BluenaDrawer, ThreadsDrawer } from './Drawers';
import { talkWith, type Talk } from './shelf';
import type { Work } from './work';
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
export function Shell({ first, threads = [], renderThread, story, onBack, open }: { first: AtelierKind | null; threads?: ThreadInfo[]; renderThread?: RenderThread; story?: StoryMode; /** the page's way out, in the talk's own bar */ onBack?: () => void; /** a thread (and one day of its past) to open with, from another talk's drawer (?thread=&day=) */ open?: { thread: string; day?: string; /** M-R253 §5: the message to open the day at */ at?: string; /** M-R253 §4: the talk whose card waits for this job */ job?: string } }) {
  const { me } = useAuth();
  const partner = usePartner();
  const ctx = useAtelierCtx();
  const day = me?.journeyDay;
  const bluena = !!story?.bluena || hasBluena(me);
  const [thread, setThread] = useState<string>(open?.thread || BATI_THREAD);
  // M-R253 §4: opened from the toast / the push: the talk with that card (else a new talk)
  const [talk, setTalk] = useState<Talk>(() => (open?.job && talkWith((w) => w.job?.id === open.job || w.id === open.job)) || newTalk(day));
  const [firstTalk] = useState(talk.id);
  const [drawer, setDrawer] = useState<'left' | 'right' | null>(null);
  const unread = threads.some((t) => t.id !== BATI_THREAD && !!t.unread);
  // M-R237: one day of a thread's past talk, opened from the left drawer (read only)
  const [past, setPast] = useState<{ thread: string; day: string; at?: string } | null>(open?.day ? { thread: open.thread || BATI_THREAD, day: open.day, at: open.at } : null);
  // the toast tapped while here: that card's talk
  useEffect(() => {
    const go = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const t = talkWith((w) => w.job?.id === id) ?? talkWith((w) => !!w.versions && w.status === 'ready' && w.id === id);
      if (!t) return;
      setPast(null);
      setThread(BATI_THREAD);
      setTalk(t);
    };
    window.addEventListener('obolo:openjob', go);
    return () => window.removeEventListener('obolo:openjob', go);
  }, []);
  /** M-R253 §5: a work tapped in Bluena → the talk it was made in, at that moment */
  const toOrigin = (w: Work) => {
    const o = w.origin;
    if (!o?.day) return false;
    setDrawer(null);
    setThread(o.thread || BATI_THREAD);
    setPast({ thread: o.thread || BATI_THREAD, day: o.day, at: o.msgId });
    return true;
  };
  const closePast = () => {
    setPast(null);
    setDrawer('left');
  };
  const tctx = { openList: () => setDrawer('left'), openBluena: bluena ? () => setDrawer('right') : undefined, day: past && past.thread === thread ? past.day : undefined, closeDay: closePast };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* the talk draws its own top bar (M-R232, the prototype's glass buttons); this row stays for a past day's talk */}
      {past && past.thread === BATI_THREAD && <div className="flex items-center justify-between px-3 pb-1">
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
      </div>}

      {past && past.thread === BATI_THREAD ? (
        <BatiDay key={`${past.day}-${past.at ?? ''}`} day={past.day} at={past.at} onBack={closePast} />
      ) : thread === BATI_THREAD ? (
        <AtelierChat key={talk.id} first={talk.id === firstTalk && !open?.job ? first : null} talk={talk} story={talk.id === firstTalk ? story : undefined} onList={() => setDrawer('left')} onBluena={bluena ? () => setDrawer('right') : undefined} unread={unread} onBack={onBack} />
      ) : (
        <div key={tctx.day ?? 'now'} className="relative flex min-h-0 flex-1 flex-col">
          {renderThread?.(thread, tctx) ?? null}
        </div>
      )}

      {drawer === 'left' && (
        <ThreadsDrawer
          bati={{ name: partner.name, face: partner.face }}
          threads={threads}
          current={thread}
          talkId={talk.id}
          onDay={(id, d) => {
            setPast({ thread: id, day: d });
            setThread(id);
            setDrawer(null);
          }}
          onThread={(id) => {
            setPast(null);
            setThread(id);
            setDrawer(null);
          }}
          onTalk={(t) => {
            setPast(null);
            setTalk(t);
            setThread(BATI_THREAD);
            setDrawer(null);
          }}
          onNew={() => {
            setPast(null);
            setTalk(newTalk(day));
            setThread(BATI_THREAD);
            setDrawer(null);
          }}
          onClose={() => setDrawer(null)}
        />
      )}
      {drawer === 'right' && bluena && (
        <BluenaDrawer
          kinds={openKinds(day)}
          day={day}
          ctx={ctx}
          onClose={() => setDrawer(null)}
          onOrigin={toOrigin}
          // M-R253 §3: dragged into the chat → material ({bati}'s thread)
          onMaterial={(w) => {
            setDrawer(null);
            setPast(null);
            setThread(BATI_THREAD);
            setTimeout(() => window.dispatchEvent(new CustomEvent('obolo:material', { detail: w })), 50);
          }}
        />
      )}
    </div>
  );
}
