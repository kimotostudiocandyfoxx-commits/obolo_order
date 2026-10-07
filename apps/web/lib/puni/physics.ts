/**
 * ぷにぷに soft bodies (prototype, client request 2026-10-07): every character is a "blob" —
 * a rigid centre (position, velocity, rolling angle) plus a ring of N edge points that can be
 * pushed in and spring back. Contacts with the floor, the walls and other blobs flatten the edge
 * (squash), the pushed-out volume bulges elsewhere, a poke dents it and makes it jiggle, and a
 * fast blob stretches along its motion. Pure maths, no DOM — the stage renders it.
 */

export type BodyShape = 'round' | 'tall' | 'chunky';

export const N = 28;
const G = 2000; // gravity, px/s²
const K = 420; // edge spring back to rest
const C = 11; // edge damping
const KL = 950; // neighbour coupling (smooth dents)
const SOFT = 0.86; // the centre may sink to this share of its radius into the floor (rest is squish)

const ellipse = (a: number, b: number, t: number) => (a * b) / Math.sqrt((b * Math.cos(t)) ** 2 + (a * Math.sin(t)) ** 2);

/** Rest radius (1 = R) at local angle t (0 = right, π/2 = down: SVG y grows downwards). */
export function restRadius(shape: BodyShape, t: number): number {
  switch (shape) {
    case 'tall': // onigiri-kun: taller, slightly narrower at the top
      return ellipse(0.86, 1.12, t) * (1 + 0.05 * Math.sin(t));
    case 'chunky': // gorilla / hippo: wide, heavy bottom
      return ellipse(1.1, 0.95, t) * (1 + 0.09 * Math.sin(t));
    default:
      return 1;
  }
}

export interface Blob {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  av: number;
  R: number;
  shape: BodyShape;
  /** radial offset of each edge point from its rest radius (px) and its velocity */
  o: Float64Array;
  ov: Float64Array;
  grounded: boolean;
  drag: { tx: number; ty: number } | null;
  /** seconds left of the "poked" face */
  poked: number;
  /** smoothed squash of the body (for the parts) */
  sx: number;
  sy: number;
  cy: number;
}

export interface World {
  W: number;
  H: number;
  floor: number;
  /** a curved ground (Saturn's horizon): the floor's y at x; `floor` is used when absent */
  floorAt?: (x: number) => number;
}

export function createBlob(id: string, x: number, y: number, R: number, shape: BodyShape): Blob {
  return { id, x, y, vx: 0, vy: 0, angle: 0, av: 0, R, shape, o: new Float64Array(N), ov: new Float64Array(N), grounded: false, drag: null, poked: 0, sx: 1, sy: 1, cy: 0 };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const theta = (i: number) => (i / N) * Math.PI * 2;

/** Distance from the centre to the body's edge straight down (for the floor). */
function downReach(b: Blob) {
  return b.R * restRadius(b.shape, Math.PI / 2 - b.angle);
}

export function step(blobs: Blob[], dt: number, w: World) {
  const fl = (x: number) => (w.floorAt ? w.floorAt(x) : w.floor);
  for (const b of blobs) {
    let ax = 0;
    let ay = G;
    if (b.drag) {
      ax = (b.drag.tx - b.x) * 140 - b.vx * 16;
      ay = (b.drag.ty - b.y) * 140 - b.vy * 16;
    }
    b.vx += ax * dt;
    b.vy += ay * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.angle += b.av * dt;
    b.poked = Math.max(0, b.poked - dt);

    // floor: bounce a little, roll without slipping, stand back up when slow
    const reach = downReach(b) * SOFT;
    b.grounded = false;
    const ground = fl(b.x);
    if (b.y + reach >= ground) {
      b.y = ground - reach;
      if (b.vy > 0) b.vy = b.vy > 120 ? -b.vy * 0.32 : 0;
      b.grounded = true;
      b.vx *= Math.max(0, 1 - 2.6 * dt);
      const roll = b.vx / Math.max(1, downReach(b));
      const upright = -wrap(b.angle) * 6;
      const k = Math.min(1, Math.abs(b.vx) / 160);
      b.av = roll * k + upright * (1 - k);
    } else if (!b.drag) {
      b.av *= Math.max(0, 1 - 0.6 * dt);
    } else {
      b.av += (-wrap(b.angle) * 8 - b.av) * Math.min(1, 6 * dt);
    }
    // walls / ceiling
    const side = b.R * 0.92;
    if (b.x < side) {
      b.x = side;
      if (b.vx < 0) b.vx = -b.vx * 0.5;
    } else if (b.x > w.W - side) {
      b.x = w.W - side;
      if (b.vx > 0) b.vx = -b.vx * 0.5;
    }
    if (b.y < b.R) {
      b.y = b.R;
      if (b.vy < 0) b.vy = 0;
    }
  }

  // blob vs blob (circles at 90% of R; the edges show the squash)
  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      const a = blobs[i];
      const c = blobs[j];
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const min = (a.R + c.R) * 0.86;
      if (d >= min) continue;
      const nx = dx / d;
      const ny = dy / d;
      const push = (min - d) / 2;
      const am = a.drag ? 0 : 1;
      const cm = c.drag ? 0 : 1;
      const tot = am + cm || 1;
      a.x -= nx * push * 2 * (am / tot);
      a.y -= ny * push * 2 * (am / tot);
      c.x += nx * push * 2 * (cm / tot);
      c.y += ny * push * 2 * (cm / tot);
      const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (rel < 0) {
        const imp = -rel * 0.7;
        a.vx -= nx * imp * (am / tot) * 2;
        a.vy -= ny * imp * (am / tot) * 2;
        c.vx += nx * imp * (cm / tot) * 2;
        c.vy += ny * imp * (cm / tot) * 2;
      }
    }
  }

  // the edge: springs, then contacts flatten it, then the volume bulges back out elsewhere
  for (const b of blobs) {
    const clamped = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const lap = b.o[(i + N - 1) % N] + b.o[(i + 1) % N] - 2 * b.o[i];
      b.ov[i] += (-K * b.o[i] - C * b.ov[i] + KL * lap) * dt;
      b.o[i] += b.ov[i] * dt;
    }
    // only the neighbours can touch this edge (a crowd of 50 stays cheap)
    const near = blobs.filter((c) => c !== b && Math.abs(c.x - b.x) < (b.R + c.R) * 1.4 && Math.abs(c.y - b.y) < (b.R + c.R) * 1.4);
    for (let i = 0; i < N; i++) {
      const t = theta(i);
      const dir = t + b.angle;
      const dx = Math.cos(dir);
      const dy = Math.sin(dir);
      const rest = restRadius(b.shape, t) * b.R;
      let r = rest + b.o[i];
      if (dy > 0.05) {
        const g = fl(b.x + r * dx);
        if (b.y + r * dy > g) r = (g - b.y) / dy;
      }
      if (dx < -0.05 && b.x + r * dx < 0) r = -b.x / dx;
      if (dx > 0.05 && b.x + r * dx > w.W) r = (w.W - b.x) / dx;
      for (const c of near) {
        const px = b.x + r * dx - c.x;
        const py = b.y + r * dy - c.y;
        const rc = c.R * 0.93;
        const dist = Math.hypot(px, py);
        if (dist < rc) r -= (rc - dist) * 0.55;
      }
      r = Math.max(rest * 0.45, r);
      if (r < rest + b.o[i] - 0.01) {
        b.o[i] = r - rest;
        if (b.ov[i] > 0) b.ov[i] = 0;
        clamped[i] = 1;
      }
    }
    // keep the volume: what is pushed in bulges out at the free points
    let sum = 0;
    let free = 0;
    for (let i = 0; i < N; i++) {
      sum += b.o[i];
      if (!clamped[i]) free++;
    }
    if (free && sum < 0) {
      const add = (-sum / free) * 0.55;
      for (let i = 0; i < N; i++) if (!clamped[i]) b.o[i] += add * Math.min(1, dt * 30);
    }
    // never balloon: a squeezed body bulges at most a third of its radius (a crowd pushes from
    // every side, which would otherwise keep inflating the few free points)
    for (let i = 0; i < N; i++) {
      const cap = restRadius(b.shape, theta(i)) * b.R * 0.32;
      if (b.o[i] > cap) {
        b.o[i] = cap;
        if (b.ov[i] > 0) b.ov[i] = 0;
      }
    }

    // squash of the whole body for the parts (face, hat …), smoothed
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let rminX = Infinity;
    let rmaxX = -Infinity;
    let rminY = Infinity;
    let rmaxY = -Infinity;
    for (let i = 0; i < N; i++) {
      const t = theta(i);
      const rest = restRadius(b.shape, t) * b.R;
      const r = rest + b.o[i];
      const cx = Math.cos(t);
      const sy = Math.sin(t);
      minX = Math.min(minX, r * cx);
      maxX = Math.max(maxX, r * cx);
      minY = Math.min(minY, r * sy);
      maxY = Math.max(maxY, r * sy);
      rminX = Math.min(rminX, rest * cx);
      rmaxX = Math.max(rmaxX, rest * cx);
      rminY = Math.min(rminY, rest * sy);
      rmaxY = Math.max(rmaxY, rest * sy);
    }
    const k = Math.min(1, dt * 25);
    b.sx += ((maxX - minX) / (rmaxX - rminX) - b.sx) * k;
    b.sy += ((maxY - minY) / (rmaxY - rminY) - b.sy) * k;
    b.cy += ((maxY + minY) / 2 - (rmaxY + rminY) / 2 - b.cy) * k;
  }
}

/** Poke at a world point: the edge there dents in, the whole body jiggles, a little hop. */
export function poke(b: Blob, wx: number, wy: number, strength = 1) {
  const phi = Math.atan2(wy - b.y, wx - b.x) - b.angle;
  for (let i = 0; i < N; i++) {
    const d = wrap(theta(i) - phi);
    const f = Math.exp(-((d / 0.5) ** 2));
    b.ov[i] -= 1100 * f * strength;
    b.ov[i] += (Math.random() - 0.5) * 120 * strength;
  }
  if (b.grounded) b.vy -= 380 * strength;
  b.av += (Math.random() - 0.5) * 3 * strength;
  b.poked = 0.45;
}

/** Edge points in the blob's local frame (before its rolling rotation), px. */
export function localPoints(b: Blob): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const t = theta(i);
    const r = restRadius(b.shape, t) * b.R + b.o[i];
    pts.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  return pts;
}

/** A smooth closed path through the points (Catmull-Rom → cubic Bézier). */
export function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return `${d}Z`;
}

/** Stretch along the motion when flying / dragged: an SVG matrix (a b c d). */
export function stretchMatrix(b: Blob): [number, number, number, number] {
  const v = Math.hypot(b.vx, b.vy);
  if (b.grounded && !b.drag) return [1, 0, 0, 1];
  const s = 1 + Math.min(0.24, v / 5200);
  const phi = Math.atan2(b.vy, b.vx);
  const c = Math.cos(phi);
  const sn = Math.sin(phi);
  const a = c * c * s + (sn * sn) / s;
  const bb = c * sn * (s - 1 / s);
  const d = sn * sn * s + (c * c) / s;
  return [a, bb, bb, d];
}
