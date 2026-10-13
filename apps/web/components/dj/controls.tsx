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
export function Knob({ label, value, min, max, center = min, onChange, color = '#f5c66b', size = 54, onMenu, cap }: { label: string; value: number; min: number; max: number; center?: number; onChange: (v: number) => void; color?: string; size?: number; onMenu?: () => void; cap?: string }) {
  const [capOk, setCapOk] = useState(true);
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
  const r = 46;
  const circ = 2 * Math.PI * r;
  const lit = Math.abs(pos) > 0.01;
  return (
    <div className="flex select-none flex-col items-center gap-0.5" style={{ touchAction: 'none' }}>
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="relative rounded-full" style={{ width: size, height: size, touchAction: 'none' }}>
        {/* the neon track around the knob: lit from the top (center) to where it points */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 overflow-visible">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="5" strokeDasharray={`${circ * 0.75} ${circ}`} transform="rotate(135 50 50)" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(circ * Math.abs(angle)) / 360} ${circ}`} transform={`rotate(${-90 + Math.min(0, angle)} 50 50)`} style={{ filter: lit ? `drop-shadow(0 0 3px ${color})` : undefined }} />
          <circle cx="50" cy="1.5" r="2.2" fill={lit ? color : 'rgba(255,255,255,0.45)'} />
        </svg>
        {/* the cap: a machined knob picture turning with the value, or a drawn one */}
        <div className="absolute overflow-hidden rounded-full" style={{ inset: '13%', transform: `rotate(${angle}deg)`, boxShadow: '0 3px 6px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,0,0,0.6)' }}>
          {cap && capOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cap} alt="" draggable={false} onError={() => setCapOk(false)} className="h-full w-full object-cover" />
          ) : (
            <svg viewBox="0 0 100 100" className="h-full w-full">
              <defs>
                <radialGradient id="kcap" cx="45%" cy="35%" r="70%">
                  <stop offset="0" stopColor="#5b606b" />
                  <stop offset="0.6" stopColor="#23262d" />
                  <stop offset="1" stopColor="#0c0d10" />
                </radialGradient>
              </defs>
              <circle cx="50" cy="50" r="50" fill="url(#kcap)" />
              <line x1="50" y1="50" x2="50" y2="8" stroke="white" strokeWidth="7" strokeLinecap="round" />
            </svg>
          )}
        </div>
      </div>
      <span className="text-[9px] font-bold tracking-[0.14em] text-white/70">{label}</span>
    </div>
  );
}

/** A fader: vertical (channel) or horizontal (crossfader). value 0–1. */
export function Fader({ value, onChange, horizontal = false, length = 140, label, center, color = '#ffffff' }: { value: number; onChange: (v: number) => void; horizontal?: boolean; length?: number; label?: string; center?: number; color?: string }) {
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
        data-part
        onPointerDown={down}
        onPointerMove={(e) => e.buttons && set(e)}
        className="relative rounded-full"
        style={{ ...(horizontal ? { width: length, height: 34 } : { width: 34, height: length }), background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(20,22,28,0.55))', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.06)' }}
      >
        {/* the slot, with tick marks */}
        <div className="absolute rounded-full bg-black" style={{ ...(horizontal ? { left: 12, right: 12, top: 15, height: 4 } : { top: 12, bottom: 12, left: 15, width: 4 }), boxShadow: `0 0 4px ${color}55` }} />
        {Array.from({ length: 9 }, (_, n) => (
          <div key={n} className="absolute bg-white/20" style={horizontal ? { left: `calc(12px + ${n / 8} * (100% - 24px))`, top: 6, width: 1, height: n % 4 ? 3 : 5 } : { top: `calc(12px + ${n / 8} * (100% - 24px))`, left: 6, height: 1, width: n % 4 ? 3 : 5 }} />
        ))}
        {/* the cap: brushed metal with a neon line across it */}
        <div
          className="absolute rounded-[5px]"
          style={{
            ...(horizontal ? { width: 22, height: 30, top: 2, left: `calc(${value * 100}% - ${value * 22}px)` } : { width: 30, height: 22, left: 2, top: `calc(${(1 - value) * 100}% - ${(1 - value) * 22}px)` }),
            background: 'linear-gradient(180deg, #f2f4f8 0%, #9ea4b0 45%, #5d636e 55%, #c3c8d1 100%)',
            boxShadow: '0 3px 6px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.9)',
          }}
        >
          <div className="absolute" style={{ ...(horizontal ? { left: 10, top: 3, bottom: 3, width: 2 } : { top: 10, left: 3, right: 3, height: 2 }), background: color, boxShadow: `0 0 4px ${color}, 0 0 8px ${color}` }} />
        </div>
      </div>
      {label && <span className="text-[9px] tracking-wider text-white/60">{label}</span>}
    </div>
  );
}

/**
 * The jog wheel. Turning reports the change in angle (turns); a touch near the middle is "top" (scratch),
 * near the edge is the rim (bend). `angle` turns the platter on screen.
 */
export function Jog({ size, angle, onStart, onTurn, onEnd, children, skin, color = '#ffc24a', led = 0.86 }: { size: number; angle: number; onStart: (top: boolean) => void; onTurn: (turns: number, dt: number) => void; onEnd: () => void; children?: ReactNode; skin?: string; color?: string; led?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [skinOk, setSkinOk] = useState(true);
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
    <div ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="relative select-none rounded-full" style={{ width: size, height: size, touchAction: 'none', boxShadow: `0 10px 30px rgba(0,0,0,0.85), 0 0 ${size * 0.06}px ${color}33` }}>
      {skin && skinOk ? (
        // the jog wheel picture (CDJ-style metal, painted): it stays still like the real one
        // eslint-disable-next-line @next/next/no-img-element
        <img src={skin} alt="" draggable={false} onError={() => setSkinOk(false)} className="pointer-events-none absolute inset-0 h-full w-full rounded-full object-cover" />
      ) : (
        <div className="absolute inset-0 rounded-full border-4 border-[#3a3556] bg-[radial-gradient(circle,#2a2640_0%,#14121f_70%)]" />
      )}
      {/* the position light running round the ring, as on a CDJ */}
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
        <circle cx="50" cy={50 - led * 50} r="2.2" fill="#fff" style={{ filter: `drop-shadow(0 0 2px ${color}) drop-shadow(0 0 4px ${color})` }} />
        <path d={`M ${50 - 9} ${50 - led * 50 + 0.6} A ${led * 50} ${led * 50} 0 0 1 50 ${50 - led * 50}`} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.8" style={{ filter: `drop-shadow(0 0 2px ${color})` }} />
      </svg>
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
