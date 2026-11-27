'use client';

import { BLUENA_PLANETS, JOURNEY_DONE, type BluenaPlanet } from '@obolo/shared';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isOpen, UNLOCK_DAY } from '@/lib/atelier/unlock';
import { PLANET_COLOR, PLANET_GLYPH, PLANET_KIND, PLANET_NAME } from '@/lib/finds/works';
import { Glyph } from './glyphs';
import { PlanetMark } from './PlanetMark';

/** a planet can be made for today (M-R341: 物語 day 8 · ゲーム day 9 · グッズ day 10, like the planets before them) */
export function planetOpen(p: BluenaPlanet, day: number | null | undefined): boolean {
  const k = PLANET_KIND[p];
  if (k) return isOpen(k, day);
  return day == null || day >= JOURNEY_DONE;
}
/** today is the day it opens (it lights up) */
const opensToday = (p: BluenaPlanet, day: number | null | undefined) => {
  const k = PLANET_KIND[p];
  return day != null && day < JOURNEY_DONE && (k ? UNLOCK_DAY[k] === day : day === JOURNEY_DONE);
};

const CSS = `
@keyframes bluena-light { 0% { filter: grayscale(1) brightness(.3); } 60% { filter: grayscale(0) brightness(1.6) drop-shadow(0 0 14px var(--c)); } 100% { filter: none; } }
@keyframes bluena-halo { 0%,100% { opacity: .25; transform: scale(1); } 50% { opacity: .8; transform: scale(1.18); } }
`;

/**
 * Bluena's first view (M-R237 §2): the Moon in the middle (your own look, {bati} with it) and the eight planets going
 * round it; a finger drags them round. A planet not open yet is dark, and lights up on the day it opens. No words —
 * the planets' pictures and marks only (names for screen readers). 〔すべて〕 small beside the Moon.
 */
export function BluenaOrbit({ day, face, bati, onPlanet, onAll, onMoon }: { day: number | null | undefined; face?: string | null; bati?: string | null; onPlanet: (p: BluenaPlanet) => void; onAll: () => void; onMoon: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(296);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const [spin, setSpin] = useState(-Math.PI / 2);
  const drag = useRef<{ a: number; spin: number; moved: number; last: number; t: number; v: number } | null>(null);
  // a slow drift by itself, and the throw after a drag
  const vel = useRef(0.0012);
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(50, now - prev);
      prev = now;
      if (!drag.current) {
        // the throw slows down to the slow drift
        vel.current = vel.current * 0.96 + (reduced ? 0 : 0.00012) * 0.04;
        setSpin((s) => s + vel.current * dt);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const h = Math.min(w * 1.02, 330);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 30;
  const ry = h / 2 - 32;
  const angle = (e: React.PointerEvent) => {
    const b = box.current!.getBoundingClientRect();
    return Math.atan2(e.clientY - b.top - cy, e.clientX - b.left - cx);
  };

  return (
    <div
      ref={box}
      className="relative mx-auto w-full touch-none select-none"
      style={{ height: h }}
      onPointerDown={(e) => {
        drag.current = { a: angle(e), spin, moved: 0, last: angle(e), t: performance.now(), v: 0 };
        vel.current = 0;
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const a = angle(e);
        let da = a - d.last;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        const now = performance.now();
        d.v = da / Math.max(1, now - d.t);
        d.t = now;
        d.last = a;
        d.moved += Math.abs(da);
        if (d.moved > 0.06) (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        setSpin((s) => s + da);
      }}
      onPointerUp={() => {
        const d = drag.current;
        if (d && d.moved > 0.06) vel.current = Math.max(-0.01, Math.min(0.01, d.v));
        setTimeout(() => (drag.current = null), 0);
      }}
      onPointerCancel={() => (drag.current = null)}
      onClickCapture={(e) => {
        // a drag is not a tap on a planet
        if (drag.current && drag.current.moved > 0.06) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      <style>{CSS}</style>
      {/* the orbit's faint ring */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="rgba(160,210,255,0.18)" strokeDasharray="2 6" />
        <ellipse cx={cx} cy={cy} rx={rx * 0.55} ry={ry * 0.55} fill="none" stroke="rgba(160,210,255,0.08)" />
      </svg>

      {/* the Moon: you, and {bati} with you */}
      <button onClick={onMoon} aria-label="月（自分の姿とバティ）" className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: cx, top: cy }}>
        <span className="relative block h-[88px] w-[88px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#fffdf3,#d9d6c8_55%,#8f8c82)] p-[3px] shadow-[0_0_34px_rgba(255,250,220,0.35)]">
          {face && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={face} alt="" className="h-full w-full rounded-full object-cover" />
          )}
          {bati && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bati} alt="" className="absolute -bottom-1 -right-2 h-10 w-10 rounded-full border-2 border-[#0b0f24] bg-[#1a2244] object-contain" />
          )}
        </span>
      </button>
      {/* 〔すべて〕 small beside the Moon */}
      <button onClick={onAll} className="absolute rounded-full border border-sky-200/40 bg-sky-300/15 px-2 py-0.5 text-[10.5px] text-sky-50" style={{ left: cx + 50, top: cy - 46 }}>
        すべて
      </button>

      {BLUENA_PLANETS.map((p, i) => {
        const a = spin + (i * Math.PI * 2) / BLUENA_PLANETS.length;
        const x = cx + Math.cos(a) * rx;
        const y = cy + Math.sin(a) * ry;
        // the far side is a little smaller (depth)
        const depth = 0.82 + 0.18 * ((Math.sin(a) + 1) / 2);
        const open = planetOpen(p, day);
        const fresh = open && opensToday(p, day);
        const size = Math.round(40 * depth);
        return (
          <button
            key={p}
            onClick={() => open && onPlanet(p)}
            aria-label={PLANET_NAME[p]}
            aria-disabled={!open}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: x, top: y, zIndex: Math.round(depth * 10) }}
          >
            {fresh && <span className="absolute inset-[-10px] rounded-full" style={{ background: `radial-gradient(circle, ${PLANET_COLOR[p]}88, transparent 70%)`, animation: 'bluena-halo 2.4s ease-in-out infinite' }} />}
            <span
              className="relative block"
              style={{ ['--c' as string]: PLANET_COLOR[p], filter: open ? undefined : 'grayscale(1) brightness(0.32)', opacity: open ? 1 : 0.75, animation: fresh ? 'bluena-light 2.6s ease-out both' : undefined }}
            >
              <PlanetMark id={p} size={size} />
            </span>
            <span className="absolute -bottom-1 -right-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-1" style={{ background: open ? PLANET_COLOR[p] : '#20263c', color: open ? '#0b0f24' : '#5b6280', ['--tw-ring-color' as string]: '#0b0f24' }}>
              <Glyph id={PLANET_GLYPH[p]} label={false} className="h-3 w-3" strokeWidth={2.1} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
