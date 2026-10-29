import type { MouseEvent, PointerEvent } from 'react';

/**
 * The story's taps act on the press, not on the release (story chat 2026-10-29: the sound of a tap came late).
 * The click that follows the same press is swallowed — by the button itself and, through `swallowClick` on the
 * player, by whatever the story puts under the finger next (a reply chip, the next line).
 */
let pressedAt = 0;
const SWALLOW_MS = 500;

export function fastTap(fn: () => void) {
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pressedAt = performance.now();
      fn();
    },
    // the keyboard (and a press the browser turned into a click only)
    onClick: () => {
      if (performance.now() - pressedAt < SWALLOW_MS) return;
      fn();
    },
  };
}

export function swallowClick(e: MouseEvent) {
  if (performance.now() - pressedAt >= SWALLOW_MS) return;
  e.stopPropagation();
  e.preventDefault();
}
