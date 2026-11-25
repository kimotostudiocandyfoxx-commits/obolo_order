'use client';

import { Children, createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { clusterPerRow, clusterSpots, floatParams, relicSeed } from '@/lib/relic/layout';

/**
 * R12 (client 2026-11-25): 「画像を貼ったとき、普通のチャットアプリみたいにベタっと貼るのは味気ない。スペルみたいにふわっと浮かせて、
 * まわりに少し神秘的な動きを」 — everything sent into the Bati chat and the ダチ / KIMORIN talks floats as a relic, in the
 * family of the spell's talismans (FloatingSpell): its own slow bob and tilt (phase from its id), a soft aura, a few
 * motes drifting up from its edges, a faint shadow on the floor under it that shrinks as it rises, and a small magical
 * entrance (out of a blur of light). It belongs to its message (it scrolls with the talk), on the sender's side.
 * prefers-reduced-motion: no motion at all, the glow stays (a calm still relic).
 *
 * This file: the float (Relic), several sent together (RelicCluster), and the whole-screen view a relic opens into,
 * grown out of the relic itself (RelicHost / useRelicOpen — TalkScene hosts it).
 */

export const RELIC_CSS = `
@keyframes rl-in{0%{opacity:0;transform:translateY(18px) scale(.84);filter:blur(9px) brightness(2.4)}55%{opacity:1;filter:blur(0) brightness(1.35)}100%{opacity:1;transform:none;filter:none}}
@keyframes rl-flash{0%{opacity:0;transform:translate(-50%,-50%) scale(.25)}30%{opacity:.95}100%{opacity:0;transform:translate(-50%,-50%) scale(1.7)}}
@keyframes rl-bob{0%,100%{transform:translate(0,0) rotate(var(--t0))}50%{transform:translate(var(--dx),calc(var(--lift) * -1)) rotate(var(--t1))}}
@keyframes rl-floor{0%,100%{transform:translateX(-50%) scale(1);opacity:.5}50%{transform:translateX(-50%) scale(.8);opacity:.28}}
@keyframes rl-aura{0%,100%{opacity:.6;transform:translate(-50%,-50%) scale(.95)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.07)}}
@keyframes rl-mote{0%{opacity:0;transform:translate(0,0) scale(.5)}18%{opacity:1}100%{opacity:0;transform:translate(var(--mx),var(--my)) scale(1.15)}}
@keyframes rl-twinkle{0%,100%{opacity:.25;transform:scale(.6) rotate(0)}50%{opacity:1;transform:scale(1.1) rotate(45deg)}}
@keyframes rl-sheen{0%,72%{transform:translateX(-140%) skewX(-18deg)}100%{transform:translateX(260%) skewX(-18deg)}}
@keyframes rl-spin{to{transform:rotate(360deg)}}
@keyframes rl-ripple{0%{transform:translate(-50%,-50%) scale(.86);opacity:.55}100%{transform:translate(-50%,-50%) scale(1.45);opacity:0}}
@keyframes rl-tap{0%{transform:scale(1)}35%{transform:scale(1.07);filter:brightness(1.45)}100%{transform:scale(1)}}
@keyframes rl-portal{0%{transform:scale(1);filter:none}55%{transform:scale(1.16);filter:brightness(1.9) saturate(1.3)}100%{transform:scale(.94);filter:brightness(2.6) blur(2px);opacity:.35}}
@keyframes rl-swirl{to{transform:rotate(-360deg) scale(1.15)}}
@keyframes rl-liquid{0%,100%{background-position:0% 0%}50%{background-position:100% 100%}}
@keyframes rl-view-in{from{opacity:0}to{opacity:1}}
@keyframes rl-bloom{0%{opacity:.9;transform:translate(-50%,-50%) scale(.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.6)}}
@media (prefers-reduced-motion: reduce){[data-relic] *,[data-relic-view] *{animation:none!important;transition:none!important}}
`;

let cssIn = false;
/** the relics' keyframes, once per page */
export function useRelicCss() {
  useEffect(() => {
    if (cssIn || document.getElementById('relic-css')) return;
    cssIn = true;
    const s = document.createElement('style');
    s.id = 'relic-css';
    s.textContent = RELIC_CSS;
    document.head.appendChild(s);
  }, []);
}

export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** the world's writing (the talk's serif) */
export const RELIC_SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

// ---- the slot a relic floats in (a cluster gives each its scale and its place in the phase) ----

type Slot = { scale: number; k: number };
const SlotCtx = createContext<Slot>({ scale: 1, k: 0 });
export const useRelicSlot = () => useContext(SlotCtx);
/** a width: `f` × the talk's relic width × the slot's scale */
export const relicW = (f: number) => `calc(var(--relic-w, 230px) * var(--rs, 1) * ${f})`;

// ---- the float ----

export type RelicProps = {
  /** its id (its bob, tilt and motes follow it) */
  id: string;
  /** the colour of its aura and motes */
  aura: string;
  mote?: string;
  /** what a screen reader hears for its tap */
  label: string;
  /** the tap: gets the relic's box (a view grows out of it) */
  onTap?: (from: DOMRect) => void;
  /** a shadow on the floor under it (off for things that are light themselves) */
  floor?: boolean;
  /** how far the aura reaches past it (px) */
  spread?: number;
  /** the little play on a tap ('portal' flares open) */
  tapFx?: 'pulse' | 'portal' | null;
  /** words under it, not floating with it (the name / size plate stays readable) */
  under?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  testId?: string;
};

export function Relic({ id, aura, mote, label, onTap, floor = true, spread = 26, tapFx = 'pulse', under, children, className, style, testId }: RelicProps) {
  useRelicCss();
  const { scale, k } = useRelicSlot();
  const f = floatParams(id, k);
  const box = useRef<HTMLButtonElement>(null);
  const [tap, setTap] = useState(0);
  const seed = relicSeed(id);
  const motes = MOTE_SPOTS.map((m, i) => ({ ...m, d: 3.2 + ((seed >>> i) % 5) * 0.45, delay: -(((seed >>> (i * 3)) % 40) / 10) }));
  return (
    <div data-relic className={`relative ${className ?? ''}`} style={{ ['--rs' as string]: scale, ...style }} data-testid={testId}>
      <div style={{ animation: 'rl-in 1.1s cubic-bezier(.25,.8,.3,1) both' }}>
        <div className="relative">
        {/* the flash it comes out of */}
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-[45%] block h-[120%] w-[120%] rounded-full" style={{ background: `radial-gradient(circle, ${mote ?? aura}, transparent 62%)`, animation: 'rl-flash 1.2s ease-out both', opacity: 0 }} />
        <div
          className="relative"
          style={{
            ['--t0' as string]: `${f.tilt0}deg`,
            ['--t1' as string]: `${f.tilt1}deg`,
            ['--dx' as string]: `${f.dx}px`,
            ['--lift' as string]: `${f.lift}px`,
            transform: `rotate(${f.tilt0}deg)`,
            animation: `rl-bob ${f.dur}s ease-in-out ${f.delay}s infinite`,
          }}
        >
          {/* its aura */}
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 block rounded-[50%]" style={{ width: `calc(100% + ${spread * 2}px)`, height: `calc(100% + ${spread * 2}px)`, background: `radial-gradient(ellipse at center, ${aura}, transparent 66%)`, transform: 'translate(-50%,-50%)', animation: `rl-aura ${f.dur * 0.7}s ease-in-out ${f.delay}s infinite` }} />
          <button
            ref={box}
            type="button"
            aria-label={label}
            onClick={(e) => {
              e.stopPropagation();
              setTap(Date.now());
              const r = box.current?.getBoundingClientRect();
              if (r) onTap?.(r);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="relative block cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-200/70"
            style={{ animation: tap && tapFx ? (tapFx === 'portal' ? 'rl-portal .42s ease-in both' : 'rl-tap .45s ease-out') : undefined, borderRadius: 8 }}
            key={tap && tapFx === 'portal' ? tap : 'still'}
          >
            {children}
          </button>
          {/* motes drifting up from its edges */}
          {motes.map((m, i) => (
            <span
              key={i}
              aria-hidden
              className="pointer-events-none absolute block rounded-full"
              style={{ left: `${m.x}%`, top: `${m.y}%`, width: m.s, height: m.s, background: mote ?? '#fff', boxShadow: `0 0 6px ${mote ?? '#fff'}`, ['--mx' as string]: `${m.mx}px`, ['--my' as string]: `${m.my}px`, animation: `rl-mote ${m.d}s ease-out ${m.delay}s infinite`, opacity: 0 }}
            />
          ))}
        </div>
        {/* its shadow on the floor (breathes against the bob) */}
        {floor && <span aria-hidden className="pointer-events-none absolute left-1/2 block h-[10px] w-[64%] rounded-[50%]" style={{ bottom: -15, background: 'radial-gradient(ellipse at center, rgba(2,4,20,.6), transparent 70%)', animation: `rl-floor ${f.dur}s ease-in-out ${f.delay}s infinite`, transform: 'translateX(-50%)' }} />}
        </div>
        {under && <div className="relative mt-[18px]">{under}</div>}
      </div>
    </div>
  );
}

/** where the motes start (% of the relic) and where they drift (px) */
const MOTE_SPOTS = [
  { x: -4, y: 70, s: 3, mx: -10, my: -34 },
  { x: 102, y: 40, s: 2.5, mx: 9, my: -30 },
  { x: 18, y: -4, s: 2, mx: -4, my: -26 },
  { x: 88, y: 92, s: 3, mx: 12, my: -38 },
  { x: 55, y: -6, s: 2, mx: 5, my: -22 },
];

/** a small four-point star (the corners of a frame, a portal's rim) */
export function Glint({ size = 9, color = '#fff', style }: { size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" width={size} height={size} className="pointer-events-none absolute" style={{ filter: `drop-shadow(0 0 3px ${color})`, ...style }}>
      <path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill={color} />
    </svg>
  );
}

// ---- several sent together ----

function useWidth() {
  const [w, setW] = useState(390);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

/**
 * the relics of one message (or of several sent together): one floats plain; several as a small cluster (each a little
 * smaller, staggered, leaning its own way, overlapping slightly, out of phase), the sender's side first
 */
export function RelicCluster({ children, mine }: { children: ReactNode; mine: boolean }) {
  const items = Children.toArray(children);
  const perRow = clusterPerRow(useWidth());
  const spots = clusterSpots(items.length, perRow);
  return (
    <div className={`flex flex-wrap items-start ${mine ? 'flex-row-reverse' : ''} ${items.length > 1 ? 'pb-4' : ''}`} style={{ ['--relic-w' as string]: 'clamp(176px, 56vw, 268px)', paddingTop: 8 }} data-relic-cluster={items.length}>
      {items.map((c, i) => {
        const s = spots[i];
        return (
          <div key={i} className="relative" style={{ transform: `translate(${mine ? -s.dx : s.dx}px, ${s.dy}px) rotate(${s.rot}deg)`, zIndex: s.z, margin: items.length > 1 ? '0 2px 6px' : undefined }}>
            <SlotCtx.Provider value={{ scale: s.scale, k: i }}>{c}</SlotCtx.Provider>
          </div>
        );
      })}
    </div>
  );
}

// ---- the whole-screen view, grown out of the relic ----

type View = { node: ReactNode; from: DOMRect | null; label: string; tone?: string };
const OpenCtx = createContext<((v: View) => void) | null>(null);
/** open a relic's whole-screen view (no host: nothing happens) */
export const useRelicOpen = () => useContext(OpenCtx) ?? (() => undefined);

/** TalkScene's host of the view (absolute: it fills the talk) */
export function RelicHost({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View | null>(null);
  const open = useCallback((v: View) => setView(v), []);
  return (
    <OpenCtx.Provider value={open}>
      {children}
      {view && <RelicView view={view} onClose={() => setView(null)} />}
    </OpenCtx.Provider>
  );
}

function RelicView({ view, onClose }: { view: View; onClose: () => void }) {
  useRelicCss();
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [grow, setGrow] = useState<CSSProperties>({ opacity: 0 });
  const [bloom, setBloom] = useState<{ x: number; y: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  // FLIP: from the relic's box to its place in the middle
  useLayoutEffect(() => {
    const b = body.current?.getBoundingClientRect();
    const r = root.current?.getBoundingClientRect();
    const f = view.from;
    if (!b || !r || !f || reducedMotion()) return setGrow({});
    const s = Math.max(0.08, Math.min(1, f.width / Math.max(1, b.width)));
    setBloom({ x: f.left + f.width / 2 - r.left, y: f.top + f.height / 2 - r.top });
    setGrow({ transform: `translate(${f.left + f.width / 2 - (b.left + b.width / 2)}px, ${f.top + f.height / 2 - (b.top + b.height / 2)}px) scale(${s})`, opacity: 0.6, transition: 'none' });
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGrow({ transform: 'none', opacity: 1, transition: 'transform .55s cubic-bezier(.2,.9,.25,1), opacity .3s ease-out' })));
    return () => cancelAnimationFrame(id);
  }, [view]);
  const close = () => {
    if (reducedMotion()) return onClose();
    setLeaving(true);
    setTimeout(onClose, 240);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={root}
      data-relic-view
      role="dialog"
      aria-modal="true"
      aria-label={view.label}
      className="absolute inset-0 z-[34] flex flex-col items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(26,34,92,.86), rgba(5,7,26,.94) 70%)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'rl-view-in .35s ease-out both', opacity: leaving ? 0 : 1, transition: 'opacity .24s ease-in' }}
      onClick={close}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {bloom && <span aria-hidden className="pointer-events-none absolute block h-40 w-40 rounded-full" style={{ left: bloom.x, top: bloom.y, background: `radial-gradient(circle, ${view.tone ?? 'rgba(200,225,255,.9)'}, transparent 65%)`, animation: 'rl-bloom .8s ease-out both' }} />}
      <div ref={body} className="relative w-full max-w-[min(92vw,560px)]" style={{ ...grow, transformOrigin: '50% 50%', ...(leaving ? { transform: 'scale(.94)', transition: 'transform .24s ease-in' } : {}) }} onClick={(e) => e.stopPropagation()}>
        {view.node}
      </div>
      <button onClick={close} className="mt-5 rounded-full border border-[rgba(210,220,255,.25)] bg-[rgba(16,22,64,.6)] px-5 py-2 text-[13px] font-bold text-[#f4f1ff] backdrop-blur-[10px]">
        とじる
      </button>
    </div>
  );
}
