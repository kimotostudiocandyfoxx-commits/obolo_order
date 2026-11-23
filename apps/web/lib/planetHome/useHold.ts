'use client';

import { useRef } from 'react';

/** tap and long-press on one thing (pointer events; a hold cancels the tap; moving away cancels both) */
export function useHold(ms = 480) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (onTap: () => void, onHold: () => void) => ({
    onPointerDown: () => {
      held.current = false;
      clear();
      timer.current = setTimeout(() => {
        held.current = true;
        onHold();
      }, ms);
    },
    onPointerUp: () => {
      clear();
      if (!held.current) onTap();
    },
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  });
}
