'use client';

import type { Me } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { LineIcon } from '@/components/LineIcon';
import { useAuth } from '@/lib/auth';
import type { AtelierKind } from '@/lib/atelier/unlock';
import { usePartner } from '@/lib/partner';
import { AtelierChat, newTalk } from './AtelierChat';
import { BatiDay } from './DayReplay';
import { ThreadsDrawer } from './Drawers';
import { talkWith, type Talk } from './shelf';
import type { StoryMode } from './story';
import { BATI_THREAD } from './threads';

/**
 * Bluena is handed over on the morning of day 3 (D04-S002 sets d3.f_d04_bluena); before that there is no Bluena device at
 * all (M-R212). Day 4 on is a fallback in case the flag was not kept.
 */
export const hasBluena = (me: Me | null) => !me || me.story?.['d3.f_d04_bluena'] === 'true' || me.journeyDay >= 4;

/**
 * 月で作る's frame (M-R211/M-R212): the chat in the centre, {bati}'s past talks on the left (R15: {bati}'s only — the ダチ
 * are the ダチ tab's, MoonTabs DachiTab), Bluena (the device, R10: bottom left; no right drawer any more) from day 3.
 * {bati}'s thread is AtelierChat; a past day of it is BatiDay (in the same temple).
 */
export function Shell({ first, story, onBack, open, banner, onDevice }: { first: AtelierKind | null; /** R10: the Bluena device */ onDevice?: () => void; /** the Moon chat's tabs (MoonTabs), under the talk's bar */ banner?: React.ReactNode; story?: StoryMode; /** the page's way out, in the talk's own bar */ onBack?: () => void; /** a thread (and one day of its past) to open with, from another talk's drawer (?thread=&day=) */ open?: { thread: string; day?: string; /** M-R253 §5: the message to open the day at */ at?: string; /** M-R253 §4: the talk whose card waits for this job */ job?: string } }) {
  const { me } = useAuth();
  const partner = usePartner();
  // M-R253 §4: opened from the toast / the push: the talk with that card (else a new talk)
  const [talk, setTalk] = useState<Talk>(() => (open?.job && talkWith((w) => w.job?.id === open.job || w.id === open.job)) || newTalk(me, partner.isBati));
  const [firstTalk] = useState(talk.id);
  // M-R253 §6 ⑤: the talk opened from the toast / the push ({bati} says its word for coming back)
  const [welcomeTalk, setWelcomeTalk] = useState<string | null>(open?.job ? talk.id : null);
  const [drawer, setDrawer] = useState<'left' | null>(null);
  // M-R237: one day of a thread's past talk, opened from the left drawer (read only)
  const [past, setPast] = useState<{ thread: string; day: string; at?: string } | null>(open?.day ? { thread: BATI_THREAD, day: open.day, at: open.at } : null);
  // the toast tapped while here: that card's talk
  useEffect(() => {
    const go = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const t = talkWith((w) => w.job?.id === id) ?? talkWith((w) => !!w.versions && w.status === 'ready' && w.id === id);
      if (!t) return;
      setPast(null);
      setWelcomeTalk(t.id);
      setTalk(t);
    };
    window.addEventListener('obolo:openjob', go);
    return () => window.removeEventListener('obolo:openjob', go);
  }, []);
  const closePast = () => {
    setPast(null);
    setDrawer('left');
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* the talk draws its own top bar (M-R232, the prototype's glass buttons); this row stays for a past day's talk */}
      {past && <div className="flex items-center justify-between px-3 pb-1">
        <button onClick={() => setDrawer('left')} aria-label="会話" className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-amber-100/80">
          <LineIcon id="chat" className="h-5 w-5" />
        </button>
      </div>}

      {past ? (
        <BatiDay key={`${past.day}-${past.at ?? ''}`} day={past.day} at={past.at} onBack={closePast} />
      ) : (
        <AtelierChat key={talk.id} first={talk.id === firstTalk && !open?.job ? first : null} talk={talk} story={talk.id === firstTalk ? story : undefined} onList={() => setDrawer('left')} onBack={onBack} welcome={welcomeTalk === talk.id} banner={banner} onDevice={onDevice} />
      )}

      {drawer === 'left' && (
        <ThreadsDrawer
          bati={{ name: partner.name, face: partner.face }}
          current={BATI_THREAD}
          talkId={talk.id}
          onDay={(_, d) => {
            setPast({ thread: BATI_THREAD, day: d });
            setDrawer(null);
          }}
          onThread={() => {
            setPast(null);
            setDrawer(null);
          }}
          onTalk={(t) => {
            setPast(null);
            setTalk(t);
            setDrawer(null);
          }}
          onNew={() => {
            setPast(null);
            setTalk(newTalk(me, partner.isBati));
            setDrawer(null);
          }}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
