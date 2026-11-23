'use client';

import { useRef } from 'react';

export type At = { x: number; y: number };

/** tap and long-press (0.48 s, design/home §3) on one thing; a hold cancels the tap, moving away cancels both */
export function useHold(ms = 480) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (onTap: () => void, onHold: (at: At) => void) => ({
    onPointerDown: (e: { clientX: number; clientY: number }) => {
      held.current = false;
      clear();
      const at = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        held.current = true;
        timer.current = null;
        onHold(at);
      }, ms);
    },
    onPointerUp: () => {
      const pending = !!timer.current;
      clear();
      if (pending && !held.current) onTap();
    },
    onPointerLeave: clear,
    onPointerCancel: clear,
    onKeyDown: (e: { key: string; preventDefault: () => void }) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTap();
      }
    },
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  });
}
