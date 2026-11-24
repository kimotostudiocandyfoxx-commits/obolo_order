'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import type { StageItem } from '@/lib/planetHome/model';
import type { At } from '@/lib/planetHome/useHold';
import type { SceneProps } from './skin';
import { pictureOf, Residents } from './TemplateScene';
import s from './PlanetHome.module.css';

/**
 * Saturn (M-R259, docs/story-rewrite/土星_自分のレコード.md §3; design/home Saturn mode): the new kororins roll about on
 * your record. Poke one (it hops), flick it (it rolls off), or pick it up and throw it (it flies and bounces) — it talks
 * while it moves, with its maker's name and words in a bubble over its head, and when it has finished it is drawn into
 * the grooves (not deleted: heard, kept on this device). When every one has been heard the record clears with
 * 「今日のコロリン、全部聞いたね！」. 〔▶ 全部流す〕 (the frame's big button) plays the grooves at the needle-mic.
 *
 * Simple physics on requestAnimationFrame, written straight to the elements (no React render per frame). With
 * prefers-reduced-motion the kororins lie still and only fade into the grooves.
 */
const SIZE = 58;
/** where they roll: x 20–80%, the floor 60–74% of the height (the record's face in the backdrop) */
const BOX = { x0: 0.2, x1: 0.8, y0: 0.6, y1: 0.74 };
/** the grooves they are drawn into, and the needle-mic */
const GROOVE = { x: 0.42, y: 0.68 };
const NEEDLE = { x: 70, y: 58 };
const HOLD_MS = 480;
/** a kororin talks at least this long (so its bubble can be read), at most this long if its voice never ends */
const TALK_MIN = 1600;
const TALK_MAX = 20000;

type Body = {
  w: StageItem;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  fl: number;
  drag: boolean;
  talk: boolean;
  gone: boolean;
  t0: number;
  started: boolean;
  endAt: number;
  el: HTMLDivElement | null;
  spin: HTMLDivElement | null;
  /** where it lies, as shares of the record's box (placed once the size is known) */
  fx: number;
  ff: number;
  falls: boolean;
  placed: boolean;
  down: { x: number; y: number; lx: number; ly: number; lt: number; held: boolean; timer: ReturnType<typeof setTimeout> | null } | null;
};

const colourOf = (w: StageItem) => (w.rel === 'oshi' ? 'var(--oshi)' : w.rel === 'own' ? 'var(--mine)' : 'var(--dachi)');

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

export function SaturnRollScene({ cfg, view, rolling, playingId, spinning, onPlace, onPlate, onItem, onHold, onHeard, onResident }: SceneProps) {
  const root = useRef<HTMLDivElement>(null);
  const bodies = useRef(new Map<string, Body>());
  const size = useRef({ W: 390, H: 760 });
  const [talking, setTalking] = useState<Set<string>>(new Set());
  const [hadAny, setHadAny] = useState(false);
  const reduced = useReducedMotion();
  const live = useRef({ onItem, onHeard, playingId, reduced });
  live.current = { onItem, onHeard, playingId, reduced };

  // the record's size (the box is a share of it)
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const set = () => (size.current = { W: el.clientWidth, H: el.clientHeight });
    set();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // new ones join (kept in a ref, so the touch handlers have them from the first render)
  rolling.forEach((w, i) => {
    if (bodies.current.has(w.id)) return;
    const fx = BOX.x0 + (((i * 53 + 17) % 100) / 100) * (BOX.x1 - BOX.x0);
    const ff = BOX.y0 + (((i * 37) % 100) / 100) * (BOX.y1 - BOX.y0);
    // what came since the last visit is still falling in (ひゅう、ぽとん)
    const falls = !!w.fresh && !reduced;
    bodies.current.set(w.id, { w, x: 0, y: 0, vx: (((i * 29) % 10) / 10 - 0.5) * 1.5, vy: 0, rot: 0, fl: 0, drag: false, talk: false, gone: false, t0: 0, started: false, endAt: 0, el: null, spin: null, fx, ff, falls, placed: false, down: null });
  });
  useEffect(() => {
    if (rolling.length) setHadAny(true);
  }, [rolling]);

  /** its place on screen once the record's size is known */
  const settle = (b: Body, i = 0) => {
    const { W, H } = size.current;
    b.fl = H * b.ff;
    if (b.placed) return;
    b.placed = true;
    b.x = W * b.fx;
    b.y = b.falls ? H * 0.2 - i * 40 : b.fl;
  };

  const place = (b: Body) => {
    if (!b.el) return;
    b.el.style.transform = `translate3d(${b.x - SIZE / 2}px, ${b.y - SIZE / 2}px, 0)`;
    if (b.spin) b.spin.style.transform = `rotate(${b.rot}deg)`;
  };

  // into the grooves: drawn in with a spin, then heard
  const finish = useCallback((b: Body) => {
    if (b.gone) return;
    b.gone = true;
    const { W, H } = size.current;
    if (b.el) {
      b.el.style.transition = 'transform .6s ease-in, opacity .6s ease-in';
      b.el.style.transform = `translate3d(${W * GROOVE.x - SIZE / 2}px, ${H * GROOVE.y - SIZE / 2}px, 0) scale(.15) rotate(540deg)`;
      b.el.style.opacity = '0';
    }
    setTimeout(() => {
      bodies.current.delete(b.w.id);
      setTalking((t) => {
        const n = new Set(t);
        n.delete(b.w.id);
        return n;
      });
      live.current.onHeard(b.w.id);
    }, 650);
  }, []);

  const talk = useCallback((b: Body) => {
    if (b.talk || b.gone) return;
    b.talk = true;
    b.t0 = performance.now();
    b.started = false;
    b.endAt = b.t0 + (b.w.url ? TALK_MAX : TALK_MIN + 600);
    setTalking((t) => new Set(t).add(b.w.id));
    live.current.onItem(b.w);
  }, []);

  // its voice: started → playing; stopped → it has finished (after at least TALK_MIN)
  useEffect(() => {
    const now = performance.now();
    for (const b of bodies.current.values()) {
      if (!b.talk || b.gone) continue;
      if (playingId === b.w.id) b.started = true;
      else if (b.started || now - b.t0 > 2500) b.endAt = Math.max(now, b.t0 + TALK_MIN);
    }
  }, [playingId]);

  // the loop: gravity, the floor (bounce, then roll and slow down), the record's edges
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const now = performance.now();
      const { W } = size.current;
      let i = 0;
      for (const b of bodies.current.values()) {
        settle(b, i++);
        if (b.gone) continue;
        if (b.talk && now >= b.endAt) {
          finish(b);
          continue;
        }
        if (b.drag) continue;
        if (!live.current.reduced) {
          b.vy += 0.45;
          b.x += b.vx;
          b.y += b.vy;
          if (b.y > b.fl) {
            b.y = b.fl;
            b.vy *= -0.45;
            b.vx *= 0.9;
            if (Math.abs(b.vy) < 1) b.vy = 0;
          }
          const x0 = W * BOX.x0;
          const x1 = W * BOX.x1;
          if (b.x < x0) {
            b.x = x0;
            b.vx = Math.abs(b.vx) * 0.7;
          }
          if (b.x > x1) {
            b.x = x1;
            b.vx = -Math.abs(b.vx) * 0.7;
          }
          // lying on the record: it keeps rolling a little
          if (b.vy === 0 && b.y >= b.fl) b.vx = b.vx * 0.96 + (Math.random() - 0.5) * 0.08;
          b.rot += b.vx * 2;
        }
        place(b);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [finish]);

  // touch: poke (hop), flick (roll off), pick up and throw; hold for the menu
  const pointer = (b: Body | undefined) => {
    if (!b) return {};
    const root0 = () => root.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return {
      onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
        if (b.gone) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const at: At = { x: e.clientX, y: e.clientY };
        const down = (b.down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), held: false, timer: null as ReturnType<typeof setTimeout> | null });
        down.timer = setTimeout(() => {
          if (b.down !== down) return;
          down.held = true;
          b.drag = false;
          onHold(b.w, at);
        }, HOLD_MS);
      },
      onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
        const down = b.down;
        if (!down || down.held || live.current.reduced) return;
        const dx = e.clientX - down.lx;
        const dy = e.clientY - down.ly;
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
          if (down.timer) clearTimeout(down.timer);
          down.timer = null;
          b.drag = true;
        }
        if (!b.drag) return;
        const dt = Math.max(8, performance.now() - down.lt);
        const r = root0();
        b.x = Math.min(Math.max(e.clientX - r.left, 0), size.current.W);
        b.y = Math.min(Math.max(e.clientY - r.top, 0), size.current.H);
        b.vx = (dx / dt) * 16;
        b.vy = (dy / dt) * 16;
        down.lx = e.clientX;
        down.ly = e.clientY;
        down.lt = performance.now();
      },
      onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
        const down = b.down;
        if (!down) return;
        if (down.timer) clearTimeout(down.timer);
        const held = down.held;
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        b.down = null;
        b.drag = false;
        if (held) return;
        if (moved < 6) {
          // a poke: it hops where it is
          b.vy = -7;
          b.vx = (Math.random() - 0.5) * 3;
        }
        talk(b);
      },
      onPointerCancel: () => {
        if (b.down?.timer) clearTimeout(b.down.timer);
        b.down = null;
        b.drag = false;
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          b.vy = -7;
          talk(b);
        }
      },
      onContextMenu: (e: MouseEvent) => e.preventDefault(),
    };
  };

  const singer = spinning && playingId ? playingId : null;
  const done = hadAny && !rolling.length && !talking.size;
  return (
    <div ref={root} className={s.scene}>
      <div className={s.bg} style={{ backgroundImage: `url(${cfg.art.backdrop})` }} />
      <div className={`${s.spin} ${spinning ? s.spinOn : ''}`} aria-hidden />
      <button type="button" className={s.place} onClick={onPlace} aria-label={`${view.owner.name}の${cfg.place}`} />
      <button type="button" className={s.plate} onClick={onPlate} data-testid="name-plate">
        {view.owner.name}の{cfg.place}
      </button>
      <Residents cfg={cfg} onResident={onResident} />
      <div className={s.sky}>
        {rolling.map((w) => {
          const b = bodies.current.get(w.id);
          const pic = pictureOf(w, cfg.planet, cfg.open).body || cfg.art.sprite;
          const on = talking.has(w.id);
          return (
            <div
              key={w.id}
              ref={(el) => {
                const bb = bodies.current.get(w.id);
                if (bb) {
                  bb.el = el;
                  if (bb.placed) place(bb);
                }
              }}
              className={`${s.roll} ${on ? s.talk : ''} ${w.fresh ? s.new : ''}`}
              style={{ '--c': colourOf(w) } as CSSProperties}
              role="button"
              tabIndex={0}
              aria-label={`${w.rel === 'own' ? 'あなた' : w.author.name}のコロリン`}
              data-rel={w.rel}
              data-testid="rolling"
              {...pointer(b)}
            >
              <div
                className={s.rollSpin}
                ref={(el) => {
                  const bb = bodies.current.get(w.id);
                  if (bb) bb.spin = el;
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" src={pic} draggable={false} />
                <div className={s.rim} />
              </div>
              {on && (
                <div className={s.bub} data-testid="bubble">
                  <small>🎤 {w.rel === 'own' ? 'あなた' : w.author.name}</small>
                  {w.text || w.title}
                </div>
              )}
            </div>
          );
        })}
        {done && <div className={s.done}>🎉 今日のコロリン、全部聞いたね！</div>}
      </div>
      {/* 〔▶ 全部流す〕: the one singing comes out of the grooves to the needle-mic */}
      {singer && (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" src={cfg.art.sprite} className={s.atNeedle} style={{ left: `${NEEDLE.x}%`, top: `${NEEDLE.y}%` }} />
      )}
    </div>
  );
}
