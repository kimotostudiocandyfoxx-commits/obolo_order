/**
 * M-R265 (design/home/README.md §10): Saturn's balls — a small 2D engine with a soft look. Gravity, the record's floor,
 * its two sides, balls pushing each other apart; and the jiggle: a spring (stiffness 70, damping 4.2) sub-stepped 4
 * times a frame, a dent when pressed and a spring back on release, a slight stretch at speed, a slow breathing swell on
 * the floor, the visible squash eased 45% toward its target each frame. No DOM: the scene writes the numbers out.
 * M-R268: the calmer speed again (gravity 1150, at most 780 px/s), a floor that follows the record's front rim (an arc;
 * a ball bounces off it along its normal), and while the record spins every ball hops and sways to the beat and drifts
 * left along the rim.
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
  /** its number (who hops on which beat) */
  n: number;
}

export interface BallWorld {
  /** the floor (the balls' bottoms rest here) — flat, or (M-R268) the arc of the record's rim at x — and the sides */
  floor: number;
  floorAt?: (x: number) => number;
  /** M-R268: the record spins (drift left along the rim, sway); `beat` counts the music's beats (a hop on each) */
  spin?: boolean;
  beat?: number;
  bpm?: number;
  left: number;
  right: number;
  /** prefers-reduced-motion: no breathing, no stretch */
  reduced?: boolean;
}

export const SPRING = { k: 70, c: 4.2, substeps: 4 };
export const G = 1150;
/** M-R268: no ball moves faster than this */
export const VMAX = 780;
/** M-R268: a throw carries this share of the hand's speed */
export const THROW = 0.6;
/** the visible squash goes this share of the way to its target each frame */
export const EASE = 0.45;

export function newBall(id: string, x: number, y: number, R: number, seed: number, n = 0): Ball {
  return {
    id,
    R,
    x,
    y,
    vx: 0,
    vy: 0,
    ws: 0,
    wv: 0,
    sx: 1,
    sy: 1,
    tilt: 0,
    drag: false,
    seed,
    n,
  };
}

export const floorOf = (w: BallWorld, x: number) => (w.floorAt ? w.floorAt(x) : w.floor);

/**
 * M-R268: the record's front rim as a floor — the ellipse (centre cx, cy; radii rx, ry, in px) seen from the front:
 * its lower arc at ry × 0.8, over rx × 0.97 of its width.
 */
export function rimFloor(e: { cx: number; cy: number; rx: number; ry: number }) {
  return (x: number) => {
    const u = Math.min(0.985, Math.abs((x - e.cx) / (e.rx * 0.97)));
    return e.cy + e.ry * 0.8 * Math.sqrt(1 - u * u);
  };
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
  return b.y + b.R >= floorOf(w, b.x) - 1 && !b.drag;
}

/** M-R268: a new beat — the balls on the floor hop (every other one, by turns), nudged a little sideways */
export function hop(balls: Ball[], beat: number, w: BallWorld) {
  for (const b of balls) {
    if (b.drag || b.y + b.R < floorOf(w, b.x) - 3 || (beat + b.n) % 2) continue;
    b.vy = -(170 + ((b.n * 37 + beat * 11) % 9) * 22);
    b.vx += (((b.n + beat) % 3) - 1) * 45;
    b.wv += 1.6;
  }
}

/** one frame: dt in seconds (capped), t the clock in seconds (breathing) */
export function stepBalls(balls: Ball[], dt: number, t: number, w: BallWorld) {
  dt = Math.min(0.033, dt);
  for (const b of balls) {
    if (b.drag) continue;
    b.vy += G * dt;
    const vm = Math.hypot(b.vx, b.vy);
    if (vm > VMAX) {
      b.vx *= VMAX / vm;
      b.vy *= VMAX / vm;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= 0.995;
    const g = floorOf(w, b.x);
    if (b.y + b.R > g) {
      b.y = g - b.R;
      // the floor's normal here (y grows downward), and its tangent
      const fp = (floorOf(w, b.x + 1) - floorOf(w, b.x - 1)) / 2;
      const nl = Math.hypot(fp, 1);
      const nx = -fp / nl;
      const ny = 1 / nl;
      const vn = b.vx * nx + b.vy * ny;
      if (vn > 0) {
        b.vx -= 1.35 * vn * nx;
        b.vy -= 1.35 * vn * ny;
        if (vn > 200) b.wv += Math.min(4.2, vn / 420);
      }
      const tx = ny;
      const ty = -nx;
      let vt = (b.vx * tx + b.vy * ty) * 0.985;
      // spinning: carried left along the front rim
      if (w.spin) vt += (-60 - vt) * 0.05;
      const vn2 = Math.min(0, b.vx * nx + b.vy * ny);
      b.vx = tx * vt + nx * vn2;
      b.vy = ty * vt + ny * vn2;
      if (Math.abs(vn) < 30 && !w.spin && Math.abs(vt) < 6) b.vx *= 0.9;
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
    // M-R268: swaying to the beat while it spins
    const sway = w.spin && w.beat !== undefined ? Math.sin((t * Math.PI * (w.bpm ?? 124)) / 60 + b.n) * 9 : 0;
    const tilt = w.reduced ? 0 : Math.max(-12, Math.min(12, b.vx * 0.012)) + sway;
    b.tilt += (tilt - b.tilt) * 0.2;
  }
}
