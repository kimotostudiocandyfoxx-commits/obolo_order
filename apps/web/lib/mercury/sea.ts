import type { SynthPreset } from '@/lib/synth';

/**
 * Mercury — the planet of music (client design 2026-10-05 v2, docs/mercury.md).
 * The sea is the timeline: friends' released songs sail as ships for 88 hours. Every user has an
 * island (their profile); demo songs are buried in its soil, released songs decorate it as records
 * once their 88 hours at sea are over.
 * SAMPLE DATA (P-MER-2): ships and avatars are cut out of the client's mock (public/onboarding/
 * ship-*.webp, av-*.webp); songs are emoji records with synthesised sound.
 */
export interface Song {
  id: string;
  title: string;
  artist: string;
  /** record art (public/onboarding/<cover>.webp) or an emoji record */
  cover?: string;
  emoji?: string;
  hue?: number;
  seconds: number;
  preset: SynthPreset;
  /** a real recording (a saved song with vocals); played instead of the synth preset */
  audioUrl?: string;
  /** hours since it was released */
  hoursAgo?: number;
  /** a real post (server id): it can be answered; who replied (faces, never a count) */
  postId?: string;
  repliers?: import('@obolo/shared').PlanetAuthor[];
}

export interface Sailor {
  id: string;
  handle: string;
  avatar: string;
  ship: string;
  /** where the ship (with its speech bubble) sits on the sea art, in % of 1254×970 */
  box: { left: number; top: number; width: number; height: number };
  /** the activity line drawn in the ship's bubble */
  bubble: string;
  friend: boolean;
  follow: boolean;
  /** songs released in the last 88 hours (newest first) — what plays when you tap the ship */
  sailing: Song[];
  /** older songs, displayed as records on the island */
  records: Song[];
  residents: number;
  discovered: number;
  chests: [number, number, number];
}

export const P = (bpm: number, root: number, mode: 'major' | 'minor', progression: number[], wave: OscillatorType): SynthPreset => ({
  bpm,
  root,
  mode,
  progression,
  wave,
});

const box = (x0: number, y0: number, x1: number, y1: number) => ({
  left: (x0 / 1254) * 100,
  top: ((y0 - 160) / 970) * 100,
  width: ((x1 - x0) / 1254) * 100,
  height: ((y1 - y0) / 970) * 100,
});

let n = 0;
const s = (title: string, artist: string, emoji: string, hue: number, seconds: number, preset: SynthPreset, hoursAgo: number): Song => ({
  id: `m${++n}`,
  title,
  artist,
  emoji,
  hue,
  seconds,
  preset,
  hoursAgo,
});

export const SAILORS: Sailor[] = [
  {
    id: 'wani_queen', handle: 'wani_queen', avatar: 'av-wani_queen', ship: 'ship-wani_queen', box: box(70, 175, 410, 545),
    bubble: '島「女王の舞踏会」をつくった', friend: true, follow: true,
    sailing: [s('女王の舞踏会', 'wani_queen', '👑', 300, 214, P(108, 62, 'major', [0, 4, 5, 3], 'triangle'), 12)],
    records: [s('ワニのワルツ', 'wani_queen', '🐊', 120, 190, P(90, 60, 'major', [0, 3, 4, 0], 'triangle'), 120), s('黄金のティータイム', 'wani_queen', '🫖', 40, 205, P(84, 64, 'major', [0, 5, 3, 4], 'sine'), 300)],
    residents: 2900, discovered: 31, chests: [180, 64, 22],
  },
  {
    id: 'kaba_boss', handle: 'kaba_boss', avatar: 'av-kaba_boss', ship: 'ship-kaba_boss', box: box(470, 200, 800, 560),
    bubble: 'クラブ「MIDNIGHT CRUISE」でプレイ中', friend: true, follow: false,
    sailing: [s('MIDNIGHT CRUISE', 'kaba_boss', '🛳️', 230, 236, P(124, 57, 'minor', [0, 5, 3, 4], 'sawtooth'), 8), s('ボスの朝コーヒー', 'kaba_boss', '☕', 28, 180, P(96, 60, 'minor', [0, 3, 6, 4], 'square'), 30)],
    records: [s('カバの重低音', 'kaba_boss', '🦛', 260, 200, P(118, 52, 'minor', [0, 6, 5, 4], 'sawtooth'), 200)],
    residents: 1200, discovered: 18, chests: [95, 30, 8],
  },
  {
    id: 'gori4545', handle: 'gori4545', avatar: 'av-gori4545', ship: 'ship-gori4545', box: box(860, 260, 1190, 605),
    bubble: '新曲をアップした「Street Jungle Fever」', friend: true, follow: true,
    sailing: [s('Street Jungle Fever', 'gori4545', '🍌', 52, 198, P(96, 55, 'minor', [0, 5, 3, 4], 'square'), 5)],
    records: [s('バナナは正義', 'gori4545', '🦍', 80, 176, P(92, 57, 'minor', [0, 3, 6, 4], 'square'), 150)],
    residents: 4545, discovered: 45, chests: [214, 58, 12],
  },
  {
    id: 'samurai806', handle: 'samurai806', avatar: 'av-samurai806', ship: 'ship-samurai806', box: box(60, 560, 380, 875),
    bubble: 'プレイリストを更新「サムライ・ウェイブ」', friend: true, follow: false,
    sailing: [s('サムライ・ウェイブ', 'samurai806', '⚔️', 205, 222, P(100, 62, 'minor', [0, 3, 4, 3], 'triangle'), 15)],
    records: [s('富士の朝焼け', 'samurai806', '🗻', 15, 240, P(76, 60, 'major', [0, 5, 3, 4], 'triangle'), 400)],
    residents: 806, discovered: 12, chests: [60, 20, 6],
  },
  {
    id: 'kong_dread', handle: 'kong_dread', avatar: 'av-kong_dread', ship: 'ship-kong_dread', box: box(480, 560, 800, 885),
    bubble: '♪ 今これを聴いてる「Cosmic Rainbow」', friend: true, follow: true,
    sailing: [s('Cosmic Rainbow', 'kong_dread', '🌈', 290, 245, P(84, 64, 'major', [0, 4, 5, 3], 'triangle'), 2), s('レゲエな洗濯日和', 'kong_dread', '🧺', 140, 190, P(76, 62, 'major', [0, 3, 4, 3], 'square'), 40)],
    records: [s('ドレッドの子守唄', 'kong_dread', '🌙', 245, 210, P(70, 62, 'major', [0, 4, 5, 3], 'sine'), 500)],
    residents: 3300, discovered: 27, chests: [150, 41, 9],
  },
  {
    id: 'pen_lady', handle: 'pen_lady', avatar: 'av-pen_lady', ship: 'ship-pen_lady', box: box(845, 635, 1190, 980),
    bubble: '♪ 今これを聴いてる「Lunar Gothic」', friend: false, follow: true,
    sailing: [s('Lunar Gothic', 'pen_lady', '🦇', 270, 230, P(90, 57, 'minor', [0, 6, 5, 4], 'sawtooth'), 4)],
    records: [s('南極のララバイ', 'pen_lady', '🐧', 195, 200, P(72, 64, 'minor', [0, 3, 6, 4], 'sine'), 180)],
    residents: 640, discovered: 9, chests: [40, 15, 4],
  },
  {
    id: 'onigiri', handle: 'onigiri', avatar: 'av-onigiri', ship: 'ship-onigiri', box: box(90, 875, 370, 1130),
    bubble: '新曲を出航！「ごはんのうた」', friend: true, follow: true,
    sailing: [s('ごはんのうた', 'onigiri', '🍙', 95, 150, P(108, 64, 'major', [0, 4, 5, 3], 'triangle'), 3), s('梅干しすっぱいブルース', 'onigiri', '🟥', 350, 170, P(80, 60, 'minor', [0, 3, 4, 3], 'square'), 50)],
    records: [s('のりのりマーチ', 'onigiri', '🍘', 30, 140, P(120, 62, 'major', [0, 3, 4, 3], 'square'), 220)],
    residents: 310, discovered: 7, chests: [22, 8, 2],
  },
  {
    id: 'dj_kong', handle: 'dj_kong', avatar: 'av-dj_kong', ship: 'ship-dj_kong', box: box(450, 875, 820, 1130),
    bubble: '★3をつけた「真夜中のマーキュリー」', friend: false, follow: true,
    sailing: [s('真夜中のマーキュリー', 'dj_kong', '🪩', 250, 240, P(128, 57, 'minor', [0, 5, 3, 4], 'sawtooth'), 1)],
    records: [s('ジャングル・ブレイク', 'dj_kong', '🥁', 20, 200, P(140, 55, 'minor', [0, 6, 5, 6], 'sawtooth'), 160)],
    residents: 5200, discovered: 52, chests: [300, 90, 25],
  },
];

export const FLY_HOURS = 88;
export const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
