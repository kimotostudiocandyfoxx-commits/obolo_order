'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { PuniPhysicsLayer, type PuniItem, type PuniLayerHandle } from '@/components/puni/PuniPhysicsLayer';
import { COLORS, defaultLook } from '@/lib/puni/parts';
import type { Blob } from '@/lib/puni/physics';
import type { StageItem } from '@/lib/planetHome/model';
import type { SceneProps } from './skin';
import s from './PlanetHome.module.css';

/**
 * Saturn (M-R259, as the client changed it for R2; design/home/home-inline.html Saturn mode): a huge record fills the
 * screen (its label on the left, the needle-mic and the play button in front). The new kororins are the 10/7 ぷにぷに —
 * round soft balls with their maker's puni face (author.pic; a drawn one in their colour when there is none) — run by
 * the same soft physics (components/puni/PuniPhysicsLayer). They fall from the sky and pile up on the record (50–80% of
 * the height, 16–86% of the width, at most 12), squash when they bump, dent and bounce when poked and talk (name and
 * words over their head), can be dragged and thrown, and when they have finished they are drawn into the groove by
 * the label (heard, kept; not deleted). Tap the record itself: a ripple, and the nearest one hops.
 * With prefers-reduced-motion they sit still in rows and only fade into the groove.
 */
/** the record's face where they pile (shares of the screen) */
const FACE = { x0: 0.16, x1: 0.86, floor: 0.8 };
/** the groove by the label they are drawn into, and the needle-mic (shares of the screen) */
const GROOVE = { x: 0.07, y: 0.69 };
const NEEDLE = { x: 52, y: 68 };
/** the painted play button (bottom right of the backdrop): plays the grooves, like 〔▶ 全部流す〕 */
const PLAY_SPOT = { x: 82, y: 89, r: 9 };
const HOLD_MS = 480;
const TALK_MIN = 1600;
const TALK_MAX = 20000;

const hue = (str: string) => {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.codePointAt(0)!) % 997;
  return h;
};
const tagColour = (w: StageItem) => (w.rel === 'oshi' ? 'var(--oshi)' : w.rel === 'own' ? 'var(--mine)' : 'var(--dachi)');

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

type Talk = { t0: number; started: boolean; endAt: number };
type Suck = { t0: number; x0: number; y0: number; R0: number };

export function SaturnPuniScene({ cfg, view, rolling, playingId, spinning, onPlay, onPlate, onItem, onHold, onHeard }: SceneProps) {
  const root = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const layer = useRef<PuniLayerHandle>(null);
  const reduced = useReducedMotion();
  const [talking, setTalking] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [hadAny, setHadAny] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const talks = useRef(new Map<string, Talk>());
  const sucks = useRef(new Map<string, Suck>());
  const tags = useRef(new Map<string, HTMLDivElement>());
  const bubble = useRef<HTMLDivElement>(null);
  const lastDown = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hold = useRef<{ timer: ReturnType<typeof setTimeout> | null; x: number; y: number; fired: boolean }>({ timer: null, x: 0, y: 0, fired: false });
  const live = useRef({ onItem, onHeard, onHold, rolling });
  live.current = { onItem, onHeard, onHold, rolling };

  useEffect(() => {
    if (rolling.length) setHadAny(true);
  }, [rolling]);

  const shown = useMemo(() => rolling.filter((w) => !gone.has(w.id)), [rolling, gone]);
  const items = useMemo<PuniItem[]>(
    () =>
      shown.map((w) => {
        const h = hue(w.author.id);
        return { id: w.id, look: defaultLook(COLORS[h % COLORS.length]), pic: w.author.pic ?? null, R: 30 + (hue(w.id) % 3) * 4 };
      }),
    [shown],
  );

  // the face's box (the physics runs inside it): screen share → px inside the face
  const toFace = (fx: number, fy: number) => {
    const r = root.current;
    const W = r?.clientWidth ?? 390;
    const H = r?.clientHeight ?? 844;
    return { x: (fx - FACE.x0) * W, y: fy * H };
  };

  const finish = useCallback((id: string) => {
    const b = layer.current?.blob(id);
    talks.current.delete(id);
    setTalking((t) => (t === id ? null : t));
    if (b) {
      b.ghost = true;
      sucks.current.set(id, { t0: performance.now(), x0: b.x, y0: b.y, R0: b.R });
    }
    setTimeout(() => {
      sucks.current.delete(id);
      setGone((g) => new Set(g).add(id));
      live.current.onHeard(id);
    }, b ? 650 : 0);
  }, []);

  const talk = useCallback((id: string) => {
    const w = live.current.rolling.find((x) => x.id === id);
    if (!w || talks.current.has(id) || sucks.current.has(id)) return;
    const t0 = performance.now();
    talks.current.set(id, { t0, started: false, endAt: t0 + (w.url ? TALK_MAX : TALK_MIN + 600) });
    setTalking(id);
    live.current.onItem(w);
  }, []);

  // its voice started → playing; stopped → finished (after at least TALK_MIN)
  useEffect(() => {
    const now = performance.now();
    for (const [id, t] of talks.current) {
      if (playingId === id) t.started = true;
      else if (t.started || now - t.t0 > 2500) t.endAt = Math.max(now, t.t0 + TALK_MIN);
    }
  }, [playingId]);

  // a clock for the endings (the physics loop lives in the layer; this only checks the times)
  useEffect(() => {
    const t = setInterval(() => {
      const now = performance.now();
      for (const [id, k] of talks.current) if (now >= k.endAt) finish(id);
    }, 100);
    return () => clearInterval(t);
  }, [finish]);

  // every frame: the name plates and the bubble follow their balls; the heard ones fly into the groove, shrinking
  const onFrame = useCallback((get: (id: string) => Blob | undefined) => {
    const now = performance.now();
    const g = toFace(GROOVE.x, GROOVE.y);
    for (const [id, k] of sucks.current) {
      const b = get(id);
      if (!b) continue;
      const p = Math.min(1, (now - k.t0) / 600);
      const e = p * p;
      b.x = k.x0 + (g.x - k.x0) * e;
      b.y = k.y0 + (g.y - k.y0) * e;
      b.R = Math.max(2, k.R0 * (1 - 0.85 * e));
      b.angle += 0.3;
    }
    for (const [id, el] of tags.current) {
      const b = get(id);
      if (!b) continue;
      el.style.opacity = sucks.current.has(id) ? '0' : '1';
      el.style.transform = `translate3d(${b.x.toFixed(1)}px, ${(b.y + b.R * b.sy + 2).toFixed(1)}px, 0) translateX(-50%)`;
    }
    const tk = bubble.current?.dataset.id;
    const tb = tk ? get(tk) : undefined;
    if (bubble.current && tb) bubble.current.style.transform = `translate3d(${tb.x.toFixed(1)}px, ${(tb.y - tb.R * tb.sy - 8).toFixed(1)}px, 0) translate(-50%, -100%)`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // touch on the face: a hold opens the menu (the layer's tap is then ignored); a tap on no ball ripples
  const hitAt = (x: number, y: number): string | null => {
    let best: string | null = null;
    let bd = Infinity;
    for (const w of live.current.rolling) {
      const b = layer.current?.blob(w.id);
      if (!b || b.ghost) continue;
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
    talk(id);
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
      if (!b || b.ghost) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bd) [near, bd] = [w.id, d];
    }
    if (near) layer.current?.poke(near);
  };

  const done = hadAny && !rolling.length && !talking;
  const w0 = talking ? rolling.find((w) => w.id === talking) : undefined;
  const singer = spinning && playingId ? playingId : null;
  return (
    <div ref={root} className={s.scene}>
      <div className={s.bg} style={{ backgroundImage: `url(${cfg.art.backdrop})`, transform: 'none' }} />
      <button type="button" className={s.plate} style={{ bottom: '12%', zIndex: 5 }} onClick={onPlate} data-testid="name-plate">
        {view.owner.name}の{cfg.place}
      </button>
      {/* the painted play button: the grooves at the needle-mic */}
      {onPlay && (
        <button
          type="button"
          aria-label="全部流す"
          className={s.paintedPlay}
          style={{ left: `${PLAY_SPOT.x}%`, top: `${PLAY_SPOT.y}%`, width: `${PLAY_SPOT.r * 2}vw`, height: `${PLAY_SPOT.r * 2}vw` }}
          onClick={onPlay}
        />
      )}
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
          <StillRows items={shown} talking={talking} onTap={talk} onHold={(w, at) => onHold(w, at)} />
        ) : (
          <PuniPhysicsLayer
            ref={layer}
            items={items}
            floorAt={(x, W, H) => H * (FACE.floor - 0.015 * (x / W))}
            onTap={tapBall}
            onTapEmpty={tapEmpty}
            onFrame={onFrame}
            speakingId={talking}
          />
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
              {w.rel === 'own' ? 'あなた' : w.author.name}
            </div>
          ))}
        {w0 && !reduced && (
          <div ref={bubble} data-id={w0.id} className={s.bub} style={{ left: 0, top: 0, bottom: 'auto' }} data-testid="bubble">
            <small>🎤 {w0.rel === 'own' ? 'あなた' : w0.author.name}</small>
            {w0.text || w0.title}
          </div>
        )}
        {ripples.map((r) => (
          <span key={r.id} className={s.ripple} style={{ left: r.x, top: r.y }} aria-hidden />
        ))}
      </div>
      {done && <div className={s.done}>🎉 今日のコロリン、全部聞いたね！</div>}
      {/* 〔▶ 全部流す〕: the one singing comes out of the groove to the needle-mic */}
      {singer && <Singer id={singer} view={view} />}
    </div>
  );
}

/** reduced motion: the kororins sit still in rows on the record; a tap makes one talk, then it fades */
function StillRows({ items, talking, onTap, onHold }: { items: StageItem[]; talking: string | null; onTap: (id: string) => void; onHold: (w: StageItem, at: { x: number; y: number }) => void }) {
  return (
    <div className={s.stillRows}>
      {items.map((w) => (
        <button
          key={w.id}
          type="button"
          className={s.still}
          style={{ '--c': tagColour(w) } as CSSProperties}
          onClick={() => onTap(w.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            onHold(w, { x: e.clientX, y: e.clientY });
          }}
          data-rel={w.rel}
          data-testid="rolling"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {w.author.pic ? <img alt="" src={w.author.pic} /> : <span className={s.stillBall} />}
          <span className={s.puniTagStill}>{w.rel === 'own' ? 'あなた' : w.author.name}</span>
          {talking === w.id && (
            <span className={s.bub}>
              <small>🎤 {w.rel === 'own' ? 'あなた' : w.author.name}</small>
              {w.text || w.title}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** 〔▶ 全部流す〕: the kororin singing now, out of the groove at the needle-mic (its puni face, or a ball in its colour) */
function Singer({ id, view }: { id: string; view: SceneProps['view'] }) {
  const w = [...view.own, ...view.around].find((x) => x.id === id);
  const pic = w?.author.pic;
  return (
    <div
      className={s.atNeedle}
      style={{ left: `${NEEDLE.x}%`, top: `${NEEDLE.y}%`, background: pic ? `center / cover url(${pic})` : COLORS[hue(w?.author.id ?? id) % COLORS.length] }}
      aria-hidden
      data-testid="at-needle"
    />
  );
}
