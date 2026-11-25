import type { SongLyricLine, WorkTags } from '@obolo/shared';
import { clamp, lerpPts, type AllowedArea } from './layout';
import { makeBody, type FigureMotion } from './motion';

/**
 * 水星（handoff docs/handoff/planets-02-mercury.md; prototype design/home/template.html setupMer / makeSh / popSh / playM /
 * vinyl / kinTitle / lyricsStart): the numbers and rules of Mercury's home, its songs and its sky (tested in mercury.test.ts).
 */

// --- §1 the ships on the sea ----------------------------------------------------------------------------------------

/** one lane: its height on the screen (fraction), the ships' size there, the row (0 back, 1 middle, 2 front) */
export type Lane = readonly [y: number, size: number, row: 0 | 1 | 2];

/** the prototype's MSLOT: back 2, middle 3, front 2 = seven ships (M-R280), smaller toward the back */
export const MSLOT: readonly Lane[] = [
  [0.6, 0.5, 0],
  [0.62, 0.5, 0],
  [0.69, 0.78, 1],
  [0.72, 0.78, 1],
  [0.75, 0.78, 1],
  [0.83, 1.08, 2],
  [0.88, 1.08, 2],
];
export const MERCURY_MAX = MSLOT.length;
/** where each lane's ship starts across the screen (fraction) */
export const MSLOT_X = [0.2, 0.62, 0.12, 0.48, 0.84, 0.3, 0.7] as const;
export const laneOf = (slot: number): Lane => MSLOT[((slot % MSLOT.length) + MSLOT.length) % MSLOT.length];

/** a ship this far (px) past an edge comes back in at the other one (the prototype: the sea goes round) */
export const WRAP_PX = 60;
/** dropped ships keep this close to the screen (px past an edge at most) */
export const DROP_EDGE_PX = 40;

/**
 * its speed (px/s): 10–22, a ship in an odd slot sails left; nearer ships (bigger) a little faster — the prototype's
 * makeSh: (10 + ((i·7) mod 4)·4) · (slot odd ? −1 : 1) · (0.6 + size·0.5)
 */
export function sailSpeed(i: number, slot: number): number {
  const S = laneOf(slot);
  return (10 + ((i * 7) % 4) * 4) * (slot % 2 ? -1 : 1) * (0.6 + S[1] * 0.5);
}

/** the sea a ship may be dropped on (the home's: below the horizon to the bottom; a continent's starts higher) */
export interface Sea {
  top: number;
  bottom: number;
  /** height → size (piecewise linear: far = small, near = big) */
  scale: readonly (readonly [number, number])[];
  /** the row borders by height */
  cuts: readonly [number, number];
}
/** the home's sea (the prototype's drop: lane .56–.9, size [[.6,.5],[.69,.78],[.83,1.08]], rows at .64 / .78) */
export const HOME_SEA: Sea = { top: 0.56, bottom: 0.9, scale: [[0.6, 0.5], [0.69, 0.78], [0.83, 1.08]], cuts: [0.64, 0.78] };
/** a continent's sea, seen from lower down (spawnStrangers: lane .42–.9, size from .5) */
export const LAND_SEA: Sea = { top: 0.42, bottom: 0.9, scale: [[0.5, 0.5], [0.69, 0.78], [0.83, 1.08]], cuts: [0.64, 0.78] };

/** 3-2 Mercury's hook (handoff 01 3-2 / M-R303): a ship stays on the sea only — dropped in the sky, it goes down to the water */
export const seaOnly =
  (sea: Sea = HOME_SEA): AllowedArea =>
  (x, y) => ({ x, y: clamp(y, sea.top, sea.bottom) });

export const rowOnSea = (y: number, sea: Sea = HOME_SEA): 0 | 1 | 2 => (y < sea.cuts[0] ? 0 : y < sea.cuts[1] ? 1 : 2);

/** one frame of a ship: sail on (round the edges), bob and tilt on the waves (the prototype's setupMer step) */
export function sailStep(b: { x: number; y: number; t: number; i: number; v: number; lane: number; rot: number; flip: boolean }, dt: number, W: number, H: number, pace = 1) {
  b.t += dt;
  b.x += b.v * dt * pace;
  if (b.x > W + WRAP_PX) b.x = -WRAP_PX;
  if (b.x < -WRAP_PX) b.x = W + WRAP_PX;
  b.y = b.lane * H + Math.sin(b.t * 1.6 + b.i) * 4;
  b.rot = Math.sin(b.t * 1.3 + b.i * 2) * 4;
  b.flip = b.v < 0;
}

/** Mercury's layout (handoff 02 §1): seven ships on the lanes of MSLOT, sailing left and right; dragged, they stay on `sea` */
export function sailMotion(sea: Sea = HOME_SEA, startX: (slot: number) => number = (slot) => MSLOT_X[((slot % 7) + 7) % 7]): FigureMotion {
  return {
    kind: 'sail',
    max: MERCURY_MAX,
    slotRow: (slot) => laneOf(slot)[2],
    slotSize: (slot) => laneOf(slot)[1],
    spawn(slot, n, W, H) {
      const L = laneOf(slot);
      const v = sailSpeed(n, slot);
      // the prototype's clock is the page's: a new ship starts mid-wave like the rest
      return makeBody({ x: startX(slot) * W, y: L[0] * H, lane: L[0], size: L[1], row: L[2], i: n, v, flip: v < 0 });
    },
    step(b, dt, W, H, pace = 1) {
      sailStep(b, dt, W, H, pace);
    },
    drop(b, W, H, allowed = seaOnly(sea)) {
      const p = allowed(b.x / W, b.y / H);
      b.lane = clamp(p.y, sea.top, sea.bottom);
      b.size = lerpPts(b.lane, sea.scale);
      b.row = rowOnSea(b.lane, sea);
      b.x = clamp(p.x * W, -DROP_EDGE_PX, W + DROP_EDGE_PX);
      b.y = b.lane * H;
    },
  };
}

// --- §2 a ship tapped: it comes to the front, the disc, the lyrics, the title --------------------------------------

/** the ship's place in front (fractions of the screen) and its size there (popSh: W·.5, H·.84, ×2.15) */
export const SHIP_FRONT = { x: 0.5, y: 0.84, size: 2.15 } as const;
/** after the tap: the song and the disc (ms) / the title and its reading (ms) */
export const SONG_START_MS = 450;
export const TITLE_MS = 2200;
/**
 * the title read in its maker's voice plays with the title's entrance (TITLE_MS), over the song as it is (the handoff asks
 * no ducking); a reading that arrives later than this after the entrance is left out (it would be read under another line)
 */
export const TITLE_VOICE_LATE_MS = 1500;
/** whether the title's reading may still play `sinceOpenMs` after the song was opened */
export const titleVoiceInTime = (sinceOpenMs: number, titleMs: number = TITLE_MS) => sinceOpenMs <= Math.max(0, titleMs) + TITLE_VOICE_LATE_MS;

/** where the picture disc, the lyrics and the title go (CSS top / width), by where the song is opened */
export const STAGE = {
  home: { disc: { top: '38%', width: '80%' }, lyrics: '60%', title: '6%' },
  play: { disc: { top: '37%', width: '78%' }, lyrics: '59%', title: '7%' },
  profile: { disc: { top: '30%', width: '62%' }, lyrics: '52%', title: '9%' },
  land: { disc: { top: '36%', width: '74%' }, lyrics: '63%', title: '7%' },
} as const;
export type StagePlace = keyof typeof STAGE;

/** the lyric being sung at `t` (s): which line, how much of it is coloured (0–100, from the left), the next line */
export function lyricAt(lines: readonly SongLyricLine[], t: number, duration?: number | null): { i: number; progress: number; next: string } {
  let i = -1;
  for (let j = 0; j < lines.length; j++) if (t >= lines[j].t) i = j;
  const next = lines.length ? lines[(i + 1) % lines.length].text : '';
  if (i < 0) return { i, progress: 0, next };
  const st = lines[i].t;
  const en = i + 1 < lines.length ? lines[i + 1].t : (duration ?? lines[i].end ?? st + 4);
  // the colour fills over the first 80% of the line's time (the prototype's lyricsStart)
  const progress = clamp(((t - st) / Math.max(0.001, (en - st) * 0.8)) * 100, 0, 100);
  return { i, progress, next };
}

// --- the title: each song its own font and entrance (M-R283 / M-R284) ----------------------------------------------

export type TitleMotion = 'pop' | 'float' | 'slam' | 'glitch' | 'brush';
export interface TitleStyle {
  font: string;
  /** the Google Fonts family (loaded for the title's own letters only) */
  family: string;
  motion: TitleMotion;
}
const T = (font: string, motion: TitleMotion, family = font.replace(/ /g, '+')): TitleStyle => ({ font, family, motion });
/** the prototype's pairs (TSTYLE), by title */
const BY_TITLE: Record<string, TitleStyle> = {
  夏のはじまり: T('Mochiy Pop One', 'pop'),
  チルな午後: T('Zen Kurenaido', 'float'),
  パーティー: T('Rampart One', 'glitch'),
  夜のバラード: T('Shippori Mincho B1', 'float', 'Shippori+Mincho+B1:wght@800'),
  走れ: T('Reggae One', 'slam'),
};
/** until the title's own pair is chosen when the song is made (M-R284: by AI, later): by the song's genre */
const BY_GENRE: Record<string, TitleStyle> = {
  'J-POP': T('Mochiy Pop One', 'pop'),
  アニソン: T('Hachi Maru Pop', 'pop'),
  ローファイ: T('Zen Kurenaido', 'float'),
  バラード: T('Shippori Mincho B1', 'float', 'Shippori+Mincho+B1:wght@800'),
  ジャズ: T('Shippori Mincho B1', 'float', 'Shippori+Mincho+B1:wght@800'),
  EDM: T('Rampart One', 'glitch'),
  ロック: T('Reggae One', 'slam'),
  ヒップホップ: T('Dela Gothic One', 'slam'),
  シティポップ: T('Kaisei Decol', 'brush', 'Kaisei+Decol:wght@700'),
};
const ANY: TitleStyle[] = [BY_GENRE['J-POP'], BY_GENRE['ローファイ'], BY_GENRE.EDM, BY_GENRE['バラード'], BY_GENRE['ロック']];

export function titleStyle(title: string, tags?: WorkTags | null): TitleStyle {
  if (BY_TITLE[title]) return BY_TITLE[title];
  if (tags?.main && BY_GENRE[tags.main]) return BY_GENRE[tags.main];
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return ANY[h % ANY.length];
}

/** a letter's kind sets its size in the title (M-R284: kanji ×1.14, katakana ×1, hiragana ×0.8, the rest ×0.92) */
export const letterKind = (ch: string): 'kj' | 'hr' | 'kt' | 'lt' => (/[一-鿿々]/.test(ch) ? 'kj' : /[぀-ゟ]/.test(ch) ? 'hr' : /[゠-ヿー]/.test(ch) ? 'kt' : 'lt');
/** the gap between letters coming in (s), by the entrance */
export const LETTER_GAP: Record<TitleMotion, number> = { pop: 0.045, float: 0.09, slam: 0.07, glitch: 0.03, brush: 0 };

// --- §3 ▶ the view from your pier ----------------------------------------------------------------------------------

/** your house on the backdrop (MHOUSE): you dance out of it when ▶ is pressed */
export const MHOUSE = { x: 0.77, y: 0.53 } as const;
/** a ship in the play view: comes from the left, stops in front, the song (to its end), then leaves to the right (playM) */
export const PIER_PATH = {
  from: { x: -0.15, y: 0.6, size: 0.35 },
  sit: { x: 0.42, y: 0.67, size: 1.25 },
  front: { x: 0.5, y: 0.84, size: 1.9 },
  away: { x: 1.2, y: 0.62, size: 0.5 },
  arriveMs: 1800,
  leaveMs: 1400,
  /** the title after the ship stops (ms) */
  titleMs: 1500,
} as const;
export const ALL_HEARD = '🏝 今日の曲、全部聴いたね！';

// --- the sample (the preview's demo cast: the prototype's songs) ---------------------------------------------------

/** the prototype's five songs (MSONG) — full songs, about 60–75 s each (M-R291) */
export const SAMPLE_SONGS = ['夏のはじまり', 'チルな午後', 'パーティー', '夜のバラード', '走れ'] as const;
export const sampleSongUrl = (k: number) => `/planets/sample/song-${k}.mp3`;
/** the prototype's lyrics with their times (LYRICS: songs 1 and 3; the others play without lyrics) */
export const SAMPLE_LYRICS: Record<number, SongLyricLine[]> = {
  1: [
    { t: 0.6, text: '青い空に 手をのばして' },
    { t: 4.4, text: '波の音が 背中を押す' },
    { t: 8.2, text: 'はじまるよ ぼくらの夏' },
    { t: 12.0, text: 'いま 走り出せ' },
  ],
  3: [
    { t: 0.5, text: '光るフロアに 飛びこんで' },
    { t: 4.2, text: 'みんなで 手を上げろ' },
    { t: 8.0, text: '夜が明けるまで 踊ろう' },
    { t: 12.0, text: 'パーティー パーティー' },
  ],
};
/** which sample song a url is (/planets/sample/song-K.mp3) */
export const sampleSongOf = (url: string | null | undefined): number | null => {
  const m = /\/planets\/sample\/song-(\d)\.mp3$/.exec(url ?? '');
  return m ? Number(m[1]) : null;
};
/** a stand-in ship for someone with no figure painted yet (the prototype's four coloured ships) */
export const shipStandIn = (seed: string) => {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return `/planets/ships/ship-${(h % 4) + 1}.webp`;
};
