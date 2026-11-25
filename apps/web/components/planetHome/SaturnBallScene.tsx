'use client';

import { RECORD_COLOURS } from '@obolo/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { COLORS } from '@/lib/puni/parts';
import { rimFloor } from '@/lib/planetHome/ballPhysics';
import { BallLayer, BallName, type BallItem, type BallLayerHandle } from './BallLayer';
import { ballPic, kororinBall, KororinPic } from './KororinFace';
import { BALLS_AT_ONCE, type StageItem } from '@/lib/planetHome/model';
import { playVoice, popSound, preloadVoice } from '@/lib/planetHome/saturnSound';
import { VOICE_DELAY_MS } from '@/lib/planetHome/saturnSoundCore';
import type { SceneProps } from './skin';
import s from './PlanetHome.module.css';

/**
 * Saturn, the final form (M-R262; design/home/README.md §7, home-inline.html Saturn mode): a cute huge record seen from a
 * low angle (home2-bg-saturn-cutea, the needle up), its colour chosen by the member (a screen-blended layer through
 * saturn-record-mask). The new kororins are glossy balls, each its maker's own kororin (M-R266: colour + face; whose it
 * is — yours / a dachi's / a 推し's — only in the name plate's underline: gold / white / pink), run by
 * plain DOM balls with faces (M-R265, BallLayer + lib/planetHome/ballPhysics): they fall, pile on the record (floor at
 * 86%, 4–96% of the width, at most 12), jiggle on a spring when they bump or are pressed, and can be dragged and thrown. A tap pops the ball like a soap bubble (a
 * splash), and its maker's 2-heads mini figure (author.chibi; a round face until it is painted) jumps out and says the
 * words in its own voice, in a bubble; then it waves and goes into the groove at the record's centre (heard, kept).
 * Tap the record itself: a ripple, and the nearest ball hops. Reduced motion: still rows, no physics.
 */
const FACE = { x0: 0.04, x1: 0.96, floor: 0.86 };
/** the groove at the record's centre label, and where the singer of 〔▶ 全部流す〕 stands (shares of the screen) */
const GROOVE = { x: 0.47, y: 0.69 };
export const RECORD_MASK = '/planet-home/saturn-record-mask.png';
/** M-R268: the stones at the bottom of the backdrop, cut out to lie in front of the balls (scripts/planet-home/saturn-fg.py) */
const FOREGROUND = '/planet-home/bg-saturn-fg.webp';
/** M-R268: the record's front rim in the backdrop (shares of the 1080×1920 picture) — the balls' floor follows its arc */
const BG = { w: 1080, h: 1920 };
const RIM = { cx: 0.481, cy: 0.702, rx: 0.574, ry: 0.1885 };
/** the record's centre label in the backdrop (shares of the picture; the grooves' light turns about it) */
const LABEL = { x: 0.464, y: 0.645 };
/** M-R268 club mode: the sunglasses go on after this, and the first ball pops at this */
const SHADES_MS = 900;
const FIRST_POP_MS = 2200;
const HOLD_MS = 480;
/** the mini figure's box (px) and how far above the popped ball it stands */
const CHIBI = { w: 124, h: 124, up: 100 };
/** M-R264: where the words may be (shares of the screen's width), and the pace of 〔▶ 全部流す〕 */
const BUBBLE = { x0: 0.24, x1: 0.76 };
const AUTO_MS = 3700;
/** M-R267: after a pop, the next one in line falls from the sky this much later */
const NEXT_MS = 900;
/** M-R275: the needle's tip (moved back, upper right in the new backdrop): 〔▶ 全部流す〕 pops the ball nearest it first */
const NEEDLE_AT = { x: 0.6, y: 0.52 };
const TALK_MIN = 1600;
const TALK_MAX = 20000;
const WAVE_MS = 900;
const AWAY_MS = 650;

const hue = (str: string) => {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.codePointAt(0)!) % 997;
  return h;
};
const nameOf = (w: StageItem) => (w.rel === 'own' ? 'あなた' : w.author.name);

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-reduced-motion: reduce)');
    if (!m) return;
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return r;
}

/** BALLS_AT_ONCE; the lab page (/lab/planet-home?atonce=20) may try another, never above 20 */
function useAtOnce() {
  const [n, setN] = useState(BALLS_AT_ONCE);
  useEffect(() => {
    if (!location.pathname.startsWith('/lab/')) return;
    const q = Number(new URLSearchParams(location.search).get('atonce'));
    if (q > 0) setN(Math.min(20, q));
  }, []);
  return n;
}

/** the record's colour: a layer through the mask, screen-blended (black = none) */
export function RecordTint({ colour }: { colour?: string | null }) {
  const c = RECORD_COLOURS.find((x) => x.id === colour)?.color;
  if (!c) return null;
  return (
    <div
      className={s.tint}
      style={{
        background: c,
        WebkitMaskImage: `url(${RECORD_MASK})`,
        maskImage: `url(${RECORD_MASK})`,
      }}
      aria-hidden
      data-testid="record-tint"
    />
  );
}

/** the mini figure, or a round face (the puni picture, else a colour with the first letter) until it is painted */
export function ChibiPic({ w }: { w: StageItem }) {
  if (w.author.chibi) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="" src={w.author.chibi} draggable={false} />;
  }
  return (
    <span
      className={s.chibiFace}
      style={{
        background: w.author.pic ? `center / cover url(${w.author.pic})` : COLORS[hue(w.author.id) % COLORS.length],
      }}
    >
      {!w.author.pic && [...nameOf(w)][0]}
    </span>
  );
}

type Out = {
  w: StageItem;
  x: number;
  y: number;
  phase: 'talk' | 'wave' | 'away';
  t0: number;
  started: boolean;
  endAt: number;
  /** M-R275: its voice plays through Web Audio (its end is known; the <audio> player's state does not apply) */
  web?: boolean;
};

export function SaturnBallScene({ cfg, view, rolling, playingId, spinning, bpm, onItem, onHold, onHeard, onPlayEnd }: SceneProps) {
  const root = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const layer = useRef<BallLayerHandle>(null);
  const reduced = useReducedMotion();
  const [outs, setOuts] = useState<Out[]>([]);
  const outsRef = useRef<Out[]>([]);
  outsRef.current = outs;
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [hadAny, setHadAny] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [drops, setDrops] = useState<{ id: string; x: number; y: number; dx: number; dy: number }[]>([]);
  const bubbles = useRef(new Map<string, HTMLDivElement>());
  const touched = useRef<string | null>(null);
  const lastDown = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hold = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    x: number;
    y: number;
    fired: boolean;
  }>({ timer: null, x: 0, y: 0, fired: false });
  const live = useRef({ onItem, onHeard, onHold, rolling });
  live.current = { onItem, onHeard, onHold, rolling };

  useEffect(() => {
    if (rolling.length) setHadAny(true);
  }, [rolling]);

  const outIds = useMemo(() => new Set(outs.map((o) => o.w.id)), [outs]);
  // the balls still rolling: not popped, not heard — at most BALLS_AT_ONCE on the record (M-R267); a popped ball's
  // place stays empty for NEXT_MS, then the next in line falls in
  const [waiting, setWaiting] = useState(0);
  const left = useMemo(() => rolling.filter((w) => !gone.has(w.id) && !outIds.has(w.id)), [rolling, gone, outIds]);
  const atOnce = useAtOnce();
  const shown = useMemo(() => left.slice(0, Math.max(0, atOnce - waiting)), [left, waiting, atOnce]);
  const inLine = left.length - shown.length;
  // M-R264: 44–60 px across at a 430 px screen, in proportion elsewhere
  const [scale, setScale] = useState(390 / 430);
  const [box, setBox] = useState({ W: 0, H: 0 });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const set = () => {
      setScale((el.clientWidth || 390) / 430);
      setBox({ W: el.clientWidth, H: el.clientHeight });
    };
    set();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // M-R275: each ball is its maker's chosen kororin picture (else one from the ball's number and the name)
  const items = useMemo<BallItem[]>(
    () =>
      shown.map((w) => {
        return {
          id: w.id,
          // client 2026-11-25: the maker's own ball in their pattern (author.ball) until they choose a kororin picture
          pic: !w.author.kororin?.pic && w.author.ball ? w.author.ball : kororinBall(ballPic(w, hue(w.id))),
          turn: hue(w.id),
          name: w.rel === 'own' ? null : w.author.name,
          R: (22 + (hue(w.id) % 3) * 4) * scale,
        };
      }),
    [shown, scale],
  );

  const size = () => ({
    W: root.current?.clientWidth ?? 390,
    H: root.current?.clientHeight ?? 844,
  });
  // M-R268: the rim's ellipse, mapped as the backdrop is (cover, centred, bottom-aligned), in the record face's px
  const isSaturnArt = cfg.art.backdrop === '/planet-home/bg-saturn.webp';
  const floorAt = useMemo(() => {
    if (!box.W || !isSaturnArt) return undefined;
    const k = Math.max(box.W / BG.w, box.H / BG.h);
    const dw = BG.w * k;
    const dh = BG.h * k;
    const x0 = (box.W - dw) / 2 - FACE.x0 * box.W;
    const y0 = box.H - dh;
    return rimFloor({
      cx: x0 + RIM.cx * dw,
      cy: y0 + RIM.cy * dh,
      rx: RIM.rx * dw,
      ry: RIM.ry * dh,
    });
  }, [box, isSaturnArt]);
  // club mode: the sunglasses go on a little after the record starts
  const [partying, setPartying] = useState(false);
  useEffect(() => {
    if (!spinning) return setPartying(false);
    const t = setTimeout(() => setPartying(true), SHADES_MS);
    return () => clearTimeout(t);
  }, [spinning]);
  const groove = () => {
    const { W, H } = size();
    return { x: (GROOVE.x - FACE.x0) * W, y: GROOVE.y * H };
  };

  const patch = (id: string, p: Partial<Out>) => setOuts((l) => l.map((o) => (o.w.id === id ? { ...o, ...p } : o)));

  // done talking: it waves, then goes into the groove at the record's centre, then it is heard
  const finish = useCallback((id: string) => {
    const o = outsRef.current.find((x) => x.w.id === id);
    if (!o || o.phase !== 'talk') return;
    patch(id, { phase: 'wave' });
    setTimeout(() => patch(id, { phase: 'away' }), WAVE_MS);
    setTimeout(() => {
      setOuts((l) => l.filter((x) => x.w.id !== id));
      setGone((g) => new Set(g).add(id));
      live.current.onHeard(id);
    }, WAVE_MS + AWAY_MS);
  }, []);

  // a tap: the ball pops (a splash), the mini figure jumps out and talks
  const pop = useCallback((id: string, at?: { x: number; y: number }) => {
    const w = live.current.rolling.find((x) => x.id === id);
    if (!w || outsRef.current.some((o) => o.w.id === id)) return;
    touched.current = id;
    const b = layer.current?.ball(id);
    const x = at?.x ?? b?.x ?? 0;
    const y = at?.y ?? b?.y ?? 0;
    const R = b?.R ?? 28;
    const n = Date.now();
    setDrops((l) => [
      ...l,
      ...Array.from({ length: 14 }, (_, k) => {
        const a = (k / 14) * Math.PI * 2;
        const d = R * (1.2 + ((k * 37) % 10) / 12);
        return {
          id: `${id}-${n}-${k}`,
          x,
          y,
          dx: Math.cos(a) * d,
          dy: Math.sin(a) * d,
        };
      }),
    ]);
    setTimeout(() => setDrops((l) => l.filter((d) => !d.id.startsWith(`${id}-${n}-`))), 700);
    const t0 = performance.now();
    setOuts((l) => [
      ...l,
      {
        w,
        x,
        y,
        phase: 'talk',
        t0,
        started: false,
        endAt: t0 + (w.url ? TALK_MAX : TALK_MIN + 600),
      },
    ]);
    setWaiting((n) => n + 1);
    setTimeout(() => setWaiting((n) => n - 1), NEXT_MS);
    // M-R275: the soap-bubble pop now, the maker's voice 300 ms later on the shared AudioContext (decoded ahead); the
    // <audio> player only when it is not ready in time (or there is no Web Audio)
    popSound();
    setTimeout(() => {
      const d = playVoice(w.url);
      if (d === null) return live.current.onItem(w);
      const o = outsRef.current.find((q) => q.w.id === id);
      if (o) Object.assign(o, { web: true, started: true, endAt: performance.now() + Math.max(TALK_MIN - VOICE_DELAY_MS, d * 1000 + 250) });
    }, VOICE_DELAY_MS);
  }, []);

  // M-R275: the voices of the balls on the record, fetched and decoded ahead (a pop plays one at once)
  useEffect(() => {
    for (const w of shown) preloadVoice(w.url);
  }, [shown]);

  // M-R264 〔▶ 全部流す〕: while the record spins, the ball nearest the needle pops by itself, then the next, every 3.7 s;
  // when none is left it stops (「今日のコロリン、全部聞いたね！」). 〔■ 止める〕 stops it at once.
  const [pressed, setPressed] = useState(false);
  const autoEnd = useRef(onPlayEnd);
  autoEnd.current = onPlayEnd;
  useEffect(() => {
    if (!spinning) return;
    setPressed(true);
    const next = () => {
      const { W, H } = size();
      const nx = (NEEDLE_AT.x - FACE.x0) * W;
      const ny = NEEDLE_AT.y * H;
      let best: string | null = null;
      let bd = Infinity;
      let more = false;
      for (const w of live.current.rolling) {
        if (outsRef.current.some((o) => o.w.id === w.id)) continue;
        more = true;
        // only a ball on the record (one still in line falls in first)
        const b = layer.current?.ball(w.id);
        if (!b || b.y < 0) continue;
        const d = Math.hypot(b.x - nx, b.y - ny);
        if (d < bd) [best, bd] = [w.id, d];
      }
      if (best) pop(best);
      return more;
    };
    // M-R268: the first one at 2.2 s (the lights and the sunglasses first), then every 3.7 s
    let t: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => {
      if (!next() && !outsRef.current.length) {
        autoEnd.current?.();
        return;
      }
      t = setInterval(() => {
        if (!next() && !outsRef.current.some((o) => o.phase !== 'away')) {
          clearInterval(t);
          setTimeout(() => autoEnd.current?.(), WAVE_MS + AWAY_MS);
        }
      }, AUTO_MS);
    }, FIRST_POP_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [spinning, pop]);

  // its voice started → playing; stopped → it has finished (after at least TALK_MIN)
  useEffect(() => {
    const now = performance.now();
    for (const o of outsRef.current) {
      if (o.phase !== 'talk' || o.web) continue;
      if (playingId === o.w.id) o.started = true;
      else if (o.started || now - o.t0 > 2500) o.endAt = Math.max(now, o.t0 + TALK_MIN);
    }
  }, [playingId]);
  useEffect(() => {
    const t = setInterval(() => {
      const now = performance.now();
      for (const o of outsRef.current) if (o.phase === 'talk' && now >= o.endAt) finish(o.w.id);
    }, 100);
    return () => clearInterval(t);
  }, [finish]);

  // every frame: the words kept on the screen (M-R273: the names are on the balls; no plates to lay out)
  const onFrame = useCallback(() => {
    const { W } = size();
    const left = FACE.x0 * W;
    for (const o of outsRef.current) {
      if (o.phase === 'away') continue;
      const el = bubbles.current.get(o.w.id);
      if (el) {
        // M-R264: between 24% and 76% of the screen's width, never cut at an edge
        const half = el.offsetWidth / 2;
        const bx = Math.max(W * BUBBLE.x0 + half - left, Math.min(W * BUBBLE.x1 - half - left, o.x));
        const by = o.y - CHIBI.up - CHIBI.h / 2 - 2;
        el.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0) translate(-50%, -100%)`;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // touch: a hold opens the menu (the layer's tap is then ignored); a tap on no ball ripples and nudges the nearest
  const hitAt = (x: number, y: number): string | null => {
    let best: string | null = null;
    let bd = Infinity;
    for (const w of live.current.rolling) {
      const b = layer.current?.ball(w.id);
      if (!b) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < b.R * 1.15 && d < bd) [best, bd] = [w.id, d];
    }
    return best;
  };
  const faceXY = (e: PointerEvent) => {
    const r = face.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const downCapture = (e: PointerEvent) => {
    const p = faceXY(e);
    lastDown.current = p;
    const h = hold.current;
    if (h.timer) clearTimeout(h.timer);
    h.fired = false;
    h.x = e.clientX;
    h.y = e.clientY;
    const id = hitAt(p.x, p.y);
    if (!id) return;
    touched.current = id;
    const at = { x: e.clientX, y: e.clientY };
    h.timer = setTimeout(() => {
      h.timer = null;
      h.fired = true;
      const w = live.current.rolling.find((x) => x.id === id);
      layer.current?.drop(id);
      if (w) live.current.onHold(w, at);
    }, HOLD_MS);
  };
  const moveCapture = (e: PointerEvent) => {
    const h = hold.current;
    if (h.timer && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 8) {
      clearTimeout(h.timer);
      h.timer = null;
    }
  };
  const upCapture = () => {
    const h = hold.current;
    if (h.timer) clearTimeout(h.timer);
    h.timer = null;
  };
  const tapBall = (id: string) => {
    if (hold.current.fired) {
      hold.current.fired = false;
      return;
    }
    pop(id);
  };
  const tapEmpty = () => {
    const { x, y } = lastDown.current;
    const id = Date.now();
    setRipples((l) => [...l, { id, x, y }]);
    setTimeout(() => setRipples((l) => l.filter((q) => q.id !== id)), 700);
    let near: string | null = null;
    let bd = 180;
    for (const w of live.current.rolling) {
      const b = layer.current?.ball(w.id);
      if (!b) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bd) [near, bd] = [w.id, d];
    }
    if (near) layer.current?.poke(near);
  };

  const done = (hadAny || pressed) && !rolling.length && !outs.length;
  // everything heard (the line too): 〔▶ 全部流す〕 ends with the pill, the record stops
  useEffect(() => {
    if (done && spinning) autoEnd.current?.();
  }, [done, spinning]);
  const g = groove();
  return (
    <div ref={root} className={`${s.scene} ${partying ? s.partying : ''}`} data-in-line={inLine} data-on-record={shown.length} data-partying={partying || undefined}>
      <div
        className={s.bg}
        style={{
          backgroundImage: `url(${cfg.art.backdrop})`,
          transform: 'none',
        }}
      />
      {cfg.art.backdrop === '/planet-home/bg-saturn.webp' && <RecordTint colour={view.recordColour} />}
      {/* M-R264: while it spins, the light in the grooves goes round */}
      {spinning && !reduced && <GrooveSpin />}
      {/* M-R268 club mode: dimmer, the mirror ball comes down, lasers and a neon rim (reduced motion: no lasers, no flashing) */}
      <div className={`${s.party} ${spinning ? s.partyOn : ''}`} aria-hidden data-testid="party">
        <div className={s.partyDim} />
        {!reduced && (
          <div className={s.lasers}>
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        )}
        <div className={s.mball}>
          <div className={s.mballWire} />
          <div className={s.mballOrb} />
        </div>
        {!reduced && <div className={s.neon} />}
      </div>
      {/* M-R272: no record plate on Saturn (your own kororins are kept in Bluena's Saturn folder on the Moon) */}
      <div
        ref={face}
        className={s.puniFace}
        style={{ left: `${FACE.x0 * 100}%`, right: `${(1 - FACE.x1) * 100}%` }}
        onPointerDownCapture={downCapture}
        onPointerMoveCapture={moveCapture}
        onPointerUpCapture={upCapture}
        onPointerCancelCapture={upCapture}
        data-testid="record-face"
      >
        {reduced ? (
          <StillRows items={shown} onTap={(w, x, y) => pop(w.id, { x, y })} onHold={(w, at) => onHold(w, at)} />
        ) : (
          <BallLayer ref={layer} items={items} floor={FACE.floor} floorAt={floorAt} spin={spinning} bpm={bpm ?? 124} onTap={tapBall} onTapEmpty={tapEmpty} onFrame={onFrame} />
        )}
        {/* M-R268: the stones in front of the balls, placed exactly as the backdrop (this face starts 4% in) */}
        {isSaturnArt && (
          <div
            className={s.fg}
            style={{
              backgroundImage: `url(${FOREGROUND})`,
              left: `${(-FACE.x0 / (FACE.x1 - FACE.x0)) * 100}%`,
              width: `${100 / (FACE.x1 - FACE.x0)}%`,
            }}
            aria-hidden
            data-testid="foreground"
          />
        )}
        {drops.map((d) => (
          <i
            key={d.id}
            className={s.splash}
            style={
              {
                left: d.x,
                top: d.y,
                '--dx': `${d.dx}px`,
                '--dy': `${d.dy}px`,
              } as CSSProperties
            }
            aria-hidden
          />
        ))}
        {/* the mini figures out of their balls: jump out, talk, wave, into the groove */}
        {outs.map((o) => (
          <div key={o.w.id}>
            <div
              className={`${s.chibi} ${o.phase === 'wave' ? s.chibiWave : ''} ${o.phase === 'away' ? s.chibiAway : ''} ${reduced ? s.chibiStill : ''}`}
              style={{
                left: o.phase === 'away' ? g.x : o.x,
                top: (o.phase === 'away' ? g.y : o.y - CHIBI.up) - CHIBI.h / 2,
                width: CHIBI.w,
                height: CHIBI.h,
                marginLeft: -CHIBI.w / 2,
              }}
              data-testid="chibi"
            >
              <ChibiPic w={o.w} />
            </div>
            {o.phase === 'talk' && (
              <div
                ref={(el) => {
                  if (el) bubbles.current.set(o.w.id, el);
                  else bubbles.current.delete(o.w.id);
                }}
                className={`${s.bub} ${s.bubWrap}`}
                style={{
                  left: 0,
                  top: 0,
                  bottom: 'auto',
                  transform: `translate3d(${o.x}px, ${o.y - CHIBI.up - CHIBI.h / 2 - 2}px, 0) translate(-50%, -100%)`,
                }}
                data-testid="bubble"
              >
                <small>🎤 {nameOf(o.w)}</small>
                {o.w.text || o.w.title}
              </div>
            )}
          </div>
        ))}
        {ripples.map((r) => (
          <span key={r.id} className={s.ripple} style={{ left: r.x, top: r.y }} aria-hidden />
        ))}
      </div>
      {done && (
        <div className={s.done} style={{ top: '38%' }}>
          🎉 今日のコロリン、全部聞いたね！
        </div>
      )}
    </div>
  );
}

/** the light streaks in the grooves going round (on the record only: through its mask, seen at its low angle) */
function GrooveSpin() {
  // M-R275 (iPad): drawn on a small canvas (a third of the screen's pixels) — a masked, spinning full-screen layer cost
  // a frame in two on an iPad-sized screen; this keeps 60 fps
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext('2d');
    if (!cv || !g || typeof g.createConicGradient !== 'function') return;
    const mask = new Image();
    mask.src = RECORD_MASK;
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const W = Math.max(1, Math.round(cv.clientWidth / 3));
      const H = Math.max(1, Math.round(cv.clientHeight / 3));
      if (cv.width !== W || cv.height !== H) Object.assign(cv, { width: W, height: H });
      if (!mask.complete || !mask.naturalWidth) return;
      // the backdrop's cover, centred, bottom-aligned
      const k = Math.max(W / BG.w, H / BG.h);
      const dw = BG.w * k;
      const dh = BG.h * k;
      const x0 = (W - dw) / 2;
      const y0 = H - dh;
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, W, H);
      g.save();
      g.translate(x0 + LABEL.x * dw, y0 + LABEL.y * dh);
      g.scale(1, 0.34);
      const grad = g.createConicGradient((((now - t0) / 2400) % 1) * Math.PI * 2, 0, 0);
      for (const q of [0, 0.25, 0.5, 0.75]) {
        const a = q === 0 || q === 0.5 ? 0.28 : 0.2;
        grad.addColorStop(q, 'rgba(255,255,255,0)');
        grad.addColorStop(q + 6 / 360, `rgba(255,255,255,${a})`);
        grad.addColorStop(q + 16 / 360, 'rgba(255,255,255,0)');
      }
      g.fillStyle = grad;
      g.fillRect(-dw, -dh * 3, dw * 2, dh * 6);
      g.restore();
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(mask, x0, y0, dw, dh);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className={s.grooveCanvas} aria-hidden data-testid="groove-spin" />;
}

/** reduced motion: the balls sit still in rows on the record; a tap pops one in place (no splash, no flight) */
function StillRows({ items, onTap, onHold }: { items: StageItem[]; onTap: (w: StageItem, x: number, y: number) => void; onHold: (w: StageItem, at: { x: number; y: number }) => void }) {
  const box = useRef<HTMLDivElement>(null);
  return (
    <div ref={box} className={s.stillRows}>
      {items.map((w) => (
        <button
          key={w.id}
          type="button"
          className={s.still}
          onClick={(e) => {
            const f = box.current?.parentElement?.getBoundingClientRect();
            const r = e.currentTarget.getBoundingClientRect();
            onTap(w, r.left + r.width / 2 - (f?.left ?? 0), r.top + r.height / 2 - (f?.top ?? 0));
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            onHold(w, { x: e.clientX, y: e.clientY });
          }}
          data-rel={w.rel}
          data-testid="rolling"
        >
          <KororinPic pic={ballPic(w, hue(w.id))} size={56} turn={hue(w.id)} />
          {w.rel !== 'own' && <BallName name={w.author.name} R={28} />}
        </button>
      ))}
    </div>
  );
}
