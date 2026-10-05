import { P } from '@/lib/mercury/sea';
import type { SynthPreset } from '@/lib/synth';

/**
 * Mars — the planet of video (client design 2026-10-05, docs/mars.md).
 * 星図 (timeline): friends' videos of the last 88 hours fly in as UFOs with their cards.
 * Studio (profile): every user has a studio; videos land there after their 88 hours.
 * Two looks, chosen by the user: 郊外 (canyon) and 街中 (city).
 * SAMPLE DATA (P-MARS-2): UFOs, cards and thumbnails are cut out of the client's mocks.
 */
export type Theme = 'canyon' | 'city';
export const THEMES: { id: Theme; label: string }[] = [
  { id: 'canyon', label: '郊外' },
  { id: 'city', label: '街中' },
];

export type Kind = 'MV' | '映画' | '番組' | 'LIVE';
export const KIND_COLOR: Record<Kind, string> = { MV: 'bg-violet-600', 映画: 'bg-sky-600', 番組: 'bg-emerald-600', LIVE: 'bg-red-600' };

export interface Video {
  id: string;
  title: string;
  kind: Kind;
  author: string;
  /** thumbnail (public/onboarding/<thumb>.jpg) or an emoji frame */
  thumb?: string;
  emoji?: string;
  hue?: number;
  seconds: number;
  /** what happens on screen, shown as the video plays */
  scenes: string[];
  bgm: SynthPreset;
  hoursAgo?: number;
  views?: string;
}

export interface Creator {
  id: string;
  handle: string;
  friend: boolean;
  follow: boolean;
  live?: boolean;
  /** videos of the last 88 hours (newest first) — what plays when you tap the UFO */
  flying: Video[];
  /** older videos, shown in the studio */
  works: Video[];
  followers: string;
}

/** Where each UFO (with its card) sits on the two timeline arts, in % of 1254×1045. */
export const POD_BOX: Record<Theme, Record<string, { left: number; top: number; width: number; height: number }>> = {
  canyon: {
    onigiri: { left: 11.56, top: 3.35, width: 32.14, height: 26.79 },
    gorilla5454: { left: 48.25, top: 3.83, width: 32.30, height: 29.19 },
    wani_queen: { left: 14.19, top: 32.34, width: 29.51, height: 25.26 },
    kaba_boss: { left: 52.79, top: 32.34, width: 29.51, height: 25.26 },
    gori4545: { left: 12.76, top: 53.40, width: 32.54, height: 24.31 },
    samurai806: { left: 55.50, top: 54.74, width: 32.06, height: 22.01 },
    kong_dread: { left: 10.77, top: 73.88, width: 35.33, height: 23.92 },
    pen_lady: { left: 52.63, top: 74.26, width: 34.61, height: 23.73 },
  },
  city: {
    onigiri: { left: 20.57, top: 5.07, width: 32.62, height: 20.48 },
    gorilla5454: { left: 54.47, top: 10.81, width: 33.81, height: 23.83 },
    wani_queen: { left: 7.42, top: 25.65, width: 34.21, height: 23.83 },
    kaba_boss: { left: 54.47, top: 33.78, width: 34.21, height: 24.31 },
    gori4545: { left: 7.42, top: 49.09, width: 35.41, height: 23.35 },
    samurai806: { left: 54.47, top: 56.75, width: 36.60, height: 24.78 },
    kong_dread: { left: 7.02, top: 71.10, width: 34.61, height: 27.18 },
    pen_lady: { left: 52.47, top: 73.01, width: 37.80, height: 26.99 },
  },};

let n = 0;
const v = (title: string, kind: Kind, author: string, thumb: string | undefined, emoji: string, hue: number, seconds: number, scenes: string[], bgm: SynthPreset, hoursAgo: number, views: string): Video => ({
  id: `v${++n}`,
  title,
  kind,
  author,
  thumb,
  emoji,
  hue,
  seconds,
  scenes,
  bgm,
  hoursAgo,
  views,
});
const POP = P(112, 64, 'major', [0, 4, 5, 3], 'triangle');
const DARK = P(90, 57, 'minor', [0, 6, 5, 4], 'sawtooth');
const LIVE = P(128, 57, 'minor', [0, 5, 3, 4], 'sawtooth');
const EPIC = P(76, 60, 'minor', [0, 3, 4, 3], 'triangle');

export const CREATORS: Creator[] = [
  { id: 'onigiri', handle: 'おにぎり丸', friend: true, follow: true, followers: '1.2万', flying: [v('ごはんのうた', 'MV', 'おにぎり丸', 'thumb-onigiri', '🍙', 95, 222, ['草原におにぎりが集合', 'みんなで「いただきます」', 'のりを巻いてジャンプ！'], POP, 0, '3.1万')], works: [v('梅干しの冒険', '映画', 'おにぎり丸', undefined, '🟥', 350, 300, ['すっぱい旅のはじまり'], EPIC, 200, '8,800')] },
  { id: 'gorilla5454', handle: 'GORILLA 5454', friend: true, follow: true, live: true, followers: '45万', flying: [v('【LIVE】配信中', 'LIVE', 'GORILLA 5454', 'thumb-gorilla5454', '🦍', 280, 8100, ['ステージに光が走る', '1.2万人が視聴中', 'コール＆レスポンス！'], LIVE, 0, '1.2万人視聴')], works: [v('ジャングル・フェス', 'LIVE', 'GORILLA 5454', undefined, '🌴', 120, 3600, ['フェスのアーカイブ'], LIVE, 300, '120万')] },
  { id: 'wani_queen', handle: '女王', friend: true, follow: false, followers: '2.9万', flying: [v('女王の舞踏会 予告編', '映画', '女王', 'thumb-wani_queen', '👑', 30, 135, ['シャンデリアの下で', '扇子をひらく女王', '「舞踏会へようこそ」'], EPIC, 0.2, '5.4万')], works: [v('黄金のティータイム', '番組', '女王', undefined, '🫖', 40, 900, ['優雅な午後'], POP, 150, '2.2万')] },
  { id: 'kaba_boss', handle: 'カバ', friend: true, follow: true, followers: '8.8万', flying: [v('深夜のマフィア会議 #12', '番組', 'カバ', 'thumb-kaba_boss', '🦛', 260, 1440, ['テーブルを囲むボスたち', '議題：明日のランチ', '「異議なし」'], DARK, 0.3, '2.4万')], works: [v('ボスの休日', '番組', 'カバ', undefined, '☕', 28, 1200, ['ボスもたまには休む'], POP, 400, '6.1万')] },
  { id: 'gori4545', handle: 'ゴリラ', friend: true, follow: false, followers: '4.5万', flying: [v('スプレー・タイム', 'MV', 'ゴリラ', 'thumb-gori4545', '🎨', 300, 118, ['壁に「KING」', 'スプレーで色をのせる', '夜明けの完成'], P(96, 55, 'minor', [0, 5, 3, 4], 'square'), 0.3, '9.7万')], works: [v('バナナは正義', 'MV', 'ゴリラ', undefined, '🍌', 52, 176, ['正義のバナナ'], POP, 220, '30万')] },
  { id: 'samurai806', handle: '侍', friend: true, follow: true, followers: '8,060', flying: [v('サムライ・ウェイブ', '映画', '侍', 'thumb-samurai806', '⚔️', 205, 158, ['荒波と満月', '刀を抜く侍', '一閃'], EPIC, 0.4, '1.8万')], works: [v('富士の朝焼け', '映画', '侍', undefined, '🗻', 15, 240, ['静かな朝'], EPIC, 500, '5,200')] },
  { id: 'kong_dread', handle: 'DJ ゴリラ', friend: false, follow: true, live: true, followers: '12万', flying: [v('サイケデリック・ナイト', 'LIVE', 'DJ ゴリラ', 'thumb-kong_dread', '🪩', 290, 260, ['ミラーボールが回る', 'フロアが揺れる', 'ドロップ！'], LIVE, 0.5, '3.3万')], works: [v('トリップ・タイム', 'MV', 'DJ ゴリラ', undefined, '🌈', 270, 252, ['色の旅'], LIVE, 180, '22万')] },
  { id: 'pen_lady', handle: 'ペンギン', friend: false, follow: true, live: true, followers: '6,400', flying: [v('Lunar Gothic', 'MV', 'ペンギン', 'thumb-pen_lady', '🦇', 250, 191, ['月夜の古城', 'ゆっくり振り向くペンギン', '黒いマントがひるがえる'], DARK, 0.6, '1.1万')], works: [v('南極のララバイ', 'MV', 'ペンギン', undefined, '🐧', 195, 200, ['氷の子守唄'], EPIC, 300, '4,000')] },
];

export const fmtLen = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

/** Card slots on the two studio arts (% of the image), featured first. */
export const STUDIO: Record<Theme, { art: string; aspect: string; slots: { left: number; top: number; width: number; height: number }[]; title: { left: number; top: number; width: number; height: number }; buttons: { left: number; top: number; width: number; height: number } }> = {
  city: {
    art: 'mars-studio-city',
    aspect: '1254 / 1078',
    title: { left: 27.3, top: 2.4, width: 43.2, height: 13.2 },
    buttons: { left: 71.5, top: 6.6, width: 26.6, height: 4.8 },
    slots: [
      [447, 190, 800, 585],
      [415, 612, 602, 835],
      [620, 612, 808, 835],
      [832, 612, 1033, 835],
      [415, 845, 602, 1062],
      [620, 845, 808, 1062],
      [832, 845, 1033, 1062],
    ].map(([x0, y0, x1, y1]) => ({ left: (x0 / 1254) * 100, top: (y0 / 1078) * 100, width: ((x1 - x0) / 1254) * 100, height: ((y1 - y0) / 1078) * 100 })),
  },
  canyon: {
    art: 'mars-studio-canyon',
    aspect: '1254 / 1168',
    title: { left: 3.0, top: 1.5, width: 40.0, height: 14.6 },
    buttons: { left: 3.0, top: 17.3, width: 34.0, height: 4.8 },
    slots: [
      [608, 240, 1005, 665],
      [160, 680, 428, 928],
      [488, 680, 752, 928],
      [810, 680, 1075, 928],
      [160, 935, 428, 1155],
      [488, 935, 752, 1155],
      [810, 935, 1075, 1155],
    ].map(([x0, y0, x1, y1]) => ({ left: (x0 / 1254) * 100, top: (y0 / 1168) * 100, width: ((x1 - x0) / 1254) * 100, height: ((y1 - y0) / 1168) * 100 })),
  },
};
