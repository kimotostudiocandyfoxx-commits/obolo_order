'use client';

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';

/**
 * Touch controls for the DJ screen. Each control captures its own pointer, so several fingers can
 * move several controls at once (multi-touch); nothing scrolls the page while touching.
 */

/** Keep this pointer on this control while the finger moves (multi-touch: one pointer per control). */
function capture(e: RPointerEvent) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    /* a synthetic event has no pointer to capture */
  }
}

/**
 * A knob (client 2026-10-12): pointing straight up = `center` (0 dB, filter off, no effect…);
 * swipe up = more (+, turns right), swipe down = less (−, turns left); a double tap goes back to center.
 * Below center and above center each get half a turn of travel, whatever their size in units
 * (EQ: −26 dB … 0 … +6 dB), so the middle always looks like the middle.
 * With `onMenu`, a long press (held still) opens a menu (the mixer's FX knob: pick the effect).
 */
export function Knob({ label, value, min, max, center = min, onChange, color = '#f5c66b', size = 54, onMenu }: { label: string; value: number; min: number; max: number; center?: number; onChange: (v: number) => void; color?: string; size?: number; onMenu?: () => void }) {
  // position −1 … 0 … +1 (0 = center)
  const toPos = (v: number) => (v >= center ? (max > center ? (v - center) / (max - center) : 0) : center > min ? -(center - v) / (center - min) : 0);
  const toVal = (p: number) => (p >= 0 ? center + p * (max - center) : center + p * (center - min));
  const start = useRef<{ y: number; p: number } | null>(null);
  const last = useRef(0);
  const long = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopLong = () => {
    if (long.current) clearTimeout(long.current);
    long.current = null;
  };
  useEffect(() => stopLong, []);
  const pos = toPos(value);
  const angle = pos * 135;
  const down = (e: RPointerEvent) => {
    capture(e);
    const now = Date.now();
    if (now - last.current < 350) {
      last.current = 0;
      // double tap: back to center (the drag that follows starts from there)
      onChange(center);
      start.current = { y: e.clientY, p: 0 };
      return;
    }
    last.current = now;
    start.current = { y: e.clientY, p: pos };
    // long press (held still): the menu
    if (onMenu)
      long.current = setTimeout(() => {
        long.current = null;
        start.current = null;
        last.current = 0;
        onMenu();
      }, 500);
  };
  const up = () => {
    stopLong();
    start.current = null;
  };
  const move = (e: RPointerEvent) => {
    if (!start.current) return;
    if (long.current && Math.abs(start.current.y - e.clientY) > 6) stopLong();
    // 110 px of swipe = from the middle to one end
    const p = Math.max(-1, Math.min(1, start.current.p + (start.current.y - e.clientY) / 110));
    onChange(toVal(min === center ? Math.max(0, p) : p));
  };
  const r = 42;
  const circ = 2 * Math.PI * r;
  return (
    <div className="flex select-none flex-col items-center gap-0.5" style={{ touchAction: 'none' }}>
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="relative rounded-full border border-white/15 bg-[#1b1830] shadow-inner" style={{ width: size, height: size, touchAction: 'none' }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeDasharray={`${circ * 0.75} ${circ}`} transform="rotate(135 50 50)" />
          {/* the lit arc runs from the top (center) to the pointer */}
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${(circ * Math.abs(angle)) / 360} ${circ}`} transform={`rotate(${-90 + Math.min(0, angle)} 50 50)`} />
          <line x1="50" y1="50" x2="50" y2="16" stroke="white" strokeWidth="6" strokeLinecap="round" transform={`rotate(${angle} 50 50)`} />
          <circle cx="50" cy="5" r="3" fill="rgba(255,255,255,0.5)" />
        </svg>
      </div>
      <span className="text-[9px] tracking-wider text-white/60">{label}</span>
    </div>
  );
}

/** A fader: vertical (channel) or horizontal (crossfader). value 0–1. */
export function Fader({ value, onChange, horizontal = false, length = 140, label, center }: { value: number; onChange: (v: number) => void; horizontal?: boolean; length?: number; label?: string; center?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(0);
  const set = (e: RPointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const v = horizontal ? (e.clientX - r.left) / r.width : 1 - (e.clientY - r.top) / r.height;
    onChange(Math.max(0, Math.min(1, v)));
  };
  const down = (e: RPointerEvent) => {
    capture(e);
    const now = Date.now();
    if (now - last.current < 300 && center !== undefined) {
      onChange(center);
      return;
    }
    last.current = now;
    set(e);
  };
  return (
    <div className="flex select-none flex-col items-center gap-1" style={{ touchAction: 'none' }}>
      <div
        ref={ref}
        onPointerDown={down}
        onPointerMove={(e) => e.buttons && set(e)}
        className="relative rounded-full bg-black/50"
        style={horizontal ? { width: length, height: 34 } : { width: 34, height: length }}
      >
        <div className="absolute rounded-full bg-white/10" style={horizontal ? { left: 12, right: 12, top: 15, height: 4 } : { top: 12, bottom: 12, left: 15, width: 4 }} />
        <div
          className="absolute rounded-md border border-white/40 bg-gradient-to-b from-[#e8e3f5] to-[#9d98b3] shadow"
          style={horizontal ? { width: 22, height: 30, top: 2, left: `calc(${value * 100}% - ${value * 22}px)` } : { width: 30, height: 22, left: 2, top: `calc(${(1 - value) * 100}% - ${(1 - value) * 22}px)` }}
        />
      </div>
      {label && <span className="text-[9px] tracking-wider text-white/60">{label}</span>}
    </div>
  );
}

/**
 * The jog wheel. Turning reports the change in angle (turns); a touch near the middle is "top" (scratch),
 * near the edge is the rim (bend). `angle` turns the platter on screen.
 */
export function Jog({ size, angle, onStart, onTurn, onEnd, children }: { size: number; angle: number; onStart: (top: boolean) => void; onTurn: (turns: number, dt: number) => void; onEnd: () => void; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef<{ a: number; t: number; id: number } | null>(null);
  const angleOf = (e: RPointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  const down = (e: RPointerEvent) => {
    if (st.current) return;
    capture(e);
    const r = ref.current!.getBoundingClientRect();
    const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / (r.width / 2);
    st.current = { a: angleOf(e), t: performance.now(), id: e.pointerId };
    onStart(d < 0.72);
  };
  const move = (e: RPointerEvent) => {
    if (!st.current || e.pointerId !== st.current.id) return;
    const a = angleOf(e);
    let d = a - st.current.a;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    const t = performance.now();
    onTurn(d / (2 * Math.PI), (t - st.current.t) / 1000);
    st.current = { ...st.current, a, t };
  };
  const up = (e: RPointerEvent) => {
    if (!st.current || e.pointerId !== st.current.id) return;
    st.current = null;
    onEnd();
  };
  return (
    <div ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="relative select-none rounded-full border-4 border-[#3a3556] bg-[radial-gradient(circle,#2a2640_0%,#14121f_70%)] shadow-[0_8px_30px_rgba(0,0,0,0.6)]" style={{ width: size, height: size, touchAction: 'none' }}>
      <div className="absolute inset-[14%] rounded-full border border-white/10" style={{ transform: `rotate(${angle}deg)` }}>
        <div className="absolute left-1/2 top-1 h-[18%] w-1.5 -translate-x-1/2 rounded-full bg-amber-300" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/** A pad / button that reports press and release (for CUE, which plays while held). */
export function Pad({ children, onDown, onUp, active, className = '', onLong }: { children: ReactNode; onDown: () => void; onUp?: () => void; active?: boolean; className?: string; onLong?: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressed, setPressed] = useState(false);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <button
      onPointerDown={(e) => {
        capture(e);
        setPressed(true);
        if (onLong) timer.current = setTimeout(() => (onLong(), (timer.current = null)), 600);
        onDown();
      }}
      onPointerUp={() => {
        setPressed(false);
        if (timer.current) clearTimeout(timer.current);
        onUp?.();
      }}
      onPointerCancel={() => (setPressed(false), onUp?.())}
      className={`select-none rounded-lg border text-[11px] font-bold tracking-wider transition-colors ${active ? 'border-amber-300 bg-amber-300/25 text-amber-100' : 'border-white/20 bg-white/5 text-white/80'} ${pressed ? 'brightness-150' : ''} ${className}`}
      style={{ touchAction: 'none' }}
    >
      {children}
    </button>
  );
}
