import { HOME_PLANETS, type HomePlanet } from '@obolo/shared';

/**
 * 惑星ホームの共通の型 3-1〜3-4 (handoff docs/handoff/planets-01-foundation.md 3章; prototype design/home/template.html):
 * the pure numbers and rules the template's components run on (tested in layout.test.ts).
 */

// --- 3-1 the rows ---------------------------------------------------------------------------------------------------

/** at most this many ダチ・推し float at once; more wait in the queue */
export const HOME_MAX = 8;

/** one slot: x / y (fractions of the screen), size, sway x / y (fractions), row (0 back, 1 middle, 2 front) */
export type Slot = readonly [x: number, y: number, size: number, swayX: number, swayY: number, row: 0 | 1 | 2];

/** the prototype's JSLOT (Jupiter, the common template): back 2, middle 4, front 2 — smaller toward the back */
export const JSLOT: readonly Slot[] = [
  [0.22, 0.47, 0.52, 0.05, 0.015, 0],
  [0.5, 0.44, 0.5, 0.05, 0.015, 0],
  [0.13, 0.6, 0.82, 0.05, 0.022, 1],
  [0.38, 0.63, 0.82, 0.05, 0.022, 1],
  [0.6, 0.58, 0.82, 0.045, 0.022, 1],
  [0.84, 0.66, 0.82, 0.04, 0.022, 1],
  [0.27, 0.81, 1.22, 0.06, 0.02, 2],
  [0.72, 0.83, 1.22, 0.06, 0.02, 2],
];
export const slotOf = (i: number): Slot => JSLOT[((i % JSLOT.length) + JSLOT.length) % JSLOT.length];

/** a figure's box at size 1 (px; the prototype's .g5f) */
export const FIGURE_PX = 104;

/** dropped: the height (fraction) → the size (piecewise linear: high = small and far, low = big and near) */
export const DROP_SCALE: readonly (readonly [number, number])[] = [
  [0.44, 0.5],
  [0.62, 0.82],
  [0.83, 1.22],
];
/** the row borders by height: above 0.53 the back row, above 0.74 the middle, below that the front */
export const ROW_CUTS = [0.53, 0.74] as const;
/** where a figure may be dropped at all (x from–to, y from–to) */
export const DROP_BOX = { x0: 0.06, x1: 0.94, y0: 0.36, y1: 0.9 } as const;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** the prototype's lerpPts */
export function lerpPts(v: number, P: readonly (readonly [number, number])[]): number {
  if (v <= P[0][0]) return P[0][1];
  for (let k = 1; k < P.length; k++)
    if (v <= P[k][0]) {
      const a = P[k - 1];
      const b = P[k];
      return a[1] + ((b[1] - a[1]) * (v - a[0])) / (b[0] - a[0]);
    }
  return P[P.length - 1][1];
}

export const rowAt = (y: number): 0 | 1 | 2 => (y < ROW_CUTS[0] ? 0 : y < ROW_CUTS[1] ? 1 : 2);
export const sizeAt = (y: number) => lerpPts(y, DROP_SCALE);

/**
 * 3-2 per planet: where a figure may stay (Mercury's ships stay on the sea). Gets the drop point (fractions, already in
 * DROP_BOX) and answers the point to use — the same point when allowed, or the nearest allowed one.
 */
export type AllowedArea = (x: number, y: number) => { x: number; y: number };
export const anywhere: AllowedArea = (x, y) => ({ x, y });

/** a dropped figure: where it now drifts around, how big it is, which row it is in */
export function dropAt(x: number, y: number, allowed: AllowedArea = anywhere): { x: number; y: number; size: number; row: 0 | 1 | 2 } {
  const p = allowed(clamp(x, DROP_BOX.x0, DROP_BOX.x1), clamp(y, DROP_BOX.y0, DROP_BOX.y1));
  const fx = clamp(p.x, DROP_BOX.x0, DROP_BOX.x1);
  const fy = clamp(p.y, DROP_BOX.y0, DROP_BOX.y1);
  return { x: fx, y: fy, size: sizeAt(fy), row: rowAt(fy) };
}

/** the gentle drift around a figure's centre (the prototype's step(): two slow sines and a small bob, px) */
export function swayAt(t: number, i: number, sx: number, sy: number, W: number, H: number): { dx: number; dy: number } {
  const w1 = 0.4 + ((i * 17) % 7) * 0.05;
  const w2 = 0.6 + ((i * 11) % 5) * 0.07;
  return { dx: Math.sin(t * w1 + i * 1.7) * sx * W, dy: Math.sin(t * w2 + i * 2.3) * sy * H + Math.sin(t * 2 + i) * 3 };
}

// --- 3-2 touch --------------------------------------------------------------------------------------------------

/** a press becomes a drag once it has moved this far (px); less is a tap */
export const DRAG_START_PX = 9;
export const isDrag = (dx: number, dy: number) => Math.hypot(dx, dy) > DRAG_START_PX;

/**
 * one press on a figure: 'tap' (released before 9 px), 'drag' (moved 9 px or more, one finger), 'cancel' (a second finger
 * came down: the pinch wins, the figure is let go where it was)
 */
export type PressEnd = 'tap' | 'drag' | 'cancel';
export function pressEnd(moved: number, fingers: number, released: boolean): PressEnd | null {
  if (fingers >= 2) return 'cancel';
  if (!released) return null;
  return moved > DRAG_START_PX ? 'drag' : 'tap';
}

// --- 3-1 the queue ---------------------------------------------------------------------------------------------

export interface Seat<P> {
  person: P;
  /** the slot it came into (its row and size until it is dragged) */
  slot: number;
  /** a running number: a figure that comes in later is a new one (its own drift) */
  n: number;
}
export interface Crowd<P> {
  seats: Seat<P>[];
  queue: P[];
  next: number;
}

/** the first eight take the slots in order; the rest wait */
export function seat<P>(people: readonly P[], max = HOME_MAX): Crowd<P> {
  const seats = people.slice(0, max).map((person, i) => ({ person, slot: i, n: i }));
  return { seats, queue: people.slice(max), next: seats.length };
}

/** one was opened / popped: it leaves, and the first in the queue comes into its slot (nobody waiting: the slot stays empty) */
export function replace<P>(c: Crowd<P>, gone: (p: P) => boolean): Crowd<P> {
  const at = c.seats.findIndex((s) => gone(s.person));
  if (at < 0) return c;
  const seats = [...c.seats];
  const [left] = seats.splice(at, 1);
  if (!c.queue.length) return { ...c, seats };
  const [first, ...queue] = c.queue;
  seats.splice(at, 0, { person: first, slot: left.slot, n: c.next });
  return { seats, queue, next: c.next + 1 };
}

// --- 3-4 the planet switch --------------------------------------------------------------------------------------

/** the planets in the switch's order */
export const SWITCH_ORDER: readonly HomePlanet[] = HOME_PLANETS;
/** the strip moves faster than the finger (the prototype: 1.6×) */
export const SWITCH_GAIN = 1.6;
/** a slide shorter than this (px) is a touch, not a switch */
export const SWITCH_MIN_PX = 6;

/**
 * where the finger is released: touching the icon opens the strip centred on this planet; sliding the finger moves the
 * strip (finger right → the strip right → the planets before); the planet in the middle at release is the one
 */
export function planetAtSlide(from: HomePlanet, dx: number, itemPx: number, order: readonly HomePlanet[] = SWITCH_ORDER): HomePlanet {
  const i0 = Math.max(0, order.indexOf(from));
  if (Math.abs(dx) < SWITCH_MIN_PX || itemPx <= 0) return order[i0];
  const i = Math.round(i0 - (dx * SWITCH_GAIN) / itemPx);
  return order[clamp(i, 0, order.length - 1)];
}

// --- 3-3 the play view ------------------------------------------------------------------------------------------

/** how long a work stays in front of you in the play view (ms), by what opens (a film plays longer) */
export const PLAY_HOLD_MS = { default: 5200, long: 9000 } as const;
/** from ▶ to the first work arriving (ms); Saturn's first kororin pops and talks at about 2.3 s (M-R304) */
export const PLAY_INTRO_MS = 1700;
