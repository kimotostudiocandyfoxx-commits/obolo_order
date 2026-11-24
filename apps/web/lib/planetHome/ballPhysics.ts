/**
 * M-R265 (design/home/README.md §10): Saturn's balls — a small 2D engine with a soft look. Gravity, the record's floor,
 * its two sides, balls pushing each other apart; and the jiggle: a spring (stiffness 70, damping 4.2) sub-stepped 4
 * times a frame, a dent when pressed and a spring back on release, a slight stretch at speed, a slow breathing swell on
 * the floor, the visible squash eased 45% toward its target each frame. No DOM: the scene writes the numbers out.
 */
export interface Ball {
  id: string;
  R: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** the spring's offset and speed (squash < 0 < stretch) */
  ws: number;
  wv: number;
  /** what is drawn: the eased squash / stretch and tilt */
  sx: number;
  sy: number;
  tilt: number;
  drag: boolean;
  /** a phase of its own (breathing, blinking) */
  seed: number;
}

export interface BallWorld {
  /** the floor (the balls' bottoms rest here), and the two sides */
  floor: number;
  left: number;
  right: number;
  /** prefers-reduced-motion: no breathing, no stretch */
  reduced?: boolean;
}

export const SPRING = { k: 70, c: 4.2, substeps: 4 };
const G = 1900;
/** the visible squash goes this share of the way to its target each frame */
export const EASE = 0.45;

export function newBall(id: string, x: number, y: number, R: number, seed: number): Ball {
  return { id, R, x, y, vx: 0, vy: 0, ws: 0, wv: 0, sx: 1, sy: 1, tilt: 0, drag: false, seed };
}

/** pressed: a little dent */
export const press = (b: Ball) => void (b.wv -= 3.2);
/** let go after a drag: it springs back */
export const release = (b: Ball) => void (b.wv += 4.5);

/** the spring alone, `n` sub-steps over dt */
export function spring(b: Ball, dt: number, n = SPRING.substeps) {
  const h = dt / n;
  for (let k = 0; k < n; k++) {
    b.wv += (-SPRING.k * b.ws - SPRING.c * b.wv) * h;
    b.ws += b.wv * h;
  }
}

export function onFloor(b: Ball, w: BallWorld) {
  return b.y + b.R >= w.floor - 1 && !b.drag;
}

/** one frame: dt in seconds (capped), t the clock in seconds (breathing) */
export function stepBalls(balls: Ball[], dt: number, t: number, w: BallWorld) {
  dt = Math.min(0.033, dt);
  for (const b of balls) {
    if (b.drag) continue;
    b.vy += G * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= 0.995;
    if (b.y + b.R > w.floor) {
      const hit = b.vy;
      b.y = w.floor - b.R;
      b.vy = -b.vy * 0.35;
      b.vx *= 0.86;
      if (hit > 200) b.wv += Math.min(4.2, hit / 420);
      if (Math.abs(b.vy) < 40) b.vy = 0;
    }
    if (b.x - b.R < w.left) {
      b.x = w.left + b.R;
      b.vx = Math.abs(b.vx) * 0.5;
    }
    if (b.x + b.R > w.right) {
      b.x = w.right - b.R;
      b.vx = -Math.abs(b.vx) * 0.5;
    }
  }
  // push apart (a few passes), with a bump that makes both jiggle a little
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < balls.length; i++)
      for (let j = i + 1; j < balls.length; j++) {
        const p = balls[i];
        const q = balls[j];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const m = p.R + q.R - 4;
        if (d >= m) continue;
        const o = (m - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        if (!p.drag) {
          p.x -= nx * o;
          p.y -= ny * o;
        }
        if (!q.drag) {
          q.x += nx * o;
          q.y += ny * o;
        }
        const rv = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
        if (rv < 0) {
          const im = -rv * 0.6;
          if (!p.drag) {
            p.vx -= im * nx * 0.5;
            p.vy -= im * ny * 0.5;
          }
          if (!q.drag) {
            q.vx += im * nx * 0.5;
            q.vy += im * ny * 0.5;
          }
          if (im > 160) {
            p.wv += 0.9;
            q.wv += 0.9;
          }
        }
      }
  for (const b of balls) {
    spring(b, dt);
    const ground = onFloor(b, w);
    const speed = w.reduced ? 0 : Math.min(1, Math.hypot(b.vx, b.vy) / 1400);
    const breathe = ground && !w.reduced ? Math.sin(t * 2.4 + b.seed) * 0.018 : 0;
    const s = Math.max(-0.3, Math.min(0.3, b.ws)) + breathe;
    const tx = 1 + s + (ground ? 0.04 : 0) + speed * 0.06;
    const ty = 1 - s - (ground ? 0.04 : 0) + speed * 0.1;
    b.sx += (tx - b.sx) * EASE;
    b.sy += (ty - b.sy) * EASE;
    const tilt = w.reduced ? 0 : Math.max(-12, Math.min(12, b.vx * 0.012));
    b.tilt += (tilt - b.tilt) * 0.2;
  }
}
