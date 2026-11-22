'use client';

import { ITEM_MARKS, MARK_GLYPH, type ItemMarkId, type MarkedKind } from '@obolo/shared';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cycleStar, markNames, markOf, setMark, useMarks } from '@/lib/finds/marks';

/** the marks' colours (a mark reads by its shape; the colour only helps) */
export const MARK_COLOR: Record<ItemMarkId, string> = { spade: '#c9d6ff', diamond: '#ffb38a', heart: '#ff8fb0', club: '#9fe0a8' };

/** ★ / ★★ / ★★★ (none: a faint ☆) */
export function Stars({ n, faint = true, className = '' }: { n: number; faint?: boolean; className?: string }) {
  if (!n) return faint ? <span className={`text-white/30 ${className}`}>☆</span> : null;
  return <span className={`tracking-[-0.12em] text-amber-300 drop-shadow-[0_0_4px_rgba(255,200,80,0.6)] ${className}`}>{'★'.repeat(n)}</span>;
}

export function MarkGlyph({ mark, className = '' }: { mark: ItemMarkId | null; className?: string }) {
  if (!mark) return null;
  return (
    <span className={className} style={{ color: MARK_COLOR[mark] }} aria-label={markNames()[mark] || MARK_GLYPH[mark]}>
      {MARK_GLYPH[mark]}
    </span>
  );
}

/** a press held this long opens the ring (M-R236 §4) */
const LONG_MS = 480;

/**
 * A long press (moving the finger cancels it); a click right after a long press is swallowed. Spread `handlers` on the
 * element; `fired()` says whether the last press was a long one.
 */
export function useLongPress(onLong: (at: { x: number; y: number }) => void) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const long = useRef(false);
  const cb = useRef(onLong);
  cb.current = onLong;
  const clear = () => {
    if (t.current) clearTimeout(t.current);
    t.current = null;
  };
  useEffect(() => clear, []);
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      long.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      const at = { x: e.clientX, y: e.clientY };
      t.current = setTimeout(() => {
        long.current = true;
        navigator.vibrate?.(12);
        cb.current(at);
      }, LONG_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (t.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 9) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClickCapture: (e: React.MouseEvent) => {
      if (long.current) {
        e.stopPropagation();
        e.preventDefault();
        long.current = false;
      }
    },
  };
  return handlers;
}

/** the small ★ at a card's / bubble's top right: each tap ★ → ★★ → ★★★ → none; a long press opens the ring */
export function StarButton({ kind, id, className = '', size = 13, onRing }: { kind: MarkedKind; id: string; className?: string; size?: number; onRing?: (at: { x: number; y: number }) => void }) {
  useMarks();
  const m = markOf(kind, id);
  const lp = useLongPress((at) => onRing?.(at));
  return (
    <button
      {...(onRing ? lp : {})}
      onClick={(e) => {
        e.stopPropagation();
        void cycleStar(kind, id);
      }}
      aria-label={m.stars ? `お気に入り ${m.stars}` : 'お気に入りにする'}
      className={`flex select-none items-center gap-0.5 rounded-full bg-black/45 px-1.5 leading-none backdrop-blur ${className}`}
      style={{ fontSize: size, height: size + 9 }}
    >
      <Stars n={m.stars} />
      <MarkGlyph mark={m.mark} />
    </button>
  );
}

/**
 * The small ring a long press opens (M-R236 §4): ♠♦♥♣ around, the ★ in the middle (it turns ★ → ★★ → ★★★ → none here
 * too). One mark per item: a tap on the one it has takes it off.
 */
export function MarkRing({ kind, id, at, onClose }: { kind: MarkedKind; id: string; at: { x: number; y: number }; onClose: () => void }) {
  useMarks();
  const m = markOf(kind, id);
  const names = markNames();
  const R = 50;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
  const cx = Math.max(R + 34, Math.min(vw - R - 34, at.x));
  const cy = Math.max(R + 40, Math.min(vh - R - 40, at.y));
  const pick = (k: ItemMarkId) => void setMark(kind, id, { mark: m.mark === k ? null : k });
  return createPortal(
    <div className="fixed inset-0 z-[90]" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} role="dialog" aria-label="しるし">
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute" style={{ left: cx, top: cy }} onClick={(e) => e.stopPropagation()}>
        <span className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-[#0b0f24]/90 shadow-[0_0_30px_rgba(120,180,255,0.3)] backdrop-blur" style={{ width: R * 2 + 52, height: R * 2 + 52 }} />
        {ITEM_MARKS.map((k, i) => {
          const a = -Math.PI / 2 + (i * Math.PI) / 2;
          const on = m.mark === k;
          return (
            <button
              key={k}
              onClick={() => pick(k)}
              aria-pressed={on}
              aria-label={names[k] || MARK_GLYPH[k]}
              className={`absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full text-[22px] leading-none transition ${on ? 'bg-white/20 ring-2' : 'bg-white/5'}`}
              style={{ left: Math.cos(a) * R, top: Math.sin(a) * R, color: MARK_COLOR[k], ['--tw-ring-color' as string]: MARK_COLOR[k] }}
            >
              {MARK_GLYPH[k]}
              {names[k] && <span className="mt-0.5 max-w-[52px] truncate text-[8.5px] text-white/70">{names[k]}</span>}
            </button>
          );
        })}
        <button onClick={() => void cycleStar(kind, id)} aria-label="お気に入り" className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber-200/10 text-[15px]">
          <Stars n={m.stars} />
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** a ring to open from anywhere: `open(kind, id, at)`; put `node` in the tree */
export function useMarkRing(): { open: (kind: MarkedKind, id: string, at: { x: number; y: number }) => void; node: ReactNode } {
  const [st, setSt] = useState<{ kind: MarkedKind; id: string; at: { x: number; y: number } } | null>(null);
  const open = useCallback((kind: MarkedKind, id: string, at: { x: number; y: number }) => setSt({ kind, id, at }), []);
  return { open, node: st ? <MarkRing kind={st.kind} id={st.id} at={st.at} onClose={() => setSt(null)} /> : null };
}

type Hold = { t?: ReturnType<typeof setTimeout>; x: number; y: number; long: boolean };
const holds = new WeakMap<EventTarget, Hold>();
/** a long press without a hook (for lists drawn in a map): spread on the element */
export function holdProps(onLong: (at: { x: number; y: number }) => void) {
  const stop = (e: React.PointerEvent) => {
    const st = holds.get(e.currentTarget);
    if (st?.t) clearTimeout(st.t);
    if (st) st.t = undefined;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      const prev = holds.get(e.currentTarget);
      if (prev?.t) clearTimeout(prev.t);
      const st: Hold = { x: e.clientX, y: e.clientY, long: false };
      st.t = setTimeout(() => {
        st.t = undefined;
        st.long = true;
        navigator.vibrate?.(12);
        onLong({ x: st.x, y: st.y });
      }, LONG_MS);
      holds.set(e.currentTarget, st);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const st = holds.get(e.currentTarget);
      if (st?.t && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 9) stop(e);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClickCapture: (e: React.MouseEvent) => {
      const st = holds.get(e.currentTarget);
      if (st?.long) {
        st.long = false;
        e.stopPropagation();
        e.preventDefault();
      }
    },
  };
}
