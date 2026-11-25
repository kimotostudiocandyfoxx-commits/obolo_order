'use client';

import type { HomeWork } from '@obolo/shared';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  grooveAt,
  grooveEndMs,
  grooveRides,
  pileStart,
  pileStep,
  POP,
  RECORD_LABEL,
  rideAngle,
  ridePopMs,
  VOICE_AFTER_POP_MS,
  type PileBall,
} from '@/lib/planetTemplate/saturn';
import type { TemplateHooks } from '../PlanetTemplateHome';
import type { PlayStageProps } from '../PlayView';
import type { ProfilePerson } from '../Profile';
import { defaultOpener, type OpenWork, type WorkOpener } from '../WorkView';
import m from './Saturn.module.css';

/** the pictures of the profile's 2D stage (the prototype's sat6-floor / sat6-spk) */
const STAGE_FLOOR = '/planets/saturn/floor.webp';
const STAGE_SPEAKER = '/planets/saturn/speaker.webp';

/** what Saturn's hooks need: a person's past kororins for their profile (GET /planet-home/saturn/person/:id, or the sample) */
export interface SaturnDeps {
  past: (p: ProfilePerson) => Promise<HomeWork[]>;
  /** the profile room's picture (the blurred club behind the stage) */
  room: string;
}

/** a voice plays once (a voice in the text-to-speech queue, "tts:", has no sound of its own) */
function playVoice(w: HomeWork | undefined): HTMLAudioElement | null {
  const url = w?.url;
  if (!url || url.startsWith('tts:')) return null;
  try {
    const a = new Audio(url);
    a.play().catch(() => undefined);
    return a;
  } catch {
    return null;
  }
}
const wordsOf = (w: HomeWork | undefined) => (w?.text || w?.title || '').trim();
const chibiOf = (p: { chibi?: string | null; figure: string | null }) => p.chibi ?? p.figure ?? '';

/** the splash of a pop: 14 drops flying out (the prototype's .drop) */
function Drops({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <>
      {Array.from({ length: 14 }, (_, k) => {
        const a = (k / 14) * Math.PI * 2;
        const d = r * (1.2 + ((k * 37) % 10) / 12.5);
        return <i key={k} className={m.drop} style={{ left: x, top: y, ['--dx' as string]: `${Math.cos(a) * d}px`, ['--dy' as string]: `${Math.sin(a) * d}px` }} />;
      })}
    </>
  );
}

/**
 * 04 §1 a kororin tapped on the home: it pops where it is, the chibi jumps out and says its words in the maker's voice
 * (the words above, 「by 名前」 small below — that opens their profile); then it waves and goes home into the record,
 * and the next in the queue falls in. The home stays as it is (no zoom, no dim).
 */
function KororinPop({ o }: { o: OpenWork }) {
  const [phase, setPhase] = useState<'pop' | 'talk' | 'quiet' | 'away'>('pop');
  const close = useRef(o.close);
  close.current = o.close;
  useEffect(() => {
    let voice: HTMLAudioElement | null = null;
    const ts = [
      setTimeout(() => setPhase('talk'), POP.bubbleMs),
      setTimeout(() => (voice = playVoice(o.work)), POP.voiceMs),
      setTimeout(() => setPhase('quiet'), POP.quietMs),
      setTimeout(() => setPhase('away'), POP.awayMs),
      setTimeout(() => close.current(), POP.doneMs),
    ];
    return () => {
      ts.forEach(clearTimeout);
      voice?.pause();
    };
  }, [o.work]);
  const at = o.from ?? { x: 195, y: 520, size: 1 };
  const words = wordsOf(o.work);
  return (
    <div className={m.popLayer} data-testid="work-view" data-phase={phase}>
      {o.figure && (
        <div className={m.popBall} style={{ transform: `translate3d(${at.x}px,${at.y}px,0) scale(${at.size})` }}>
          <img src={o.figure} alt="" draggable={false} />
        </div>
      )}
      <Drops x={at.x} y={at.y} r={29 * at.size} />
      <div
        className={`${m.chibi} ${phase === 'quiet' ? m.wave : ''} ${phase === 'away' ? m.away : ''}`}
        style={phase === 'away' ? { left: `${RECORD_LABEL.x * 100}%`, top: `${RECORD_LABEL.y * 100}%` } : { left: `clamp(64px, ${at.x}px, calc(100% - 64px))`, top: at.y }}
        data-testid="pop-chibi"
      >
        <img src={chibiOf(o.person)} alt="" draggable={false} />
      </div>
      {phase === 'talk' && (
        <div className={m.bub} style={{ left: `clamp(24%, ${at.x}px, 76%)`, top: at.y - 118 }} data-testid="pop-words">
          {words ? `「${words}」` : '♪'}
          <button
            type="button"
            className={m.by}
            onClick={(e) => {
              e.stopPropagation();
              o.openProfile(o.person.id);
            }}
          >
            by {o.person.name}
          </button>
        </div>
      )}
    </div>
  );
}

/** Saturn's opener: on the home the kororin pops where it is; elsewhere (not used by Saturn's own stages) the default */
export const saturnOpener: WorkOpener = (o) => (o.where === 'home' || !o.where ? <KororinPop key={o.work.id} o={o} /> : defaultOpener(o));

/** the size of an element (px), kept up to date */
function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ W: 390, H: 844 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setBox({ W: el.clientWidth || 390, H: el.clientHeight || 844 });
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...box };
}

/**
 * 04 §2 ▶ the groove: on the close-up of the record the kororins ride its groove from the back (top, small) round the
 * left arc to the front (bottom, big), three or four at once; each pops on the left arc, the chibi talks (the words over
 * it, its voice) and keeps riding off. The first three start partway along, so the first talks at about 2.3 s; then
 * one every 2.6 s. All ridden off → it ends (「全部聞いたね」).
 */
function Groove({ cfg, people, onEnd, openProfile }: PlayStageProps) {
  const { ref, W, H } = useBox<HTMLDivElement>();
  const [ms, setMs] = useState(0);
  const rides = useRef(grooveRides(people.length));
  const voiced = useRef(new Set<number>());
  const voices = useRef<HTMLAudioElement[]>([]);
  const ended = useRef(false);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    rides.current = grooveRides(people.length);
    voiced.current = new Set();
    ended.current = false;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = now - t0;
      setMs(t);
      for (const r of rides.current)
        if (!voiced.current.has(r.k) && t >= ridePopMs(r) + VOICE_AFTER_POP_MS) {
          voiced.current.add(r.k);
          const a = playVoice(people[r.k]?.works[0]);
          if (a) voices.current.push(a);
        }
      if (t > grooveEndMs(people.length) && !ended.current) {
        ended.current = true;
        end.current(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const vs = voices.current;
    return () => {
      cancelAnimationFrame(raf);
      vs.forEach((a) => a.pause());
    };
  }, [people]);
  return (
    <div ref={ref} className={m.groove} data-testid="groove">
      {rides.current.map((r) => {
        const a = rideAngle(r, ms);
        const p = people[r.k];
        if (a == null || !p) return null;
        const at = grooveAt(a, W, H);
        const popAt = ridePopMs(r);
        const popped = ms >= popAt;
        const fig = p.figure ?? cfg.standIn?.(p.id) ?? p.sprite;
        const spin = -((ms - r.startMs) / 1000) * 140;
        const words = wordsOf(p.works[0]);
        return (
          <div key={r.k} className={`${m.orb} ${popped ? m.popped : ''}`} style={{ transform: `translate3d(${at.x}px,${at.y}px,0) translate(-50%,-50%) scale(${at.s})`, zIndex: popped ? 50 + r.k : 2 }} data-testid="orb">
            {popped ? <img className={m.orbChibi} src={chibiOf(p)} alt="" draggable={false} /> : <img className={m.orbBall} src={fig} alt="" draggable={false} style={{ transform: `rotate(${spin}deg)` }} />}
            {popped && ms - popAt < 700 && <Drops x={60} y={60} r={50} />}
            {popped && ms >= popAt + VOICE_AFTER_POP_MS && (
              <div className={m.bubo} data-testid="orb-words">
                {words ? `「${words}」` : '♪'}
                <button
                  type="button"
                  className={m.by}
                  onClick={(e) => {
                    e.stopPropagation();
                    openProfile(p.id);
                  }}
                >
                  by {p.name}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 04 §3 the profile: a 2D stage without depth — the stone ground seen from the side, a speaker at each side, the club
 * blurred behind. The person's past kororins fall from above and pile up (the newest is NEW). Tap one: it pops and
 * the chibi says its words in their voice. Drag one: throw it about.
 */
function Pile({ person, deps }: { person: ProfilePerson; deps: SaturnDeps }) {
  const { ref, W, H } = useBox<HTMLDivElement>();
  const [works, setWorks] = useState<HomeWork[]>(person.works);
  useEffect(() => {
    let live = true;
    deps
      .past(person)
      .then((w) => live && w.length && setWorks(w))
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // the person shown (not each new copy of them the home hands down)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id, deps]);
  // ball j (oldest first, falls first) ↔ works newest first
  const n = works.length;
  const workOf = (j: number) => works[n - 1 - j];
  const balls = useRef<PileBall[]>([]);
  const els = useRef(new Map<number, HTMLDivElement>());
  const [gen, setGen] = useState(0);
  useEffect(() => {
    if (H < 100) return;
    balls.current = pileStart(n, W, H);
    setGen((g) => g + 1);
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      pileStep(balls.current, dt, W, H);
      for (const b of balls.current) {
        const el = els.current.get(b.j);
        if (el) el.style.transform = `translate3d(${(b.x - b.r).toFixed(1)}px,${(b.y - b.r).toFixed(1)}px,0)`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n, W, H]);

  const [popped, setPopped] = useState<{ j: number; n: number } | null>(null);
  useEffect(() => {
    if (!popped) return;
    let voice: HTMLAudioElement | null = null;
    const v = setTimeout(() => (voice = playVoice(workOf(popped.j))), VOICE_AFTER_POP_MS);
    const done = setTimeout(() => setPopped(null), 2700);
    return () => {
      clearTimeout(v);
      clearTimeout(done);
      voice?.pause();
    };
    // the popped one only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popped]);

  const down = useRef<{ j: number; id: number; x: number; y: number; lx: number; ly: number; lt: number; m: number } | null>(null);
  const handlers = (j: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const b = balls.current.find((x) => x.j === j);
      if (!b) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // a synthetic event has no capture
      }
      down.current = { j, id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), m: 0 };
      b.drag = true;
      b.vx = 0;
      b.vy = 0;
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const d = down.current;
      const b = balls.current.find((x) => x.j === j);
      if (!d || d.j !== j || d.id !== e.pointerId || !b) return;
      const dx = e.clientX - d.lx;
      const dy = e.clientY - d.ly;
      const dt = Math.max(8, performance.now() - d.lt) / 1000;
      b.x += dx;
      b.y += dy;
      b.vx = (dx / dt) * 0.6;
      b.vy = (dy / dt) * 0.6;
      d.lx = e.clientX;
      d.ly = e.clientY;
      d.lt = performance.now();
      d.m = Math.max(d.m, Math.hypot(e.clientX - d.x, e.clientY - d.y));
    },
    onPointerUp: () => {
      const d = down.current;
      const b = balls.current.find((x) => x.j === j);
      down.current = null;
      if (!d || !b) return;
      b.drag = false;
      if (d.m < 6 && !popped) setPopped((p) => ({ j, n: (p?.n ?? 0) + 1 }));
    },
    onPointerCancel: () => {
      const b = balls.current.find((x) => x.j === j);
      down.current = null;
      if (b) b.drag = false;
    },
  });

  const ball = person.figure ?? '';
  const floorStyle: CSSProperties = { backgroundImage: `url(${STAGE_FLOOR})`, backgroundSize: `auto ${Math.round(H * 0.3 + 18)}px` };
  const pw = popped ? workOf(popped.j) : undefined;
  return (
    <div ref={ref} className={m.stage} data-testid="saturn-stage">
      <div className={m.club} style={{ backgroundImage: `url(${deps.room})` }} />
      <div className={m.ground} style={floorStyle} />
      <img className={`${m.speaker} ${m.left}`} src={STAGE_SPEAKER} alt="" draggable={false} />
      <img className={`${m.speaker} ${m.right}`} src={STAGE_SPEAKER} alt="" draggable={false} />
      {gen > 0 &&
        balls.current.map((b) => (
          <div
            key={`${person.id}-${b.j}`}
            ref={(el) => {
              if (el) els.current.set(b.j, el);
              else els.current.delete(b.j);
            }}
            className={`${m.pb} ${b.isNew ? m.isNew : ''}`}
            style={{ width: b.r * 2, height: b.r * 2, opacity: popped?.j === b.j ? 0 : 1, transform: `translate3d(${b.x - b.r}px,${b.y - b.r}px,0)` }}
            role="button"
            tabIndex={0}
            aria-label={wordsOf(workOf(b.j)) || 'コロリン'}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !popped && setPopped({ j: b.j, n: 0 })}
            data-testid={b.isNew ? 'pile-new' : 'pile-ball'}
            {...handlers(b.j)}
          >
            <img src={ball} alt="" draggable={false} />
          </div>
        ))}
      {popped && (
        <div key={popped.n} className={m.pPop} data-testid="pile-pop">
          <div className={m.pChibi}>
            <img src={chibiOf(person)} alt="" draggable={false} />
          </div>
          <div className={m.pBub}>{wordsOf(pw) ? `「${wordsOf(pw)}」` : '♪'}</div>
        </div>
      )}
      {!n && <div className={m.none}>まだ、ここにはコロリンがないよ</div>}
    </div>
  );
}

/**
 * 土星's hooks for the common template (handoff 04): the pop (§1), the groove on ▶ (§2) and the 2D stage on the profile
 * (§3). The numbers (the floor motion, your own kororin with the others, the tonearm, the fall onto the record, the
 * first voice at ~2.3 s) are lib/planetTemplate/config.ts and saturn.ts.
 */
export function saturnHooks(deps: SaturnDeps): TemplateHooks {
  return {
    opener: saturnOpener,
    playStage: (o) => <Groove {...o} />,
    profileMiddle: ({ person }) => <Pile key={person.id} person={person} deps={deps} />,
    profileFull: true,
  };
}
