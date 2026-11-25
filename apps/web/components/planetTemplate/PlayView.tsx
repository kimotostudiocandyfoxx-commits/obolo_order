'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlanetTemplateConfig } from '@/lib/planetTemplate/config';
import type { HomePerson } from '@/lib/planetTemplate/people';
import { defaultOpener, type WorkOpener } from './WorkView';
import s from './PlanetTemplate.module.css';

type Phase = 'in' | 'open' | 'out';
/** where a visitor comes from, sits, leaves to (fractions of the screen) and how big it is there */
const FROM = { x: 0.4, y: 0.2, size: 0.3 };
const SIT = { x: 0.18, y: 0.86, size: 1 };
const AWAY = { x: 0.9, y: 0.15, size: 0.3 };
const ARRIVE_MS = 900;
const LEAVE_MS = 800;

/**
 * 3-3 the view from your place: the screen turns to what you see from your place, your back at the bottom right (only
 * its left half on the screen; GET /me lookBack, else the stand-in). The ダチ's works come one at a time — the maker's
 * figure flies in, the work opens, then it goes and the next comes. The last one heard → it ends by itself. ■ or a
 * tap on the screen stops it (the owner of this view: the ■ is the home's play button).
 */
export function PlayView({
  cfg,
  people,
  back,
  opener = defaultOpener,
  onEnd,
  openProfile,
}: {
  cfg: PlanetTemplateConfig;
  people: HomePerson[];
  back: string | null;
  opener?: WorkOpener;
  onEnd: () => void;
  openProfile: (id: string) => void;
}) {
  const [on, setOn] = useState(false);
  const [k, setK] = useState(-1);
  const [phase, setPhase] = useState<Phase>('in');
  const [at, setAt] = useState(FROM);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const end = useRef(onEnd);
  end.current = onEnd;

  useEffect(() => {
    const T = (f: () => void, ms: number) => timers.current.push(setTimeout(f, ms));
    const one = (i: number) => {
      if (i >= people.length) return end.current();
      setK(i);
      setPhase('in');
      setAt(FROM);
      // two frames: the visitor is placed at FROM, then moves (its transition)
      T(() => setAt(SIT), 30);
      T(() => setPhase('open'), ARRIVE_MS);
      T(() => {
        setPhase('out');
        setAt(AWAY);
      }, ARRIVE_MS + cfg.holdMs);
      T(() => one(i + 1), ARRIVE_MS + cfg.holdMs + LEAVE_MS);
    };
    requestAnimationFrame(() => setOn(true));
    T(() => one(0), cfg.introMs);
    const ts = timers.current;
    return () => {
      ts.forEach(clearTimeout);
      timers.current = [];
    };
  }, [people, cfg.holdMs, cfg.introMs]);

  const p = k >= 0 ? people[k] : null;
  const work = p?.works[0];
  return (
    <div className={`${s.hv} ${on ? s.on : ''} ${phase === 'open' ? s.zoom : ''}`} onClick={() => end.current()} data-testid="play-view">
      <div className={s.hvbg} style={{ backgroundImage: `url(${cfg.art.view})` }} />
      <div className={s.vig} />
      {back && (
        <div className={s.back} data-testid="play-back">
          <img src={back} alt="" draggable={false} />
        </div>
      )}
      {p && (
        <div
          key={`${p.id}-${k}`}
          className={s.visitor}
          style={{ transform: `translate3d(${at.x * 100}cqw, ${at.y * 100}cqh, 0) scale(${at.size})`, opacity: phase === 'out' ? 0 : 1 }}
        >
          <img src={p.figure ?? p.sprite} alt="" draggable={false} />
          <span className={s.nm}>{p.name}</span>
        </div>
      )}
      {p && work && phase === 'open' && opener({ person: p, work, inPlay: true, close: () => undefined, openProfile })}
    </div>
  );
}
