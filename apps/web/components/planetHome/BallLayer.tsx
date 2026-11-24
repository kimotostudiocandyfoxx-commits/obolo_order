'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from 'react';
import type { KororinFace as KororinFaceId } from '@obolo/shared';
import { hop, newBall, press, release, stepBalls, THROW, type Ball } from '@/lib/planetHome/ballPhysics';
import { faceTurn, KororinFace, shadesOf } from './KororinFace';
import s from './PlanetHome.module.css';

/**
 * M-R265 (design/home/README.md §10): Saturn's balls as plain DOM, like the prototype. Each ball: an outer element
 * moved with translate3d (its position), an inner body squashed / stretched about a point near its bottom
 * (transform-origin 50% 88%), the maker's kororin (M-R266: its tinted ball, the shadow painted in, and its SVG face,
 * turned a little its own way; a blink every 4.6 s, each ball at its own moment; the eyes squint while pressed). Drag and throw; a short
 * touch is a tap. The physics (lib/planetHome/ballPhysics) runs once a frame and writes transforms only.
 */
export interface BallItem {
  id: string;
  R: number;
  pic: string;
  /** M-R266: the maker's kororin face, and a number of the ball's own (which way its face looks, when it blinks) */
  face: KororinFaceId;
  turn: number;
}

export interface BallLayerHandle {
  ball(id: string): Ball | undefined;
  /** a little hop (a tap on the record near it) */
  poke(id: string): void;
  /** let go of a ball being dragged (a hold opened the menu) */
  drop(id: string): void;
}

const TAP_MS = 260;
const TAP_PX = 9;

export const BallLayer = forwardRef<
  BallLayerHandle,
  {
    items: BallItem[];
    /** the floor, a share of the layer's height; or (M-R268) the floor's y at x, in the layer's px */
    floor: number;
    floorAt?: (x: number) => number;
    /** M-R268: the record spins — the balls hop and sway at `bpm`, drifting left */
    spin?: boolean;
    bpm?: number;
    onTap: (id: string) => void;
    onTapEmpty?: () => void;
    onFrame?: (get: (id: string) => Ball | undefined) => void;
  }
>(function BallLayer({ items, floor, floorAt, spin = false, bpm = 124, onTap, onTapEmpty, onFrame }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const balls = useRef<Ball[]>([]);
  const outer = useRef(new Map<string, HTMLDivElement>());
  const inner = useRef(new Map<string, HTMLDivElement>());
  const [W, setW] = useState(0);
  const cb = useRef({ onTap, onTapEmpty, onFrame, floorAt, spin, bpm });
  cb.current = { onTap, onTapEmpty, onFrame, floorAt, spin, bpm };
  const floorY = (x: number) => {
    const el = box.current!;
    return cb.current.floorAt ? cb.current.floorAt(x) : el.clientHeight * floor;
  };
  const grab = useRef<{ id: string | null; pid: number; t0: number; x0: number; y0: number; dx: number; dy: number; moved: boolean; hist: { t: number; x: number; y: number }[] } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // the balls follow the items: new ones drop in from above, gone ones leave
  useEffect(() => {
    if (!W) return;
    const prev = new Map(balls.current.map((b) => [b.id, b]));
    balls.current = items.map((it, i) => {
      const old = prev.get(it.id);
      if (old) {
        old.R = it.R;
        return old;
      }
      const x = Math.max(it.R, Math.min(W - it.R, W * (0.1 + ((i * 0.618) % 1) * 0.8)));
      const b = newBall(it.id, x, -it.R * 2 - (i % 6) * it.R * 1.6, it.R, i * 1.7, it.turn);
      b.vx = (Math.random() - 0.5) * 120;
      return b;
    });
  }, [items, W]);

  useImperativeHandle(ref, () => ({
    ball: (id) => balls.current.find((b) => b.id === id),
    poke(id) {
      const b = balls.current.find((x) => x.id === id);
      if (!b) return;
      b.vy = -520 - Math.random() * 160;
      b.vx += (Math.random() - 0.5) * 200;
      b.wv += 2.4;
    },
    drop(id) {
      const b = balls.current.find((x) => x.id === id);
      if (b) b.drag = false;
      if (grab.current?.id === id) grab.current.id = null;
      inner.current.get(id)?.classList.remove(s.ballHeld);
    },
  }));

  // one loop: step, write transforms, then the scene's own per-frame work (the name plates)
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastBeat = -1;
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (now: number) => {
      const el = box.current;
      if (el) {
        const dt = (now - last) / 1000;
        last = now;
        const c = cb.current;
        const world = { floor: el.clientHeight * floor, floorAt: c.floorAt, left: 0, right: el.clientWidth, reduced, spin: c.spin && !reduced, bpm: c.bpm };
        if (world.spin) {
          const beat = Math.floor((now / 1000) * (c.bpm / 60));
          if (beat !== lastBeat) hop(balls.current, beat, world);
          lastBeat = beat;
        }
        stepBalls(balls.current, dt, now / 1000, { ...world, beat: lastBeat });
        for (const b of balls.current) {
          const o = outer.current.get(b.id);
          const n = inner.current.get(b.id);
          if (o) o.style.transform = `translate3d(${(b.x - b.R).toFixed(2)}px, ${(b.y - b.R).toFixed(2)}px, 0)`;
          if (n) n.style.transform = `rotate(${b.tilt.toFixed(2)}deg) scale(${b.sx.toFixed(4)}, ${b.sy.toFixed(4)})`;
        }
        cb.current.onFrame?.((id) => balls.current.find((b) => b.id === id));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [floor]);

  const local = (e: PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const hit = (x: number, y: number) => {
    let best: Ball | null = null;
    let bd = Infinity;
    for (const b of balls.current) {
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < b.R * 1.15 && d < bd) [best, bd] = [b, d];
    }
    return best as Ball | null;
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    const p = local(e);
    const b = hit(p.x, p.y);
    const t = performance.now();
    grab.current = { id: b?.id ?? null, pid: e.pointerId, t0: t, x0: p.x, y0: p.y, dx: b ? b.x - p.x : 0, dy: b ? b.y - p.y : 0, moved: false, hist: [{ t, x: p.x, y: p.y }] };
    if (!b) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    b.drag = true;
    b.vx = b.vy = 0;
    press(b);
    inner.current.get(b.id)?.classList.add(s.ballHeld);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const g = grab.current;
    if (!g || g.pid !== e.pointerId) return;
    const p = local(e);
    if (Math.hypot(p.x - g.x0, p.y - g.y0) > TAP_PX) g.moved = true;
    const b = g.id ? balls.current.find((x) => x.id === g.id) : null;
    if (!b || !b.drag) return;
    const el = box.current!;
    b.x = Math.max(b.R, Math.min(el.clientWidth - b.R, p.x + g.dx));
    b.y = Math.min(floorY(b.x) - b.R, p.y + g.dy);
    const t = performance.now();
    g.hist.push({ t, x: p.x, y: p.y });
    while (g.hist.length > 2 && t - g.hist[0].t > 90) g.hist.shift();
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const g = grab.current;
    if (!g || g.pid !== e.pointerId) return;
    grab.current = null;
    const tap = !g.moved && performance.now() - g.t0 < TAP_MS + 400;
    const b = g.id ? balls.current.find((x) => x.id === g.id) : null;
    if (b) {
      inner.current.get(b.id)?.classList.remove(s.ballHeld);
      if (!b.drag) return; // the hold took it
      b.drag = false;
      const h0 = g.hist[0];
      const h1 = g.hist[g.hist.length - 1];
      const dt = Math.max(16, h1.t - h0.t) / 1000;
      if (!tap) {
        // M-R268: a throw carries 0.6 of the hand's speed (the calmer motion)
        b.vx = ((h1.x - h0.x) / dt) * THROW;
        b.vy = ((h1.y - h0.y) / dt) * THROW;
        release(b);
      } else {
        b.wv += 1.5;
        cb.current.onTap(b.id);
      }
      return;
    }
    if (tap) cb.current.onTapEmpty?.();
  };

  return (
    <div ref={box} className={s.ballLayer} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-testid="ball-layer">
      {items.map((it) => {
        const turn = faceTurn(it.turn);
        return (
        <div
          key={it.id}
          ref={(el) => {
            if (el) outer.current.set(it.id, el);
            else outer.current.delete(it.id);
          }}
          className={s.ball}
          style={{ width: it.R * 2, height: it.R * 2, transform: 'translate3d(-999px, -999px, 0)' }}
          data-ball={it.id}
        >
          <div
            ref={(el) => {
              if (el) inner.current.set(it.id, el);
              else inner.current.delete(it.id);
            }}
            className={s.ballBody}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" src={it.pic} draggable={false} />
            <KororinFace face={it.face} delay={turn.delay} style={{ transform: turn.transform }} shades={shadesOf(it.turn)} />
          </div>
        </div>
        );
      })}
    </div>
  );
});
