'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PathPoint, PlanetTemplateConfig } from '@/lib/planetTemplate/config';
import type { HomePerson } from '@/lib/planetTemplate/people';
import { soundScope } from '@/lib/planetTemplate/sfx';
import { musicOf } from '@/lib/planetTemplate/sound';
import { defaultOpener, type FigureSlot, type WorkOpener } from './WorkView';
import s from './PlanetTemplate.module.css';

type Phase = 'in' | 'open' | 'out';

/** fireflies over the view at night (Jupiter's porch, playJ's .ff2): each drifts and blinks at its own pace */
function Fireflies({ n = 18 }: { n?: number }) {
  const [dots] = useState(() =>
    Array.from({ length: n }, () => ({ l: Math.random() * 100, t: 10 + Math.random() * 80, d: 4 + Math.random() * 4, b: 1 + Math.random() * 1.4, fx: Math.random() * 60 - 30, fy: Math.random() * -60 })),
  );
  return (
    <div className={s.flies} aria-hidden data-testid="fireflies">
      {dots.map((f, j) => (
        <i key={j} style={{ left: `${f.l}%`, top: `${f.t}%`, ['--d' as string]: `${f.d}s`, ['--b' as string]: `${f.b}s`, ['--fx' as string]: `${f.fx}px`, ['--fy' as string]: `${f.fy}px` }} />
      ))}
    </div>
  );
}
/** a planet's own play stage (Saturn: the kororins ride the record's groove): it shows the works and says when all are done */
export interface PlayStageProps {
  cfg: PlanetTemplateConfig;
  people: HomePerson[];
  onEnd: (finished: boolean) => void;
  openProfile: (id: string) => void;
}
export type PlayStage = (o: PlayStageProps) => ReactNode;
/** you dance out of your place for this long before the view turns (the prototype's playM: 0.9 s) */
const DANCE_MS = 900;
/** a work the planet shows until it is done never stays longer than this (a song that never ends) */
const DONE_MAX_MS = 8 * 60_000;

/**
 * 3-3 the view from your place: the screen turns to what you see from your place, your back at the bottom right (only
 * its left half on the screen; GET /me lookBack, else the stand-in). The ダチ's works come one at a time — the maker's
 * figure comes in, the work opens, then it goes and the next comes. The last one seen → it ends by itself (`finished`).
 * ■ or a tap on the screen stops it (the owner of this view: the ■ is the home's play button).
 * Per planet (config.play): the path the visitor takes, whether a work stays until it is done (Mercury: the whole song),
 * the view at night with fireworks, and you dancing out of your place first (Mercury, 02 §3).
 */
export function PlayView({
  cfg,
  people,
  back,
  dancer,
  opener = defaultOpener,
  figure,
  stage,
  onEnd,
  openProfile,
}: {
  cfg: PlanetTemplateConfig;
  people: HomePerson[];
  back: string | null;
  /** you, dancing out of your place (Mercury); null: the view turns at once */
  dancer?: string | null;
  opener?: WorkOpener;
  /** the planet's way of drawing a figure (Jupiter: flapping wings); none: the picture */
  figure?: FigureSlot;
  /** the planet's own stage in place of the visitors (Saturn's groove) */
  stage?: PlayStage;
  onEnd: (finished: boolean) => void;
  openProfile: (id: string) => void;
}) {
  const path = cfg.play.path;
  const dance = cfg.play.dance && dancer ? cfg.play.dance : null;
  const [on, setOn] = useState(false);
  const [k, setK] = useState(-1);
  const [phase, setPhase] = useState<Phase>('in');
  const [at, setAt] = useState<PathPoint>(path.from);
  const [moveMs, setMoveMs] = useState(0);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; c: string }[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const done = useRef<(() => void) | null>(null);
  const end = useRef(onEnd);
  end.current = onEnd;

  useEffect(() => {
    const T = (f: () => void, ms: number) => timers.current.push(setTimeout(f, ms));
    // the sounds (lib/planetTemplate/sound.ts cuesFor): ▶'s music (Saturn's club, Jupiter's festival), you jumping out,
    // the view turning, each visitor and their work; all stop with the view (■ / the end)
    const snd = soundScope();
    const planet = cfg.planet;
    snd.music(musicOf(planet));
    if (dance) snd.cue(planet, 'playDance');
    const leave = (i: number) => {
      done.current = null;
      setPhase('out');
      setMoveMs(path.leaveMs);
      setAt(path.away);
      T(() => one(i + 1), path.leaveMs);
    };
    const one = (i: number) => {
      if (i >= people.length) return end.current(true);
      snd.cue(planet, 'playVisit');
      setK(i);
      setPhase('in');
      setMoveMs(0);
      setAt(path.from);
      // two frames: the visitor is placed at `from`, then moves (its transition)
      T(() => {
        setMoveMs(path.arriveMs);
        setAt(path.sit);
      }, 40);
      T(() => {
        snd.cue(planet, 'playOpen');
        setPhase('open');
        if (path.front) {
          setMoveMs(450);
          setAt(path.front);
        }
        if (cfg.play.untilDone) {
          let left = false;
          done.current = () => {
            if (left) return;
            left = true;
            leave(i);
          };
          T(() => done.current?.(), DONE_MAX_MS);
        } else T(() => leave(i), cfg.holdMs);
      }, path.arriveMs + 40);
    };
    T(
      () => {
        setOn(true);
        snd.cue(planet, 'playTurn');
      },
      dance ? (dance.ms ?? DANCE_MS) : 16,
    );
    if (!stage) T(() => one(0), cfg.introMs);
    let fw: ReturnType<typeof setInterval> | null = null;
    if (cfg.play.fireworks) {
      let n = 0;
      const cols = ['#ff5fa2', '#ffd84d', '#6fe3ff', '#b48cff', '#7dffb0', '#ff8a4d'];
      fw = setInterval(() => {
        if (Math.random() > 0.8) return;
        const id = ++n;
        snd.sfx('thump');
        setBursts((b) => [...b.slice(-3), { id, x: 0.15 + Math.random() * 0.7, y: 0.14 + Math.random() * 0.16, c: cols[Math.floor(Math.random() * cols.length)] }]);
        T(() => setBursts((b) => b.filter((x) => x.id !== id)), 1600);
      }, 1300);
    }
    const ts = timers.current;
    return () => {
      ts.forEach(clearTimeout);
      timers.current = [];
      if (fw) clearInterval(fw);
      snd.stop();
    };
  }, [people, cfg, path, dance, stage]);

  const p = k >= 0 ? people[k] : null;
  const work = p?.works[0];
  const fig = p ? (p.figure ?? cfg.standIn?.(p.id) ?? p.sprite) : null;
  return (
    <>
      {dance && dancer && (
        <div className={`${s.dancer} ${dance.from === 'sky' ? s.fall : ''}`} style={{ left: `${dance.x * 100}%`, top: `${dance.y * 100}%`, animationDuration: dance.ms ? `${dance.ms}ms` : undefined }} data-testid="play-dancer">
          <img src={dancer} alt="" draggable={false} />
        </div>
      )}
      <div className={`${s.hv} ${on ? s.on : ''} ${phase === 'open' && !stage ? s.zoom : ''} ${cfg.play.night ? s.night : ''}`} onClick={() => end.current(false)} data-testid="play-view" data-planet={cfg.planet}>
        <div className={s.hvbg} style={{ backgroundImage: `url(${cfg.art.view})` }} />
        <div className={s.vig} />
        {cfg.play.night && <div className={s.glow} />}
        {cfg.play.fireflies && <Fireflies />}
        {bursts.map((b) => (
          <div key={b.id} className={s.burst} style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, ['--c' as string]: b.c }}>
            {Array.from({ length: 24 }, (_, j) => (
              <i key={j} style={{ ['--a' as string]: `${(j / 24) * 360}deg`, ['--r' as string]: `${50 + ((j * 37) % 30)}px` }} />
            ))}
          </div>
        ))}
        {stage?.({ cfg, people, onEnd: (f) => end.current(f), openProfile })}
        {back && (
          <div className={s.back} data-testid="play-back">
            <img src={back} alt="" draggable={false} />
          </div>
        )}
        {p && fig && (
          <div
            key={`${p.id}-${k}`}
            className={`${s.visitor} ${phase === 'open' ? s.bobbing : ''} ${path.front ? s.front : ''}`}
            style={{ transform: `translate3d(${at.x * 100}cqw, ${at.y * 100}cqh, 0) scale(${at.size})`, opacity: phase === 'out' ? 0 : 1, transitionDuration: `${moveMs}ms, ${phase === 'out' ? 1000 : 500}ms` }}
          >
            {figure && (p.figure || cfg.standIn) ? figure({ src: fig, i: k, fill: true, wings: p.figure ? p.wings : null }) : <img src={fig} alt="" draggable={false} />}
            {phase !== 'open' && <span className={s.nm}>{p.name}</span>}
          </div>
        )}
        {p && work && phase === 'open' && opener({ person: p, work, inPlay: true, where: 'play', figure: fig, close: () => undefined, onDone: () => done.current?.(), openProfile })}
      </div>
    </>
  );
}
