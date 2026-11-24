'use client';

import { RECORD_COLOURS } from '@obolo/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { PuniPhysicsLayer, type PuniItem, type PuniLayerHandle } from '@/components/puni/PuniPhysicsLayer';
import { COLORS, defaultLook } from '@/lib/puni/parts';
import type { Blob } from '@/lib/puni/physics';
import type { StageItem } from '@/lib/planetHome/model';
import type { SceneProps } from './skin';
import s from './PlanetHome.module.css';

/**
 * Saturn, the final form (M-R262; design/home/README.md §7, home-inline.html Saturn mode): a cute huge record seen from a
 * low angle (home2-bg-saturn-cutea, the needle up), its colour chosen by the member (a screen-blended layer through
 * saturn-record-mask). The new kororins are glossy balls — gold = yours, white = a dachi's, pink = a 推し's — run by
 * the 10/7 soft physics (components/puni/PuniPhysicsLayer): they fall, pile on the record (floor at 86%, 4–96% of the
 * width, at most 12), squash when they bump, and can be dragged and thrown. A tap pops the ball like a soap bubble (a
 * splash), and its maker's 2-heads mini figure (author.chibi; a round face until it is painted) jumps out and says the
 * words in its own voice, in a bubble; then it waves and goes into the groove at the record's centre (heard, kept).
 * Tap the record itself: a ripple, and the nearest ball hops. Reduced motion: still rows, no physics.
 */
const FACE = { x0: 0.04, x1: 0.96, floor: 0.86 };
/** the groove at the record's centre label, and where the singer of 〔▶ 全部流す〕 stands (shares of the screen) */
const GROOVE = { x: 0.47, y: 0.69 };
const NEEDLE = { x: 47, y: 74 };
const BALL: Record<StageItem['rel'], string> = { own: '/planet-home/ball-mine.webp', dachi: '/planet-home/ball-dachi.webp', oshi: '/planet-home/ball-oshi.webp', stranger: '/planet-home/ball-dachi.webp' };
export const RECORD_MASK = '/planet-home/saturn-record-mask.png';
const HOLD_MS = 480;
const PLATE_H = 17;
/** the mini figure's box (px) and how far above the popped ball it stands */
const CHIBI = { w: 124, h: 124, up: 100 };
const TALK_MIN = 1600;
const TALK_MAX = 20000;
const WAVE_MS = 900;
const AWAY_MS = 650;

const hue = (str: string) => {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.codePointAt(0)!) % 997;
  return h;
};
const tagColour = (w: StageItem) => (w.rel === 'oshi' ? 'var(--oshi)' : w.rel === 'own' ? 'var(--mine)' : 'var(--dachi)');
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

/** the record's colour: a layer through the mask, screen-blended (black = none) */
export function RecordTint({ colour }: { colour?: string | null }) {
  const c = RECORD_COLOURS.find((x) => x.id === colour)?.color;
  if (!c) return null;
  return <div className={s.tint} style={{ background: c, WebkitMaskImage: `url(${RECORD_MASK})`, maskImage: `url(${RECORD_MASK})` }} aria-hidden data-testid="record-tint" />;
}

/** the mini figure, or a round face (the puni picture, else a colour with the first letter) until it is painted */
export function ChibiPic({ w }: { w: StageItem }) {
  if (w.author.chibi) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="" src={w.author.chibi} draggable={false} />;
  }
  return (
    <span className={s.chibiFace} style={{ background: w.author.pic ? `center / cover url(${w.author.pic})` : COLORS[hue(w.author.id) % COLORS.length] }}>
      {!w.author.pic && [...nameOf(w)][0]}
    </span>
  );
}

type Out = { w: StageItem; x: number; y: number; phase: 'talk' | 'wave' | 'away'; t0: number; started: boolean; endAt: number };

export function SaturnBallScene({ cfg, view, rolling, playingId, spinning, onPlate, onItem, onHold, onHeard }: SceneProps) {
  const root = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const layer = useRef<PuniLayerHandle>(null);
  const reduced = useReducedMotion();
  const [outs, setOuts] = useState<Out[]>([]);
  const outsRef = useRef<Out[]>([]);
  outsRef.current = outs;
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [hadAny, setHadAny] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [drops, setDrops] = useState<{ id: string; x: number; y: number; dx: number; dy: number }[]>([]);
  const tags = useRef(new Map<string, HTMLDivElement>());
  const bubbles = useRef(new Map<string, HTMLDivElement>());
  const touched = useRef<string | null>(null);
  const freshIds = useRef(new Set<string>());
  const plateW = useRef(new Map<string, number>());
  const plateHt = useRef(0);
  const lastDown = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hold = useRef<{ timer: ReturnType<typeof setTimeout> | null; x: number; y: number; fired: boolean }>({ timer: null, x: 0, y: 0, fired: false });
  const live = useRef({ onItem, onHeard, onHold, rolling });
  live.current = { onItem, onHeard, onHold, rolling };

  useEffect(() => {
    if (rolling.length) setHadAny(true);
    freshIds.current = new Set(rolling.filter((w) => w.fresh).map((w) => w.id));
  }, [rolling]);

  const outIds = useMemo(() => new Set(outs.map((o) => o.w.id)), [outs]);
  // the balls still rolling: not popped, not heard
  const shown = useMemo(() => rolling.filter((w) => !gone.has(w.id) && !outIds.has(w.id)), [rolling, gone, outIds]);
  const items = useMemo<PuniItem[]>(() => shown.map((w) => ({ id: w.id, look: defaultLook(COLORS[hue(w.author.id) % COLORS.length]), pic: BALL[w.rel], R: 26 + (hue(w.id) % 3) * 3 })), [shown]);

  const size = () => ({ W: root.current?.clientWidth ?? 390, H: root.current?.clientHeight ?? 844 });
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
    const b = layer.current?.blob(id);
    const x = at?.x ?? b?.x ?? 0;
    const y = at?.y ?? b?.y ?? 0;
    const R = b?.R ?? 28;
    const n = Date.now();
    setDrops((l) => [
      ...l,
      ...Array.from({ length: 14 }, (_, k) => {
        const a = (k / 14) * Math.PI * 2;
        const d = R * (1.2 + ((k * 37) % 10) / 12);
        return { id: `${id}-${n}-${k}`, x, y, dx: Math.cos(a) * d, dy: Math.sin(a) * d };
      }),
    ]);
    setTimeout(() => setDrops((l) => l.filter((d) => !d.id.startsWith(`${id}-${n}-`))), 700);
    const t0 = performance.now();
    setOuts((l) => [...l, { w, x, y, phase: 'talk', t0, started: false, endAt: t0 + (w.url ? TALK_MAX : TALK_MIN + 600) }]);
    live.current.onItem(w);
  }, []);

  // its voice started → playing; stopped → it has finished (after at least TALK_MIN)
  useEffect(() => {
    const now = performance.now();
    for (const o of outsRef.current) {
      if (o.phase !== 'talk') continue;
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

  // every frame: the name plates, laid out so none covers another plate, another ball, a mini figure, its words or the dock
  const onFrame = useCallback((get: (id: string) => Blob | undefined) => {
    const { W, H } = size();
    const left = FACE.x0 * W;
    const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
    // the mini figures and their words take their place first (the words kept inside the screen)
    for (const o of outsRef.current) {
      if (o.phase === 'away') continue;
      boxes.push({ x0: o.x - CHIBI.w / 2, x1: o.x + CHIBI.w / 2, y0: o.y - CHIBI.up - CHIBI.h / 2, y1: o.y + CHIBI.h / 2 - CHIBI.up + 20 });
      const el = bubbles.current.get(o.w.id);
      if (el) {
        const half = el.offsetWidth / 2;
        const bx = Math.max(half + 8 - left, Math.min(W - half - 8 - left, o.x));
        const by = o.y - CHIBI.up - CHIBI.h / 2 - 2;
        el.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0) translate(-50%, -100%)`;
        boxes.push({ x0: bx - half - 3, x1: bx + half + 3, y0: by - el.offsetHeight - 3, y1: by + 3 });
      }
    }
    const balls: { id: string; b: Blob }[] = [];
    for (const id of tags.current.keys()) {
      const b = get(id);
      if (b) balls.push({ id, b });
    }
    const faces = balls.map(({ id, b }) => ({ id, x: b.x, y: b.y, r: b.R * 0.9 }));
    const rank = (id: string) => (id === touched.current ? 0 : freshIds.current.has(id) ? 1 : 2);
    balls.sort((p, q) => rank(p.id) - rank(q.id));
    const bottomLimit = H * 0.875;
    const hitsFace = (x0: number, x1: number, y0: number, y1: number, own: string) =>
      faces.some((f) => {
        if (f.id === own) return false;
        const cx = Math.max(x0, Math.min(f.x, x1));
        const cy = Math.max(y0, Math.min(f.y, y1));
        return Math.hypot(cx - f.x, cy - f.y) < f.r;
      });
    const ph = Math.max(PLATE_H, plateHt.current);
    for (const { id, b } of balls) {
      const el = tags.current.get(id)!;
      const w = plateW.current.get(id) ?? 64;
      const base = b.y + b.R * b.sy + 2;
      let at: number | null = null;
      const above = b.y - b.R * b.sy - ph - 3;
      // below the ball (stepping down, never into the dock), else above it, stepping up so neighbours' plates stagger
      for (const y0 of [base, base + 10, above, above - (ph + 2), above - 2 * (ph + 2)]) {
        const box = { x0: b.x - w / 2 - 2, x1: b.x + w / 2 + 2, y0: y0 - 1, y1: y0 + ph + 1 };
        if (box.y1 > bottomLimit) continue;
        if (boxes.some((o) => !(box.x1 <= o.x0 || box.x0 >= o.x1 || box.y1 <= o.y0 || box.y0 >= o.y1))) continue;
        if (hitsFace(box.x0, box.x1, box.y0, box.y1, id)) continue;
        boxes.push(box);
        at = y0;
        break;
      }
      const dot = at === null;
      if (el.dataset.dot !== String(dot)) {
        el.dataset.dot = String(dot);
        el.classList.toggle(s.puniDot, dot);
      }
      if (!dot && !plateW.current.has(id) && el.offsetWidth) {
        plateW.current.set(id, el.offsetWidth);
        plateHt.current = Math.max(plateHt.current, el.offsetHeight);
      }
      el.style.transform = dot ? `translate3d(${b.x.toFixed(1)}px, ${(b.y + b.R * b.sy - 5).toFixed(1)}px, 0) translateX(-50%)` : `translate3d(${b.x.toFixed(1)}px, ${at!.toFixed(1)}px, 0) translateX(-50%)`;
      // for the review's overlap check: where this ball is
      el.dataset.face = `${b.x.toFixed(0)},${b.y.toFixed(0)},${(b.R * 0.9).toFixed(0)}`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // touch: a hold opens the menu (the layer's tap is then ignored); a tap on no ball ripples and nudges the nearest
  const hitAt = (x: number, y: number): string | null => {
    let best: string | null = null;
    let bd = Infinity;
    for (const w of live.current.rolling) {
      const b = layer.current?.blob(w.id);
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
      const b = layer.current?.blob(id);
      if (b) b.drag = null;
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
      const b = layer.current?.blob(w.id);
      if (!b) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bd) [near, bd] = [w.id, d];
    }
    if (near) layer.current?.poke(near);
  };

  const done = hadAny && !rolling.length && !outs.length;
  const singer = spinning && playingId ? [...view.own, ...view.around].find((w) => w.id === playingId) : undefined;
  const g = groove();
  return (
    <div ref={root} className={s.scene}>
      <div className={s.bg} style={{ backgroundImage: `url(${cfg.art.backdrop})`, transform: 'none' }} />
      {cfg.art.backdrop === '/planet-home/bg-saturn.webp' && <RecordTint colour={view.recordColour} />}
      <button type="button" className={s.plate} style={{ bottom: 'auto', top: '49%', zIndex: 5 }} onClick={onPlate} data-testid="name-plate">
        {view.owner.name}の{cfg.place}
      </button>
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
          <PuniPhysicsLayer ref={layer} items={items} floorAt={(_x, _W, H) => H * FACE.floor} onTap={tapBall} onTapEmpty={tapEmpty} onFrame={onFrame} />
        )}
        {!reduced &&
          shown.map((w) => (
            <div
              key={w.id}
              ref={(el) => {
                if (el) tags.current.set(w.id, el);
                else tags.current.delete(w.id);
              }}
              className={s.puniTag}
              style={{ '--c': tagColour(w) } as CSSProperties}
              data-rel={w.rel}
              data-testid="rolling"
            >
              {w.fresh && <span className={s.spark}>✦</span>}
              {nameOf(w)}
            </div>
          ))}
        {drops.map((d) => (
          <i key={d.id} className={s.splash} style={{ left: d.x, top: d.y, '--dx': `${d.dx}px`, '--dy': `${d.dy}px` } as CSSProperties} aria-hidden />
        ))}
        {/* the mini figures out of their balls: jump out, talk, wave, into the groove */}
        {outs.map((o) => (
          <div key={o.w.id}>
            <div
              className={`${s.chibi} ${o.phase === 'wave' ? s.chibiWave : ''} ${o.phase === 'away' ? s.chibiAway : ''} ${reduced ? s.chibiStill : ''}`}
              style={{ left: o.phase === 'away' ? g.x : o.x, top: (o.phase === 'away' ? g.y : o.y - CHIBI.up) - CHIBI.h / 2, width: CHIBI.w, height: CHIBI.h, marginLeft: -CHIBI.w / 2 }}
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
                className={s.bub}
                style={{ left: 0, top: 0, bottom: 'auto', transform: `translate3d(${o.x}px, ${o.y - CHIBI.up - CHIBI.h / 2 - 2}px, 0) translate(-50%, -100%)` }}
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
      {/* 〔▶ 全部流す〕: the one singing comes out of the groove, by the record's centre */}
      {singer && (
        <div className={`${s.chibi} ${s.atNeedleChibi}`} style={{ left: `${NEEDLE.x}%`, top: `${NEEDLE.y}%`, width: CHIBI.w, height: CHIBI.h, margin: `${-CHIBI.h}px 0 0 ${-CHIBI.w / 2}px` }} data-testid="at-needle">
          <ChibiPic w={{ ...singer, fresh: false, drop: null, leaving: false }} />
        </div>
      )}
    </div>
  );
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
          style={{ '--c': tagColour(w) } as CSSProperties}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={BALL[w.rel]} />
          <span className={s.puniTagStill}>{nameOf(w)}</span>
        </button>
      ))}
    </div>
  );
}
