/**
 * Sample residents of Jupiter for the demo (P-JUP-2). Butterfly art is cut out of the client's
 * パタパタ mock (public/onboarding/bfb-*.webp, each holding a round sticker book); residents without art fly as a NEO emblem with wings.
 * Posts are emoji "photos" (gradient + emoji) until real sample photos exist.
 */
export interface SamplePost {
  id: string;
  emoji: string;
  hue: number;
  text: string;
  /** hours since it was posted (< 88 → still flying as a butterfly, otherwise a leaf on the tree) */
  hoursAgo: number;
  branch: BranchId;
}

export type BranchId = 'trip' | 'food' | 'walk' | 'festival';

/** Default branches (labels baked into the tree art, P-JUP-4). */
export const BRANCHES: { id: BranchId; label: string }[] = [
  { id: 'trip', label: '旅行' },
  { id: 'food', label: 'ごはん' },
  { id: 'walk', label: 'おさんぽ' },
  { id: 'festival', label: 'おまつり' },
];

export interface Resident {
  id: string;
  handle: string;
  /** butterfly cut-out (public/onboarding/<art>.webp); otherwise `emoji` with wings */
  art?: string;
  emoji?: string;
  wing?: string;
  /** shown on the トモダチ tab */
  friend: boolean;
  fruits: number;
  friends: number;
  posts: SamplePost[];
}

let n = 0;
const p = (emoji: string, hue: number, text: string, hoursAgo: number, branch: BranchId): SamplePost => ({
  id: `s${++n}`,
  emoji,
  hue,
  text,
  hoursAgo,
  branch,
});

/** A few older posts (leaves) so every tree has something on its branches. */
const leaves = (seed: number): SamplePost[] => [
  p('🏞️', 150 + seed, '', 120 + seed, 'trip'),
  p('🏯', 20 + seed, '', 200 + seed, 'trip'),
  p('🎈', 330 - seed, '', 260 + seed, 'trip'),
  p('🍜', 30 + seed, '', 140 + seed, 'food'),
  p('🍡', 340 - seed, '', 300 + seed, 'food'),
  p('🐕', 40 + seed, '', 160 + seed, 'walk'),
  p('🌳', 110 + seed, '', 330 + seed, 'walk'),
  p('🏮', 10 + seed, '', 180 + seed, 'festival'),
  p('🎆', 260 + seed, '', 400 + seed, 'festival'),
];

export const RESIDENTS: Resident[] = [
  { id: 'kitsune', handle: 'kitsune', art: 'bfb-kitsune', friend: true, fruits: 12, friends: 846, posts: [p('🍁', 18, '紅葉、はじまってた', 3, 'walk'), p('🍠', 30, 'やきいも屋さん発見', 5, 'food'), ...leaves(0)] },
  { id: 'kaba_boss', handle: 'kaba_boss', art: 'bfb-kaba_boss', friend: false, fruits: 3, friends: 120, posts: [p('☕', 28, '朝の一杯で、今日もがんばる', 8, 'food'), ...leaves(4)] },
  { id: 'usagi', handle: 'usagi', art: 'bfb-usagi', friend: true, fruits: 20, friends: 1203, posts: [p('🌕', 220, '今夜は月がきれい', 55, 'walk'), p('🍡', 340, 'お月見だんご', 56, 'food'), p('🐇', 300, 'ぴょん', 57, 'walk'), ...leaves(8)] },
  { id: 'onigiri', handle: 'onigiri', art: 'bfb-onigiri', friend: false, fruits: 7, friends: 310, posts: [p('🍙', 95, 'きょうのお昼は鮭', 72, 'food'), ...leaves(12)] },
  { id: 'wani_queen', handle: 'wani_queen', art: 'bfb-wani_queen', friend: true, fruits: 31, friends: 2900, posts: [p('👑', 45, '女王の休日', 40, 'trip'), p('🌹', 350, '', 41, 'walk'), ...leaves(16)] },
  { id: 'gori4545', handle: 'gori4545', art: 'bfb-gori4545', friend: false, fruits: 9, friends: 4545, posts: [p('🍌', 52, 'バナナは正義', 81, 'food'), ...leaves(20)] },
  { id: 'pen_lady', handle: 'pen_lady', art: 'bfb-pen_lady', friend: true, fruits: 15, friends: 640, posts: [p('🧊', 195, '南極から来ました', 47, 'trip'), p('🐟', 210, '', 48, 'food'), ...leaves(24)] },
  { id: 'samurai806', handle: 'samurai806', art: 'bfb-samurai806', friend: false, fruits: 6, friends: 806, posts: [p('🗻', 205, '富士山、近かった', 30, 'trip'), ...leaves(28)] },
  // without art: they fly as an emblem with wings (like a NEO without custom art)
  { id: 'neko_mimi', handle: 'neko_mimi', emoji: '🐈', wing: '#f3b4a6', friend: true, fruits: 4, friends: 88, posts: [p('🐈', 25, 'ねこ、ひなたぼっこ中', 12, 'walk'), ...leaves(32)] },
  { id: 'kuma_cafe', handle: 'kuma_cafe', emoji: '🐻', wing: '#c9a27a', friend: false, fruits: 11, friends: 512, posts: [p('🥞', 35, '新作パンケーキ！', 20, 'food'), p('🍯', 45, '', 21, 'food'), ...leaves(36)] },
  { id: 'shika_tabi', handle: 'shika_tabi', emoji: '🦌', wing: '#a8c49a', friend: true, fruits: 2, friends: 64, posts: [p('⛩️', 8, '鹿せんべい売り場の前で', 64, 'trip'), ...leaves(40)] },
  { id: 'ookami_night', handle: 'ookami_night', emoji: '🐺', wing: '#9fb1d6', friend: false, fruits: 5, friends: 230, posts: [p('🌌', 240, '星がふってきそう', 86, 'walk'), ...leaves(44)] },
];

export const FLY_HOURS = 88;
