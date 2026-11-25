'use client';

import { TALK_FIXED_FACE_KEY } from '@obolo/shared';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useMarkRing } from '@/components/finds/MarkRing';
import { TalkScene, type TalkItem, type TalkPerson } from '@/components/talk/TalkScene';
import { onJobs } from '@/lib/atelier/jobs';
import { useAuth } from '@/lib/auth';
import { batiDayMsgs } from '@/lib/finds/talks';
import { workMarkRef } from '@/lib/finds/works';
import { usePartner } from '@/lib/partner';
import { BATI_COLOR, batiLook, characterLook, SELF_COLOR, selfLook, selfTone } from '@/lib/talk/looks';
import { BowlFx } from './BowlFx';
import { useCastWait } from './CastClock';
import { keepFace } from './makers';
import { refreshWork, stale } from './refresh';
import { batiTalkPlace } from './temple';
import { patchTalkWork, talks } from './shelf';
import { WorkCard, WorkThumb } from './WorkCard';
import { faceTo, type Msg, type Work } from './work';

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/** the day's cards as they are now (looked at on the server), and a look at one again */
const Fresh = createContext<{ get: (id: string) => Work | undefined; look: (w: Work) => void; put: (w: Work) => void }>({ get: () => undefined, look: () => undefined, put: () => undefined });

/**
 * M-R237 §3: one day of your talk with {bati}, opened from the past talks' list — the same side-by-side talk, read only
 * (no message bar). ★ and marks can still be put on its lines. R15: in the temple before the bowl, like the talk now.
 * R16 (client 2026-11-25, iPad: 「さっき作ってもらった曲を聴きたいのに再生ボタンがない」): its cards open as the whole card
 * (▶, the lyrics, the tries) — and a card saved while it was still being made is looked at on the server when the day
 * opens and when it is opened: finished → its player, still made → its count, failed → said so.
 */
export function BatiDay({ day, at, onBack }: { day: string; /** M-R253 §5: opened at this message (a work from Bluena): the talk up to it, then 〔つづき〕 */ at?: string; onBack: () => void }) {
  const { me } = useAuth();
  const partner = usePartner();
  const ring = useMarkRing();
  const [all, setAll] = useState<Msg[]>(() => batiDayMsgs(talks(), day));
  const allRef = useRef(all);
  allRef.current = all;
  const [whole, setWhole] = useState(!at);
  const cut = at ? all.findIndex((m) => m.id === at || (m.who === 'work' && `m-${m.work.id}` === at)) : -1;
  const msgs = whole || cut < 0 ? all : all.slice(0, cut + 1);

  const put = (w: Work) => setAll((ms) => ms.map((m) => (m.who === 'work' && m.work.id === w.id ? { ...m, work: w } : m)));
  const looking = useRef(new Set<string>());
  const look = (w: Work) => {
    if (!stale(w) || looking.current.has(w.id)) return;
    looking.current.add(w.id);
    void refreshWork(w)
      .then((x) => x !== w && put(x))
      .finally(() => looking.current.delete(w.id));
  };
  const lookRef = useRef(look);
  lookRef.current = look;
  // the day opened: every card still waiting for its job is looked at (and again now and then while one is made)
  useEffect(() => {
    const all = () => {
      for (const m of allRef.current) if (m.who === 'work') lookRef.current(m.work);
    };
    all();
    const t = setInterval(all, 8000);
    // the app's job host finished one of them meanwhile
    const off = onJobs((e) => {
      if (e?.work && (e.kind === 'done' || e.kind === 'failed') && allRef.current.some((m) => m.who === 'work' && m.work.id === e.w.card.id)) put({ ...e.work, id: e.w.card.id });
    });
    return () => {
      clearInterval(t);
      off();
    };
  }, []);

  const people: TalkPerson[] = [
    { id: 'bati', name: partner.name, look: batiLook(me?.bati, partner.face), color: BATI_COLOR },
    { id: 'me', name: me?.displayName ?? '', look: selfLook(me), color: SELF_COLOR, tone: selfTone(me), self: true, avatar: me?.lookIcon },
  ];
  const items: TalkItem[] = msgs.map((m) =>
    m.who === 'work'
      ? { id: m.id, who: 'bati', text: m.work.status === 'making' ? '' : (m.work.title ?? ''), mark: { kind: 'local', id: m.id }, card: { label: m.work.title ?? m.work.prompt, thumb: <WorkThumb w={m.work} />, full: <DayCard id={m.work.id} fallback={m.work} /> } }
      : { id: m.id, who: m.who === 'me' ? 'me' : 'bati', text: m.text, mark: { kind: 'local', id: m.id } },
  );
  // R18: a work of the day still being made — the bowl glows divinely and the clock counts down (the refreshed time)
  const reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const wait = useCastWait(msgs, reducedMotion);
  const get = (id: string) => allRef.current.find((m): m is Extract<Msg, { who: 'work' }> => m.who === 'work' && m.work.id === id)?.work;
  return (
    <Fresh.Provider value={{ get, look, put }}>
      <div className="relative flex min-h-0 flex-1 flex-col" style={{ fontFamily: SERIF }}>
        <div className="flex items-center gap-2 px-3.5 pb-1.5">
          <button onClick={onBack} aria-label="会話の一覧" className="text-lg text-amber-100/70">
            ‹
          </button>
          <p className="min-w-0 flex-1 truncate text-[13px] tracking-[0.18em] text-amber-100/90">{partner.name}</p>
          <span className="text-[11px] tracking-[0.12em] text-amber-100/60">{day.slice(5).replace('-', '/')}</span>
        </div>
        <TalkScene
          people={people}
          items={items}
          framing="ots"
          {...batiTalkPlace()}
          placeFx={(m) => <BowlFx state={wait.rise ? { rise: wait.rise } : wait.active ? 'divine' : 'idle'} at={m.at} scale={m.scale} reduced={reducedMotion} tint={wait.palette} paused={wait.hidden} />}
          stage={wait.stage}
          top={4}
          fixedSelfFace={me?.story?.[TALK_FIXED_FACE_KEY] === '1'}
          onRing={(it, at) => it.mark && ring.open(it.mark.kind, it.mark.id, at)}
        />
        {!whole && cut >= 0 && cut < all.length - 1 && (
          <button onClick={() => setWhole(true)} className="absolute left-1/2 top-12 z-20 -translate-x-1/2 rounded-full border border-amber-200/40 bg-black/55 px-4 py-1.5 text-xs tracking-[0.2em] text-amber-100 backdrop-blur">
            つづき
          </button>
        )}
        {ring.node}
      </div>
    </Fresh.Provider>
  );
}

/** a past day's card opened big: the whole card as it is now (read only: its tries can be looked at, nothing made) */
function DayCard({ id, fallback }: { id: string; fallback: Work }) {
  const c = useContext(Fresh);
  const ring = useMarkRing();
  const w = c.get(id) ?? fallback;
  // opened: looked at again on the server (a card saved while it was being made)
  useEffect(() => c.look(w), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const face = (i: number) => {
    const next = faceTo(w, i);
    c.put(next);
    keepFace(next);
    patchTalkWork(undefined, next);
  };
  return (
    <>
      <WorkCard w={w} busy={false} onWear={() => undefined} onPick={() => undefined} onRecorded={() => undefined} onFace={face} onRing={w.status === 'ready' ? (at) => ring.open(workMarkRef(w).kind, workMarkRef(w).id, at) : undefined} />
      {ring.node}
    </>
  );
}
