import type { HomePlanet } from '@obolo/shared';
import { clamp, lerpPts } from './layout';
import { LAND_SEA, MSLOT_X, sailMotion } from './mercury';
import { makeBody, type Body, type FigureMotion } from './motion';
import { floorMotionOn, type FloorRec } from './saturn';

/**
 * 空から探す per planet (handoff 06 §2・§5・§6; prototype SKYV / spawnStrangers / spawnFlutter / autoNext): what the sky
 * looks like on each planet, how the strangers' figures move on a continent once you have landed, where they come from
 * on the shore (▶), how long one work stays there, and the words that change with the planet. Pure (skyPlanets.test.ts).
 *
 * Mercury: ships sail the sea lanes, on the sea only. Jupiter: butterflies holding a small art flutter around the glade.
 * Saturn: kororins hop on the plaza's record floor (the same hops as the home, on the landed picture's record). The five
 * (Mars, Venus, Uranus, Pluto, Neptune; handoff 07, prototype SKYV): their 05 vehicles (UFO, DJ booth, balloon, flying
 * book, bubble) flutter round the landed scene like Jupiter's butterflies, come down from the top to the bottom left on
 * the shore and leave to the right; their 05 viewers open the work with the maker's figure and name at the top.
 */

/** at most seven strangers on a continent (06 §5) */
export const LAND_MAX = 7;

/** the prototype's GLADE: seven places on a landed scene (x, y — fractions — and size) */
export const GLADE: readonly (readonly [number, number, number])[] = [
  [0.22, 0.5, 0.55],
  [0.55, 0.46, 0.55],
  [0.82, 0.55, 0.6],
  [0.14, 0.66, 0.8],
  [0.42, 0.64, 0.8],
  [0.72, 0.7, 0.82],
  [0.3, 0.82, 1.05],
];
/** dropped on the glade: the size by height (dropFloat's [[.45,.55],[.65,.8],[.82,1.05]]) and where it may stay */
export const GLADE_SCALE: readonly (readonly [number, number])[] = [
  [0.45, 0.55],
  [0.65, 0.8],
  [0.82, 1.05],
];
export const GLADE_BOX = { x0: 0.06, x1: 0.94, y0: 0.34, y1: 0.88 } as const;
const gladeOf = (i: number) => GLADE[((i % GLADE.length) + GLADE.length) % GLADE.length];
/** each one's own flutter (spawnFlutter: w1, w2, p1, p2) */
export const flutterWave = (i: number) => ({ w1: 0.5 + ((i * 17) % 7) * 0.07, w2: 0.7 + ((i * 11) % 5) * 0.09, p1: i * 1.7, p2: i * 2.3 });

/** the glade (Jupiter's butterflies, the five's figures): flutter around a place, fly in from either side */
export const flutterMotion: FigureMotion = {
  kind: 'drift',
  max: LAND_MAX,
  slotRow: (slot) => (gladeOf(slot)[2] < 0.7 ? 0 : gladeOf(slot)[2] < 1 ? 1 : 2),
  slotSize: (slot) => gladeOf(slot)[2],
  spawn(slot, n, W, H) {
    const S = gladeOf(slot);
    return makeBody({ cx: S[0], cy: S[1], size: S[2], sx: 0.05, sy: 0.02, x: W * (n % 2 ? 1.1 : -0.1), y: H * 0.55, i: n, row: flutterMotion.slotRow(slot) });
  },
  step(b, dt, W, H, pace = 1) {
    const d = dt * pace;
    b.t += d;
    const f = flutterWave(b.i);
    const tx = (b.cx + Math.sin(b.t * f.w1 + f.p1) * b.sx) * W;
    const ty = (b.cy + Math.sin(b.t * f.w2 + f.p2) * b.sy) * H + Math.sin(b.t * 6 + b.i) * 3;
    const dx = tx - b.x;
    b.x += dx * Math.min(1, d * 3);
    b.y += (ty - b.y) * Math.min(1, d * 3);
    b.rot = clamp(dx * 0.6, -14, 14);
  },
  drop(b, W, H) {
    const x = clamp(b.x / W, GLADE_BOX.x0, GLADE_BOX.x1);
    const y = clamp(b.y / H, GLADE_BOX.y0, GLADE_BOX.y1);
    const f = flutterWave(b.i);
    // it stays where it was let go: the flutter's centre moves so the wave is at the finger now
    b.cx = x - Math.sin(b.t * f.w1 + f.p1) * b.sx;
    b.cy = y - Math.sin(b.t * f.w2 + f.p2) * b.sy;
    b.size = lerpPts(y, GLADE_SCALE);
    b.row = y < 0.6 ? 0 : y < 0.75 ? 1 : 2;
    b.x = x * W;
    b.y = y * H;
  },
};

/**
 * Saturn's plazas: the record on the landed pictures (public/planets/continents/saturn/<key>-land.webp, fractions of
 * the 9:16 picture). The ten plazas were painted from one layout; measured on all ten, the record's label sits at
 * about .65 and the record runs from .5 to .84 down the picture.
 */
export const PLAZA_REC: FloorRec = { cx: 0.5, cy: 0.66, rx: 0.6, ry: 0.17 };
export const plazaMotion: FigureMotion = floorMotionOn(PLAZA_REC, LAND_MAX);
/** Mercury: the continent's sea (spawnStrangers: the same lanes as the home, from lower down) */
export const seaMotion: FigureMotion = sailMotion(LAND_SEA, (slot) => MSLOT_X[((slot % 7) + 7) % 7]);

/** a point of the shore view (fractions of the screen) and the size there */
export type ShorePoint = { x: number; y: number; size: number };
export interface SkyPlanet {
  /** how the figures move on a landed continent */
  land: 'sail' | 'flutter' | 'floor';
  /** ▶ on a continent: each figure comes from `from`, stays at `to` while its work is open, leaves to `out` (SKYV pier*) */
  shore: { from: ShorePoint; to: ShorePoint; out: ShorePoint };
  /** how long one work stays on the shore (ms); null: until it has finished (Mercury's song, Mars's MV) */
  holdMs: number | null;
  /** where the maker's figure and name sit (fraction of the screen's height): under the opened work, or above it (the five) */
  whoTop: number;
  /** the five: their 05 viewer opens no higher than this (fraction of the screen's height), clear of the maker above it */
  workTop?: number;
  /** ♡: 「これから〇〇にも来てくれるよ」 */
  home: string;
  /** what drifts here, for the under-15 line (「15歳になると、ここに知らない人の〇〇が…」) */
  works: string;
}

const P = (x: number, y: number, size: number): ShorePoint => ({ x, y, size });
/**
 * 07 §3 the five (prototype SKYV pierFrom / pierTo / pierOut): the vehicle comes down from above and stops at the bottom
 * left (☆ ♡ stay clear), then leaves to the right; the maker's figure and name at the top of the screen (whoTop 7.5%:
 * the work's title is under the work, so they never overlap). How long one work stays: Mars the MV's length (the
 * prototype's 14 s), Venus 6 s, Uranus 5 s, Pluto 6 s, Neptune 5 s.
 */
const FIVE_SKY = { land: 'flutter', shore: { from: P(0.5, -0.1, 0.35), to: P(0.2, 0.88, 0.9), out: P(1.2, 0.3, 0.4) }, whoTop: 0.075, workTop: 0.16 } as const;

export const SKY_PLANETS: Record<HomePlanet, SkyPlanet> = {
  mercury: { land: 'sail', shore: { from: P(-0.2, 0.5, 0.35), to: P(0.22, 0.86, 0.9), out: P(1.25, 0.55, 0.45) }, holdMs: null, whoTop: 0.73, home: 'きみの島', works: '曲' },
  jupiter: { land: 'flutter', shore: { from: P(0.5, 0.08, 0.3), to: P(0.17, 0.86, 0.9), out: P(0.5, -0.2, 0.3) }, holdMs: 7000, whoTop: 0.76, home: 'きみの森', works: 'アート' },
  saturn: { land: 'floor', shore: { from: P(0.5, -0.1, 0.4), to: P(0.5, 0.62, 1.25), out: P(1.2, 0.5, 0.6) }, holdMs: 5000, whoTop: 0.72, home: 'きみのレコード', works: '声' },
  // 07 §1: 推した時 — 「これから{きみのシアター／ブース／お店／図書館／ゲーム小屋}にも来てくれるよ」
  mars: { ...FIVE_SKY, holdMs: null, home: 'きみのシアター', works: 'MV' },
  venus: { ...FIVE_SKY, holdMs: 6000, home: 'きみのブース', works: '番組' },
  uranus: { ...FIVE_SKY, holdMs: 5000, home: 'きみのお店', works: 'グッズ' },
  pluto: { ...FIVE_SKY, holdMs: 6000, home: 'きみの図書館', works: '物語' },
  neptune: { ...FIVE_SKY, holdMs: 5000, home: 'きみのゲーム小屋', works: 'ゲーム' },
};

/** a planet's landed motion */
export function landMotionOf(planet: HomePlanet): FigureMotion {
  const k = SKY_PLANETS[planet].land;
  return k === 'sail' ? seaMotion : k === 'floor' ? plazaMotion : flutterMotion;
}

/** where the strangers are when you land: one body per figure (seven at most), W×H px */
export function landingLayout(planet: HomePlanet, n: number, W: number, H: number): Body[] {
  const m = landMotionOf(planet);
  return Array.from({ length: Math.min(n, LAND_MAX) }, (_, i) => m.spawn(i, i, W, H));
}

// --- 「どの島と入れかえる？」: drag the new island onto one of your five ----------------------------------------------

export interface SlotRect {
  i: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}
/** a finger this close (px) to an island still counts as on it */
export const SWAP_SLACK_PX = 14;
/**
 * The island under a finger (the slot number), or null. The one whose box (with a little slack) holds the point; of
 * several (they overlap a little), the one whose centre is nearest.
 */
export function hitSlot(x: number, y: number, rects: readonly SlotRect[], slack = SWAP_SLACK_PX): number | null {
  let best: { i: number; d: number } | null = null;
  for (const r of rects) {
    if (x < r.left - slack || x > r.right + slack || y < r.top - slack || y > r.bottom + slack) continue;
    const d = Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2);
    if (!best || d < best.d) best = { i: r.i, d };
  }
  return best ? best.i : null;
}
/** an island's box on a W×H screen from its slot ([x, y, width] fractions; the picture is about 0.8 as tall as wide) */
export function slotRect(i: number, S: readonly [number, number, number], W: number, H: number, aspect = 0.8): SlotRect {
  const w = S[2] * W;
  const h = w * aspect;
  return { i, left: S[0] * W - w / 2, top: S[1] * H - h / 2, right: S[0] * W + w / 2, bottom: S[1] * H + h / 2 };
}

/** the landed name: as big as fits in 46% of the screen's width (06 §5), 44 px at most */
export const landNameSize = (name: string, W: number) => Math.min(44, Math.floor((W * 0.46) / Math.max(1, [...name].length)));
