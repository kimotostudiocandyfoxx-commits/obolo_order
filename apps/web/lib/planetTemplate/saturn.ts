import type { HomeWork } from '@obolo/shared';
import { clamp, HOME_MAX } from './layout';
import { makeBody, type Body, type FigureMotion, type FloorState } from './motion';

/**
 * 04 土星 (handoff docs/handoff/planets-04-saturn.md; prototype design/home/template.html `startSim3D`, `play`,
 * `pileStart`): the exception to the common template's floating rows. The kororins stand on the record floor — the
 * record seen at a slant, an ellipse — and hop about on it with depth: far (up the screen) small, near big, the far ones
 * behind the near ones, a shadow under each, pushing each other apart. The pure numbers live here (saturn.test.ts).
 */

// --- §1 the record floor ------------------------------------------------------------------------------------------

/** the record on the home picture (fractions of the 9:16 picture; the prototype's REC) */
export const REC = { cx: 0.481, cy: 0.702, rx: 0.574, ry: 0.1885 } as const;
/** the floor's ellipse on a W×H screen (px). The picture covers the screen, centred (the template's .stage) */
export interface Floor {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  W: number;
  H: number;
}
/** a record floor on a 9:16 picture (fractions): the home's REC, or a plaza's landed scene (06) */
export type FloorRec = { cx: number; cy: number; rx: number; ry: number };
export function floorOf(W: number, H: number, rec: FloorRec = REC): Floor {
  const k = Math.max(W / 9, H / 16);
  const bw = 9 * k;
  const bh = 16 * k;
  const x0 = (W - bw) / 2;
  const y0 = (H - bh) / 2;
  return { cx: x0 + rec.cx * bw, cy: y0 + rec.cy * bh, rx: rec.rx * bw, ry: rec.ry * bh, W, H };
}

/** the size by depth: the back of the record (gz −1) 0.58×, the front (gz +1) 1.18× */
export const SCALE_FAR = 0.58;
export const SCALE_NEAR = 1.18;
export const depthScale = (gz: number) => SCALE_FAR + ((SCALE_NEAR - SCALE_FAR) * (clamp(gz, -1, 1) + 1)) / 2;
/** the floor is foreshortened a little more than the picture's ellipse (the prototype's 0.86) */
export const FLOOR_SQUEEZE = 0.86;

/** floor (gx, gz) and height h → the screen: x = cx + gx·rx, y = cy + gz·ry·0.86 − h·size */
export function toScreen(f: Floor, gx: number, gz: number, h: number): { x: number; y: number; s: number } {
  const s = depthScale(gz);
  return { x: f.cx + gx * f.rx, y: f.cy + gz * f.ry * FLOOR_SQUEEZE - h * s, s };
}
/** a screen point → the floor under it (kept on the record) */
export function toGround(f: Floor, x: number, y: number): { gx: number; gz: number } {
  return { gx: clamp((x - f.cx) / f.rx, -0.95, 0.95), gz: clamp((y - f.cy) / (f.ry * FLOOR_SQUEEZE), -0.92, 0.92) };
}

/** gravity (px/s²), the hop's upward speed (330…530 px/s), its speed along the floor (0.28…0.49 /s) */
export const GRAVITY = 1150;
export const HOP_UP = [330, 530] as const;
export const HOP_ALONG = [0.28, 0.49] as const;
/** a hop every 1…2.5 s (the prototype: 1 + 0…6 × 0.22 s) */
export const HOP_EVERY = [1, 2.32] as const;
/** further out than this, the next hop goes back toward the middle */
export const HOP_EDGE = 0.6;
/** they stay inside this much of the ellipse, and inside the screen's sides */
export const FLOOR_LIMIT = 0.9;
/** a kororin's radius at scale 1: 25 / 29 / 33 px (the prototype's R); the figure's box is drawn at RADIUS_BASE */
export const radiusOf = (i: number) => 25 + ((((i * 7) % 3) + 3) % 3) * 4;
export const RADIUS_BASE = 29;

/** the hop the kororin `i` takes at its own time t (direction in radians, along speed, up speed, the wait to the next) */
export function hopOf(i: number, t: number, gx: number, gz: number): { dir: number; along: number; up: number; next: number } {
  const a = (((i * 97 + Math.floor(t * 7)) % 360) * Math.PI) / 180;
  const dir = Math.hypot(gx, gz) > HOP_EDGE ? Math.atan2(-gz, -gx) : a;
  const along = HOP_ALONG[0] + ((i * 13) % 4) * 0.07;
  const up = HOP_UP[0] + ((i * 37 + Math.floor(t * 3)) % 5) * 50;
  const next = HOP_EVERY[0] + ((i * 31 + Math.floor(t)) % 7) * 0.22;
  return { dir, along, up, next };
}

/** keep on the record (and inside the screen's sides): a kororin over the edge is put back and bounces off */
export function keepInside(st: FloorState, f: Floor): void {
  const d = Math.hypot(st.gx, st.gz);
  if (d > FLOOR_LIMIT) {
    st.gx *= FLOOR_LIMIT / d;
    st.gz *= FLOOR_LIMIT / d;
    st.vgx *= -0.4;
    st.vgz *= -0.4;
  }
  const sx = f.cx + st.gx * f.rx;
  const lo = f.W * 0.05 + st.R * 0.6;
  const hi = f.W * 0.95 - st.R * 0.6;
  if (sx < lo) {
    st.gx = (lo - f.cx) / f.rx;
    st.vgx = Math.abs(st.vgx) * 0.4;
  }
  if (sx > hi) {
    st.gx = (hi - f.cx) / f.rx;
    st.vgx = -Math.abs(st.vgx) * 0.4;
  }
}

/**
 * a beat of ▶'s club music (startSim3D's beatHop): every other kororin (by beat + its number) that is on the floor hops
 * now, the hop it would take at its own time; its next own hop is counted from here. Returns whether it hopped.
 */
export function beatHop(st: FloorState, i: number, t: number, beat: number): boolean {
  if (st.h > 0.5 || (beat + i) % 2 !== 0) return false;
  const hp = hopOf(i, t, st.gx, st.gz);
  st.h = 0;
  st.vgx = Math.cos(hp.dir) * hp.along;
  st.vgz = Math.sin(hp.dir) * hp.along * 0.8;
  st.vh = hp.up;
  st.wv -= 2.6;
  st.hopT = t + hp.next;
  return true;
}

/** one kororin's step on the floor (t: its own clock after this step) */
export function floorStep(st: FloorState, i: number, t: number, dt: number, f: Floor): void {
  if (st.h <= 0.5) {
    st.h = 0;
    if (st.hopT && t > st.hopT) {
      const hp = hopOf(i, t, st.gx, st.gz);
      st.vgx = Math.cos(hp.dir) * hp.along;
      st.vgz = Math.sin(hp.dir) * hp.along * 0.8;
      st.vh = hp.up;
      st.wv -= 2.6;
      st.hopT = t + hp.next;
    } else if (!st.hopT) st.hopT = t + 0.4 + (i % 5) * 0.3;
    if (st.vh <= 0) {
      st.vgx *= 0.6;
      st.vgz *= 0.6;
    }
  }
  st.vh -= GRAVITY * dt;
  st.h += st.vh * dt;
  if (st.h < 0) {
    // landing squashes it (the spring brings it back)
    if (st.vh < -200) st.wv += Math.min(4, -st.vh / 300);
    st.h = 0;
    st.vh = 0;
  }
  st.gx += st.vgx * dt;
  st.gz += st.vgz * dt;
  keepInside(st, f);
}

/** the floor is measured in screen size when they push (the near ones are bigger and take more room) */
export const PUSH_DEPTH = 2.4;
/**
 * two kororins too close on the floor push each other apart (a dragged one does not move); only when at about the same
 * height (one hopping over another passes). Returns whether they touched.
 */
export function pushApart(p: FloorState, q: FloorState, f: Floor, pHeld = false, qHeld = false): boolean {
  if (pHeld && qHeld) return false;
  const sp = depthScale(p.gz);
  const sq = depthScale(q.gz);
  const dx = (q.gx - p.gx) * f.rx;
  const dz = (q.gz - p.gz) * f.ry * PUSH_DEPTH;
  const d = Math.hypot(dx, dz) || 1;
  const m = (p.R * sp + q.R * sq) * 0.95;
  if (d >= m || Math.abs(p.h - q.h) >= (p.R + q.R) * 0.6) return false;
  const o = (m - d) / 2;
  const nx = dx / d;
  const nz = dz / d;
  if (!pHeld) {
    p.gx -= (nx * o) / f.rx;
    p.gz -= (nz * o) / (f.ry * PUSH_DEPTH);
  }
  if (!qHeld) {
    q.gx += (nx * o) / f.rx;
    q.gz += (nz * o) / (f.ry * PUSH_DEPTH);
  }
  return true;
}

/** the squash spring, one frame (stiff, damped; 6 small steps) */
export function springStep(st: FloorState, dt: number): void {
  for (let k = 0; k < 6; k++) {
    const h = dt / 6;
    st.wv += (-560 * st.ws - 4.4 * st.wv) * h;
    st.ws += st.wv * h;
  }
}

/** its shadow on the floor under it: smaller and fainter the higher it is (px) */
export function shadowOf(f: Floor, st: FloorState): { x: number; y: number; w: number; o: number } {
  const g = toScreen(f, st.gx, st.gz, 0);
  const w = st.R * 2 * g.s * (1 - Math.min(0.5, st.h / 400));
  return { x: g.x - w / 2, y: g.y - w * 0.12, w, o: 0.45 * (1 - Math.min(0.7, st.h / 300)) };
}

/** near ones in front: the stacking by depth */
export const zOf = (gz: number) => 6 + Math.round((gz + 1) * 40);
const rowOf = (gz: number): 0 | 1 | 2 => (gz < -1 / 3 ? 0 : gz < 1 / 3 ? 1 : 2);

/** where it is drawn from its floor state (the figure's box is RADIUS_BASE; the ball sits 0.7 R above its spot) */
function place(b: Body, f: Floor): void {
  const st = b.floor!;
  const P = toScreen(f, st.gx, st.gz, st.h);
  const k = st.R / RADIUS_BASE;
  b.x = P.x;
  b.y = P.y - st.R * P.s * 0.7;
  b.size = P.s * k;
  const s = clamp(st.ws, -0.16, 0.16) + (st.h < 1 ? Math.sin(b.t * 2.4 + b.i) * 0.02 : 0);
  b.qx = 1 + s;
  b.qy = 1 - s;
  b.z = zOf(st.gz);
  b.row = rowOf(st.gz);
  b.shadow = shadowOf(f, st);
}

/** a kororin coming in: somewhere on the record, falling from above (the prototype's init) */
export function floorStart(i: number, H: number): FloorState {
  return { gx: (((i * 61) % 100) / 100) * 1.2 - 0.6, gz: (((i * 37) % 100) / 100) * 1.4 - 0.7, h: H * 0.5 + ((i * 53) % 30) * 6, vh: 0, vgx: 0, vgz: 0, hopT: 0, ws: 0, wv: 0, R: radiusOf(i) };
}

/** let go after a drag: it flies along the floor the way it was thrown (the finger's speed, px/s) */
export function throwOf(f: Floor, vx: number, vy: number): { vgx: number; vgz: number; vh: number } {
  return { vgx: clamp(vx / f.rx, -1.6, 1.6), vgz: clamp((vy / (f.ry * FLOOR_SQUEEZE)) * 0.5, -1.6, 1.6), vh: Math.min(500, Math.hypot(vx, vy) * 0.35) };
}

/** 04 §1: eight kororins on the record floor (the rest wait and fall in from above as ones are popped) */
export const floorMotion: FigureMotion = floorMotionOn(REC);

/** kororins hopping on a record floor `rec` (the home's; 06: a plaza's landed scene, seven at most) */
export function floorMotionOn(rec: FloorRec, max: number = HOME_MAX): FigureMotion {
  return {
  kind: 'floor',
  max,
  slotRow: () => 1,
  slotSize: () => 1,
  spawn(_slot, n, W, H) {
    const b = makeBody({ i: n, floor: floorStart(n, H) });
    place(b, floorOf(W, H, rec));
    return b;
  },
  step(b, dt, W, H, pace = 1) {
    const st = b.floor;
    if (!st) return;
    const d = dt * pace;
    b.t += d;
    floorStep(st, b.i, b.t, d, floorOf(W, H, rec));
  },
  settle(bodies, dt, W, H) {
    const f = floorOf(W, H, rec);
    const live = bodies.filter((b) => b.floor);
    for (let k = 0; k < 2; k++)
      for (let i = 0; i < live.length; i++)
        for (let j = i + 1; j < live.length; j++) {
          const p = live[i];
          const q = live[j];
          pushApart(p.floor!, q.floor!, f, p.drag, q.drag);
        }
    for (const b of live) {
      springStep(b.floor!, dt);
      if (b.drag) continue;
      place(b, f);
    }
  },
  drag(b, W, H) {
    const st = b.floor;
    if (!st) return;
    const f = floorOf(W, H, rec);
    const g = toGround(f, b.x, b.y + st.R * 0.3);
    st.gx = g.gx;
    st.gz = g.gz;
    st.h = 0;
    st.vh = 0;
    b.size = depthScale(st.gz) * (st.R / RADIUS_BASE);
    b.z = 95;
    b.shadow = shadowOf(f, st);
  },
  beat(b, beat) {
    if (b.floor) beatHop(b.floor, b.i, b.t, beat);
  },
  drop(b, W, H) {
    const st = b.floor;
    if (!st) return;
    const f = floorOf(W, H, rec);
    const t = throwOf(f, b.vx, b.vy);
    st.vgx = t.vgx;
    st.vgz = t.vgz;
    st.vh = t.vh;
    st.wv += 4.5;
  },
};
}

/** the sunglasses (shown while the music plays): round 7 in 10, the others 3 (the prototype's shades) */
export type Shades = 'round' | 'way' | 'star' | 'heart';
export function shadesOf(i: number): Shades {
  const h = (((i * 7 + 3) % 10) + 10) % 10;
  return h < 7 ? 'round' : (['way', 'star', 'heart'] as const)[h - 7];
}
/** the name inside the ball, under the face: small, smaller for a long name (px at scale 1) */
export const nameFont = (name: string, R = RADIUS_BASE) => Math.max(6.5, Math.min(R * 0.34, (R * 1.4) / Math.max(1, [...name].length)));

// --- §1 tap: the kororin pops ---------------------------------------------------------------------------------------

/** a popped kororin: the chibi, the words with the voice, then the chibi goes home to the record (ms from the tap) */
export const POP = { burstMs: 160, bubbleMs: 260, voiceMs: 300, quietMs: 2300, awayMs: 2900, doneMs: 3600 } as const;
/** the play's drop point: you land on the record here (fractions of the screen; the prototype's NEEDLE) */
export const NEEDLE = { x: 0.6, y: 0.52 } as const;
/** the tonearm on the home picture (fractions of the 9:16 picture; the prototype's armdoor at 390×844): tap → your profile */
export const TONEARM = { x0: 0.582, y0: 0.505, x1: 0.902, y1: 0.465 } as const;
/** where the chibi goes when it has spoken (fractions of the screen: the record's label) */
export const RECORD_LABEL = { x: 0.47, y: 0.69 } as const;

// --- §2 ▶: the groove ------------------------------------------------------------------------------------------------

/**
 * The groove the kororins ride in the play view (the prototype's PATH, measured on the close-up of the record): an
 * ellipse around the label off to the right (fractions of the screen), from 262° (the back, top) round the left arc to
 * 72° (the front, bottom); a kororin pops at 152° and keeps riding while it talks. One ride takes 10.5 s.
 */
export const GROOVE = { cx: 1.02, cy: 0.455, rx: 0.8, ry: 0.32, a0: 262, a1: 72, pop: 152, dur: 10.5 } as const;
/** degrees per second along the groove */
export const GROOVE_SPEED = (GROOVE.a0 - GROOVE.a1) / GROOVE.dur;
/** ▶ → you fall onto the record (0.8 s) → the view turns → the grooves start */
export const DROP_MS = 800;
export const GROOVE_START_MS = 850;
/** the first three start partway along (so the first talks at about 2.3 s, M-R304), then one every 2.6 s */
export const GROOVE_HEAD = [22, 69, 116] as const;
export const GROOVE_EVERY_MS = 2600;
/** from the pop to the voice (the chibi is out first) */
export const VOICE_AFTER_POP_MS = 240;

/** a point on the groove: where (px) and how big (far small, near big) */
export function grooveAt(deg: number, W: number, H: number): { x: number; y: number; s: number } {
  const r = (deg * Math.PI) / 180;
  const x = GROOVE.cx * W + GROOVE.rx * W * Math.cos(r);
  const y = GROOVE.cy * H + GROOVE.ry * H * Math.sin(r);
  return { x, y, s: 0.3 + 1.35 * clamp(y / H, 0, 1) };
}

/** one kororin's ride: when it starts (ms after ▶) and from which angle */
export interface Ride {
  k: number;
  startMs: number;
  from: number;
}
export function grooveRides(n: number): Ride[] {
  return Array.from({ length: n }, (_, k) =>
    k < GROOVE_HEAD.length ? { k, startMs: GROOVE_START_MS, from: GROOVE.pop + GROOVE_HEAD[k] } : { k, startMs: GROOVE_START_MS + (k - GROOVE_HEAD.length + 1) * GROOVE_EVERY_MS, from: GROOVE.a0 },
  );
}
/** where a ride is at `ms` after ▶ (degrees; null: not on the record yet, or gone) */
export function rideAngle(r: Ride, ms: number): number | null {
  if (ms < r.startMs) return null;
  const a = r.from - (GROOVE_SPEED * (ms - r.startMs)) / 1000;
  return a < GROOVE.a1 ? null : a;
}
export const ridePopMs = (r: Ride) => r.startMs + ((r.from - GROOVE.pop) / GROOVE_SPEED) * 1000;
export const rideEndMs = (r: Ride) => r.startMs + ((r.from - GROOVE.a1) / GROOVE_SPEED) * 1000;
/** ▶ → the first voice (about 2.3 s, M-R304) */
export const firstVoiceMs = () => ridePopMs(grooveRides(1)[0]) + VOICE_AFTER_POP_MS;
/** ▶ → the last kororin has ridden off (then 「全部聞いたね」) */
export const grooveEndMs = (n: number) => (n ? Math.max(...grooveRides(n).map(rideEndMs)) : GROOVE_START_MS);

export const ALL_HEARD = '🎉 今日のコロリン、全部聞いたね！';

// --- §3 the profile: the 2D stage ---------------------------------------------------------------------------------

/** the stone ground (fraction of the height), the speakers' width (fraction of the width) */
export const STAGE = { floor: 0.7, speaker: 0.15 } as const;
/** how many past kororins pile up in the sample (yourself 18, a dachi 10–13) */
export const samplePileCount = (name: string, mine: boolean) => (mine ? 18 : 10 + ([...name].length % 4));

export interface PileBall {
  j: number;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  drag: boolean;
  isNew: boolean;
}
/** the walls (inside the speakers) and the ground (px) */
export function stageBox(W: number, H: number) {
  const sw = W * STAGE.speaker;
  return { L: sw * 0.9, R: W - sw * 0.9, F: H * STAGE.floor };
}
/** n past kororins (oldest first; the last is the newest, a little bigger, NEW) falling from above in turn */
export function pileStart(n: number, W: number, H: number): PileBall[] {
  const { L, R } = stageBox(W, H);
  return Array.from({ length: n }, (_, j) => {
    const isNew = j === n - 1;
    const r = 18 + ((j * 7) % 3) * 3 + (isNew ? 4 : 0);
    return { j, r, x: L + r + (((j * 61) % 100) / 100) * (R - L - 2 * r), y: -r - j * 46, vx: 0, vy: 0, drag: false, isNew };
  });
}
/** one frame of the pile: gravity, the ground, the walls, and the balls pushing (and knocking) each other */
export function pileStep(bs: PileBall[], dt: number, W: number, H: number): void {
  const { L, R, F } = stageBox(W, H);
  for (const b of bs) {
    if (b.drag) continue;
    b.vy += GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= 0.995;
    if (b.y + b.r > F) {
      b.y = F - b.r;
      b.vy = -b.vy * 0.3;
      b.vx *= 0.9;
      if (Math.abs(b.vy) < 30) b.vy = 0;
    }
    if (b.x - b.r < L) {
      b.x = L + b.r;
      b.vx = Math.abs(b.vx) * 0.5;
    }
    if (b.x + b.r > R) {
      b.x = R - b.r;
      b.vx = -Math.abs(b.vx) * 0.5;
    }
  }
  for (let k = 0; k < 3; k++)
    for (let i = 0; i < bs.length; i++)
      for (let j = i + 1; j < bs.length; j++) {
        const p = bs[i];
        const q = bs[j];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const m = p.r + q.r - 3;
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
        }
      }
  // a pile pressing out never goes through the ground or the speakers
  for (const b of bs) {
    if (b.drag) continue;
    b.x = clamp(b.x, L + b.r, R - b.r);
    b.y = Math.min(b.y, F - b.r);
  }
}

/** the sample's past words (the prototype's PLINES) */
const PAST_LINES = ['明日もがんばるZE', 'うまいラーメン見つけた', 'ねむい…でも楽しい', '新曲できたかも', '空がきれいだった', '月がでかい', 'バイト終わった〜', '推しが尊い', '今日はカレー', '雨の音すき', 'テスト終わった！', '夜ふかし中', '海いきたい', '新しい靴買った', 'ねこに会えた', '朝焼けやばい'];
/** the sample's past kororins of one person (newest first, like the API) */
export function samplePast(person: { id: string; name: string; mine?: boolean }, now = Date.now()): HomeWork[] {
  const n = samplePileCount(person.name, !!person.mine);
  return Array.from({ length: n }, (_, j) => ({
    id: `saturn-past-${person.id}-${j}`,
    kind: 'saturn_post' as const,
    author: { id: person.id, name: person.name },
    rel: person.mine ? ('own' as const) : ('dachi' as const),
    text: PAST_LINES[(j + [...person.name].length) % PAST_LINES.length],
    url: null,
    flownAt: new Date(now - (j + 1) * 20 * 3600_000).toISOString(),
    demo: true,
  }));
}
