/**
 * SAMPLE DATA for the visual-only planets in the 10/10 demo (Jupiter, Mercury, Venus, Mars,
 * Uranus, Neptune). PLACEHOLDER (P-DEMO-1): replaced by real APIs in phases 2–3.
 * All media is generated in the browser (CSS art + WebAudio), so no external assets are needed.
 */
import type { Locale } from '@obolo/shared';

export type L10n = Record<Locale, string>;
export const tr = (v: L10n, l: Locale) => v[l];

export interface SampleTrack {
  id: string;
  title: L10n;
  artist: string;
  bpm: number;
  /** MIDI note of the tonic (60 = C4) */
  root: number;
  mode: 'major' | 'minor';
  /** scale degrees (0-based) for a 4-bar loop */
  progression: number[];
  wave: OscillatorType;
  loops: number;
  stars: [number, number, number];
  label: boolean;
  ai: boolean;
  hue: number;
  emoji: string;
  tags: L10n;
}

export const TRACKS: SampleTrack[] = [
  { id: 't1', title: { ja: '月夜のシティポップ', en: 'Moonlit City Pop' }, artist: 'DJ KIMOTO', bpm: 104, root: 62, mode: 'major', progression: [3, 4, 2, 5], wave: 'triangle', loops: 128400, stars: [820, 1430, 3210], label: true, ai: false, hue: 265, emoji: '🌃', tags: { ja: 'シティポップ・夜', en: 'City pop · Night' } },
  { id: 't2', title: { ja: '土星の環でダンス', en: 'Dancing on Saturn’s Rings' }, artist: 'hana', bpm: 124, root: 57, mode: 'minor', progression: [0, 5, 3, 4], wave: 'sawtooth', loops: 45200, stars: [310, 640, 980], label: true, ai: true, hue: 35, emoji: '🪐', tags: { ja: 'ハウス', en: 'House' } },
  { id: 't3', title: { ja: '放課後ローファイ', en: 'After-School Lo-fi' }, artist: 'mika88', bpm: 78, root: 65, mode: 'major', progression: [0, 5, 3, 4], wave: 'sine', loops: 9800, stars: [120, 210, 160], label: false, ai: true, hue: 190, emoji: '📚', tags: { ja: 'ローファイ', en: 'Lo-fi' } },
  { id: 't4', title: { ja: 'Singapore Sunrise', en: 'Singapore Sunrise' }, artist: 'Leo', bpm: 112, root: 60, mode: 'major', progression: [0, 4, 5, 3], wave: 'square', loops: 22100, stars: [200, 330, 510], label: false, ai: false, hue: 20, emoji: '🌅', tags: { ja: 'トロピカル', en: 'Tropical' } },
  { id: 't5', title: { ja: '水星のしずく', en: 'Droplets of Mercury' }, artist: 'aqua', bpm: 90, root: 64, mode: 'minor', progression: [0, 3, 6, 4], wave: 'sine', loops: 3400, stars: [44, 61, 72], label: false, ai: true, hue: 200, emoji: '💧', tags: { ja: 'アンビエント', en: 'Ambient' } },
  { id: 't6', title: { ja: '火星行き最終列車', en: 'Last Train to Mars' }, artist: 'RYO', bpm: 132, root: 55, mode: 'minor', progression: [0, 6, 5, 6], wave: 'sawtooth', loops: 67300, stars: [500, 910, 1500], label: true, ai: false, hue: 8, emoji: '🚄', tags: { ja: 'エレクトロ', en: 'Electro' } },
  { id: 't7', title: { ja: 'ねこと宇宙遊泳', en: 'Space Walk with My Cat' }, artist: 'nyan', bpm: 96, root: 67, mode: 'major', progression: [0, 3, 4, 3], wave: 'triangle', loops: 15800, stars: [180, 260, 340], label: false, ai: true, hue: 320, emoji: '🐈', tags: { ja: 'ポップ', en: 'Pop' } },
  { id: 't8', title: { ja: '88円の魔法', en: 'The ¥88 Spell' }, artist: 'MANA girls', bpm: 118, root: 63, mode: 'major', progression: [5, 3, 0, 4], wave: 'square', loops: 88800, stars: [700, 1200, 2400], label: true, ai: false, hue: 280, emoji: '✨', tags: { ja: 'アイドル', en: 'Idol pop' } },
  { id: 't9', title: { ja: '海王星ゲームBGM', en: 'Neptune Game BGM' }, artist: 'pixel_tanaka', bpm: 140, root: 60, mode: 'minor', progression: [0, 5, 6, 4], wave: 'square', loops: 5100, stars: [60, 90, 70], label: false, ai: false, hue: 230, emoji: '🎮', tags: { ja: 'チップチューン', en: 'Chiptune' } },
  { id: 't10', title: { ja: 'おやすみ、バティ', en: 'Good Night, Bati' }, artist: 'yuki', bpm: 70, root: 62, mode: 'major', progression: [0, 4, 5, 3], wave: 'sine', loops: 12300, stars: [90, 220, 410], label: false, ai: true, hue: 245, emoji: '🌙', tags: { ja: '子守唄', en: 'Lullaby' } },
];

export interface SamplePhoto {
  id: string;
  author: string;
  caption: L10n;
  sound: L10n;
  hue: number;
  emoji: string;
  stars: number;
  trackId: string;
}

export const PHOTOS: SamplePhoto[] = [
  { id: 'p1', author: 'hana', caption: { ja: '朝焼けの海と波の音', en: 'Sunrise sea with wave sounds' }, sound: { ja: '環境音', en: 'Ambient' }, hue: 20, emoji: '🌊', stars: 342, trackId: 't5' },
  { id: 'p2', author: 'leo_space', caption: { ja: 'マリーナベイの夜', en: 'Marina Bay at night' }, sound: { ja: '自作BGM', en: 'Own BGM' }, hue: 250, emoji: '🌉', stars: 210, trackId: 't4' },
  { id: 'p3', author: 'nyan', caption: { ja: 'うちの猫、ゴロゴロ音つき', en: 'My cat, purring included' }, sound: { ja: 'ボイスメモ', en: 'Voice memo' }, hue: 35, emoji: '🐈', stars: 980, trackId: 't7' },
  { id: 'p4', author: 'mika88', caption: { ja: '放課後のカフェ', en: 'After-school café' }, sound: { ja: '水星の曲', en: 'Mercury track' }, hue: 15, emoji: '☕', stars: 120, trackId: 't3' },
  { id: 'p5', author: 'RYO', caption: { ja: '終電のホーム', en: 'Last train platform' }, sound: { ja: '水星の曲', en: 'Mercury track' }, hue: 0, emoji: '🚉', stars: 455, trackId: 't6' },
  { id: 'p6', author: 'aqua', caption: { ja: '雨上がりの紫陽花', en: 'Hydrangeas after rain' }, sound: { ja: '雨音', en: 'Rain' }, hue: 280, emoji: '🌸', stars: 301, trackId: 't5' },
  { id: 'p7', author: 'DJ KIMOTO', caption: { ja: 'スタジオの機材たち', en: 'My studio gear' }, sound: { ja: '新曲プレビュー', en: 'New track preview' }, hue: 200, emoji: '🎛️', stars: 1500, trackId: 't1' },
  { id: 'p8', author: 'yuki', caption: { ja: '満月', en: 'Full moon' }, sound: { ja: '子守唄', en: 'Lullaby' }, hue: 230, emoji: '🌕', stars: 222, trackId: 't10' },
  { id: 'p9', author: 'pixel_tanaka', caption: { ja: 'ドット絵を描いた', en: 'Drew some pixel art' }, sound: { ja: 'チップチューン', en: 'Chiptune' }, hue: 140, emoji: '👾', stars: 87, trackId: 't9' },
];

export interface SampleReel {
  id: string;
  author: string;
  caption: L10n;
  hues: [number, number];
  emoji: string;
  stars: number;
  comments: number;
}

export const REELS: SampleReel[] = [
  { id: 'r1', author: 'hana', caption: { ja: '15秒で踊ってみた #土星ダンス', en: '15-second dance #SaturnDance' }, hues: [30, 320], emoji: '💃', stars: 12400, comments: 342 },
  { id: 'r2', author: 'nyan', caption: { ja: '猫、ついに宇宙へ', en: 'Cat finally goes to space' }, hues: [200, 280], emoji: '🐈‍⬛', stars: 30100, comments: 1200 },
  { id: 'r3', author: 'chef_ken', caption: { ja: '真四角オムライス', en: 'Perfectly square omurice' }, hues: [45, 10], emoji: '🍳', stars: 8800, comments: 210 },
  { id: 'r4', author: 'leo_space', caption: { ja: 'スケボーで一回転', en: 'Skateboard kickflip' }, hues: [170, 230], emoji: '🛹', stars: 5600, comments: 98 },
  { id: 'r5', author: 'DJ KIMOTO', caption: { ja: 'DJプレイ 30秒', en: '30 seconds of DJing' }, hues: [270, 190], emoji: '🎧', stars: 22000, comments: 640 },
];

export interface SampleSeries {
  id: string;
  title: L10n;
  creator: string;
  episodes: number;
  hue: number;
  emoji: string;
  genre: L10n;
}

export const SERIES: SampleSeries[] = [
  { id: 's1', title: { ja: '銀河鉄道のバティ', en: 'Bati on the Galactic Railway' }, creator: 'Studio Candy Foxx', episodes: 12, hue: 250, emoji: '🚂', genre: { ja: 'アニメ', en: 'Anime' } },
  { id: 's2', title: { ja: '月面カフェの午後', en: 'Afternoons at the Lunar Café' }, creator: 'mika88', episodes: 8, hue: 30, emoji: '🍰', genre: { ja: 'ドラマ', en: 'Drama' } },
  { id: 's3', title: { ja: 'DJ KIMOTOの音楽講座', en: 'Music Lessons with DJ KIMOTO' }, creator: 'DJ KIMOTO', episodes: 20, hue: 200, emoji: '🎹', genre: { ja: '学び', en: 'Learning' } },
  { id: 's4', title: { ja: '火星サバイバル', en: 'Mars Survival' }, creator: 'RYO', episodes: 6, hue: 10, emoji: '🧑‍🚀', genre: { ja: 'SF', en: 'Sci-fi' } },
  { id: 's5', title: { ja: 'ねこ探偵', en: 'Detective Cat' }, creator: 'nyan', episodes: 10, hue: 320, emoji: '🕵️', genre: { ja: 'ミステリー', en: 'Mystery' } },
];

export interface SampleProduct {
  id: string;
  name: L10n;
  shop: string;
  priceMana: number;
  hue: number;
  emoji: string;
}

export const PRODUCTS: SampleProduct[] = [
  { id: 'g1', name: { ja: 'バティ Tシャツ', en: 'Bati T-shirt' }, shop: 'Obolo Official', priceMana: 2800, hue: 240, emoji: '👕' },
  { id: 'g2', name: { ja: '土星マグカップ', en: 'Saturn mug' }, shop: 'hana shop', priceMana: 1500, hue: 35, emoji: '☕' },
  { id: 'g3', name: { ja: '猫ステッカー 5枚', en: 'Cat stickers ×5' }, shop: 'nyan store', priceMana: 500, hue: 320, emoji: '🐾' },
  { id: 'g4', name: { ja: 'DJ KIMOTO パーカー', en: 'DJ KIMOTO hoodie' }, shop: 'KIMOTO GOODS', priceMana: 5800, hue: 270, emoji: '🧥' },
  { id: 'g5', name: { ja: 'ドット絵トート', en: 'Pixel-art tote' }, shop: 'pixel_tanaka', priceMana: 2200, hue: 140, emoji: '👜' },
  { id: 'g6', name: { ja: '月のポスター', en: 'Moon poster' }, shop: 'yuki prints', priceMana: 1800, hue: 220, emoji: '🖼️' },
];

export interface SampleGame {
  id: string;
  title: L10n;
  dev: string;
  rating: number;
  plays: number;
  hue: number;
  emoji: string;
  genre: L10n;
  priceMana: number;
}

export const GAMES: SampleGame[] = [
  { id: 'n1', title: { ja: 'バティのリズム月面ジャンプ', en: 'Bati’s Rhythm Moon Jump' }, dev: 'Studio Candy Foxx', rating: 4.8, plays: 120000, hue: 250, emoji: '🌙', genre: { ja: 'リズム', en: 'Rhythm' }, priceMana: 0 },
  { id: 'n2', title: { ja: '惑星パズル', en: 'Planet Puzzle' }, dev: 'pixel_tanaka', rating: 4.5, plays: 54000, hue: 190, emoji: '🧩', genre: { ja: 'パズル', en: 'Puzzle' }, priceMana: 0 },
  { id: 'n3', title: { ja: 'ねこ宇宙船', en: 'Cat Spaceship' }, dev: 'nyan', rating: 4.6, plays: 33000, hue: 320, emoji: '🚀', genre: { ja: 'アクション', en: 'Action' }, priceMana: 120 },
  { id: 'n4', title: { ja: '土星レーサー', en: 'Saturn Racer' }, dev: 'RYO', rating: 4.3, plays: 18000, hue: 30, emoji: '🏎️', genre: { ja: 'レース', en: 'Racing' }, priceMana: 300 },
  { id: 'n5', title: { ja: 'DJバトル', en: 'DJ Battle' }, dev: 'DJ KIMOTO', rating: 4.7, plays: 72000, hue: 280, emoji: '🎚️', genre: { ja: '音楽', en: 'Music' }, priceMana: 0 },
];

export function compact(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
