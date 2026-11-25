import { anywhere, clamp, dropAt, HOME_MAX, JSLOT, lerpPts, swayAt, type AllowedArea } from './layout';

/**
 * How a planet's figures move — the template's per-planet layout (handoff 01 3-1 / 3-2). Every planet but Mercury: the
 * figures drift around their JSLOT places (`drift`). Mercury (handoff 02 §1): the ships sail the sea lanes of MSLOT
 * (`sail`, lib/planetTemplate/mercury.ts). The home keeps one Body per figure and only asks the motion to place, move and
 * drop it, so a planet changes its layout without forking the home.
 */
export interface Body {
  /** where it is now (px) */
  x: number;
  y: number;
  size: number;
  row: 0 | 1 | 2;
  /** its own clock (s) and running number (its own sway / speed) */
  t: number;
  i: number;
  drag: boolean;
  /** drift: the centre it drifts around (fractions) and how far (fractions) */
  cx: number;
  cy: number;
  sx: number;
  sy: number;
  /** sail: its lane (height, fraction) and speed (px/s; < 0 sails left) */
  lane: number;
  v: number;
  /** the tilt on the waves (deg) and whether the picture faces left */
  rot: number;
  flip: boolean;
}

export interface FigureMotion {
  kind: 'drift' | 'sail';
  /** how many float at once (the rest wait) */
  max: number;
  /** a slot's row and size (before any drag) */
  slotRow(slot: number): 0 | 1 | 2;
  slotSize(slot: number): number;
  /** a figure coming into `slot` (n: its running number) on a W×H screen */
  spawn(slot: number, n: number, W: number, H: number): Body;
  /** one frame: dt seconds; `pace` slows it (a work open: the others keep going, slower) */
  step(b: Body, dt: number, W: number, H: number, pace?: number): void;
  /** let go after a drag at b.x / b.y: where it now stays, its size and row (`allowed`: the planet's area) */
  drop(b: Body, W: number, H: number, allowed?: AllowedArea): void;
}

const body = (o: Partial<Body>): Body => ({ x: 0, y: 0, size: 1, row: 1, t: 0, i: 0, drag: false, cx: 0, cy: 0, sx: 0, sy: 0, lane: 0, v: 0, rot: 0, flip: false, ...o });

const slotJ = (i: number) => JSLOT[((i % JSLOT.length) + JSLOT.length) % JSLOT.length];

/** the common template: JSLOT, drifting around each place (the prototype's G5 / Jupiter step()) */
export const driftMotion: FigureMotion = {
  kind: 'drift',
  max: HOME_MAX,
  slotRow: (slot) => slotJ(slot)[5],
  slotSize: (slot) => slotJ(slot)[2],
  spawn(slot, n, W, H) {
    const S = slotJ(slot);
    // they fly in from either side
    return body({ cx: S[0], cy: S[1], size: S[2], row: S[5], sx: S[3], sy: S[4], x: W * (n % 2 ? 1.1 : -0.1), y: H * 0.6, i: n });
  },
  step(b, dt, W, H) {
    b.t += dt;
    const sw = swayAt(b.t, b.i, b.sx, b.sy, W, H);
    b.x += (b.cx * W + sw.dx - b.x) * Math.min(1, dt * 3);
    b.y += (b.cy * H + sw.dy - b.y) * Math.min(1, dt * 3);
  },
  drop(b, W, H, allowed = anywhere) {
    const r = dropAt(b.x / W, b.y / H, allowed);
    const sw = swayAt(b.t, b.i, b.sx, b.sy, W, H);
    b.cx = r.x - sw.dx / W;
    b.cy = r.y - sw.dy / H;
    b.size = r.size;
    b.row = r.row;
    b.x = r.x * W;
    b.y = r.y * H;
  },
};

export { body as makeBody, clamp, lerpPts };
