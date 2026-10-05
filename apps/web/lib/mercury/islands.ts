import type { SynthPreset } from '@/lib/synth';

/**
 * Mercury — the planet of music (client design 2026-10-05, docs/mercury.md).
 * The sea chart has one island per genre; sail to an island to hear its songs.
 * SAMPLE DATA (P-MER-2): three songs use the client's record art, the rest are emoji records; the
 * sound is the built-in synth until real songs exist.
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
  /** shown on the フォロー / ダチ tabs */
  follow?: boolean;
  friend?: boolean;
}

export interface Island {
  id: string;
  name: string;
  /** tap area on the map (% of the 1254×974 chart) */
  x: number;
  y: number;
  r: number;
  residents: number;
  color: string;
  songs: Song[];
}

const P = (bpm: number, root: number, mode: 'major' | 'minor', progression: number[], wave: OscillatorType): SynthPreset => ({ bpm, root, mode, progression, wave });

export const ISLANDS: Island[] = [
  {
    id: 'hiphop',
    name: 'HIPHOP王国',
    x: 21.5, y: 17.5, r: 15,
    residents: 48210,
    color: '#b46cff',
    songs: [
      { id: 'ramen', title: 'ラーメン・フリースタイル', artist: 'FOXX', cover: 'cover-ramen', seconds: 201, preset: P(92, 57, 'minor', [0, 5, 3, 4], 'square'), follow: true },
      { id: 'hh2', title: '月曜の改札ブルース', artist: 'MC TSUKIN', emoji: '🚃', hue: 280, seconds: 184, preset: P(88, 55, 'minor', [0, 3, 6, 4], 'sawtooth'), friend: true },
      { id: 'hh3', title: 'コンビニ・アンセム', artist: 'yoru_no_kuma', emoji: '🏪', hue: 200, seconds: 172, preset: P(96, 60, 'minor', [0, 6, 5, 4], 'square') },
    ],
  },
  {
    id: 'classic',
    name: 'クラシック草原',
    x: 52, y: 15.5, r: 13,
    residents: 12880,
    color: '#cfe3ff',
    songs: [
      { id: 'cl1', title: '朝の紅茶と雨の音', artist: 'pianissimo', emoji: '🫖', hue: 210, seconds: 240, preset: P(72, 64, 'major', [0, 4, 5, 3], 'sine'), follow: true },
      { id: 'cl2', title: '図書館のワルツ', artist: 'shiori', emoji: '📖', hue: 40, seconds: 205, preset: P(84, 62, 'major', [0, 3, 4, 0], 'triangle') },
    ],
  },
  {
    id: 'pop',
    name: 'ポップタウン',
    x: 80.5, y: 18.5, r: 16,
    residents: 63540,
    color: '#ff9be8',
    songs: [
      { id: 'hokahoka', title: 'ほかほか日だまり', artist: 'neko_no_hi', cover: 'cover-hokahoka', seconds: 225, preset: P(96, 67, 'major', [0, 3, 4, 3], 'triangle'), friend: true },
      { id: 'pp2', title: '放課後クリームソーダ', artist: 'MOMO', emoji: '🥤', hue: 150, seconds: 198, preset: P(118, 63, 'major', [5, 3, 0, 4], 'square'), follow: true },
      { id: 'pp3', title: '88円の魔法', artist: 'MANA girls', emoji: '✨', hue: 290, seconds: 210, preset: P(120, 62, 'major', [0, 4, 5, 3], 'square') },
    ],
  },
  {
    id: 'rock',
    name: 'ロック山脈',
    x: 16, y: 48, r: 15,
    residents: 39120,
    color: '#ff6a3d',
    songs: [
      { id: 'chikoku', title: '遅刻ダッシュ8:29', artist: 'RUN BOYS', cover: 'cover-chikoku', seconds: 189, preset: P(152, 52, 'minor', [0, 6, 5, 6], 'sawtooth'), follow: true },
      { id: 'rk2', title: '目覚まし三回目', artist: 'NEMUI', emoji: '⏰', hue: 10, seconds: 176, preset: P(140, 55, 'minor', [0, 5, 6, 4], 'sawtooth'), friend: true },
    ],
  },
  {
    id: 'edm',
    name: 'EDM大陸',
    x: 48, y: 48, r: 14,
    residents: 52700,
    color: '#7fb6ff',
    songs: [
      { id: 'ed1', title: '終電ダンスフロア', artist: 'DJ HOME', emoji: '🪩', hue: 250, seconds: 222, preset: P(128, 57, 'minor', [0, 5, 3, 4], 'sawtooth') },
      { id: 'ed2', title: '洗濯機ハウス', artist: 'spin_spin', emoji: '🌀', hue: 190, seconds: 200, preset: P(124, 60, 'minor', [0, 3, 6, 4], 'square'), follow: true },
    ],
  },
  {
    id: 'traditional',
    name: 'トラディショナル諸島',
    x: 78, y: 72, r: 16,
    residents: 21430,
    color: '#ffc46b',
    songs: [
      { id: 'tr1', title: 'おばあちゃんの縁側', artist: 'koto_ne', emoji: '🍵', hue: 30, seconds: 230, preset: P(76, 62, 'minor', [0, 3, 4, 3], 'triangle'), friend: true },
      { id: 'tr2', title: '夏祭りの帰り道', artist: 'taiko_boy', emoji: '🏮', hue: 15, seconds: 190, preset: P(100, 60, 'major', [0, 5, 3, 4], 'triangle') },
    ],
  },
  {
    id: 'minna',
    name: 'みんなの島',
    x: 18.5, y: 79, r: 15,
    residents: 88880,
    color: '#ffe08a',
    songs: [
      { id: 'mn1', title: '今日のごはんは何だろう', artist: 'hara_peko', emoji: '🍛', hue: 35, seconds: 150, preset: P(108, 64, 'major', [0, 4, 5, 3], 'triangle'), friend: true },
      { id: 'mn2', title: '犬の散歩でサンバ', artist: 'pochi_papa', emoji: '🐕', hue: 120, seconds: 165, preset: P(112, 62, 'major', [0, 3, 4, 3], 'square') },
      { id: 'mn3', title: '宿題おわらないロック', artist: 'chuu2', emoji: '📚', hue: 260, seconds: 140, preset: P(146, 57, 'minor', [0, 6, 5, 4], 'sawtooth'), follow: true },
    ],
  },
];

/** Where the baked UI sits on the chart art (% of 1254×974): our live versions cover it. */
export const CARD_RECT = { left: 63.4, top: 35.2, width: 22.2, height: 23.8 };
export const CREATE_RECT = { left: 77.8, top: 89.8, width: 21.4, height: 8.8 };

export const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
