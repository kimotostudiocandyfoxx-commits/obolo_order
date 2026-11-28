import { GOODS_KINDS, isGoodsKind, type GoodsKind, type HomePlanet, type HomeWork, type WorkTags } from '@obolo/shared';
import type { TitleStyle } from './mercury';

/**
 * 05 火星・金星・天王星・冥王星・海王星 (handoff docs/handoff/planets-05-five.md, M-R293; prototype design/home/template.html
 * G5 / setupG5 / makeG5 / popG5 / viewer / playG5): the five planets are the common template as it is — the rows, the
 * drag, ▶ and the profile's skeleton. Only the vehicle (each person's figure on the planet), how a work opens (the
 * viewer) and the profile's middle (the shelf) are their own. The numbers and rules here (five.test.ts).
 */
// in the order they are visited (M-R341)
export const FIVE_PLANETS = ['mars', 'venus', 'pluto', 'neptune', 'uranus'] as const;
export type FivePlanet = (typeof FIVE_PLANETS)[number];
export const isFivePlanet = (p: HomePlanet): p is FivePlanet => (FIVE_PLANETS as readonly string[]).includes(p);

/** what a work is on each planet (the prototype's G5[pl].t) */
export type FiveKind = 'mv' | 'radio' | 'goods' | 'book' | 'game';

export interface FivePlanetDef {
  kind: FiveKind;
  /** what your place is (its label for the screen reader) */
  placeName: string;
  /** where the viewer opens, from the top of the screen (the prototype's v.style.top) */
  top: number;
  /** the prototype's five sample works (G5[pl].titles) */
  titles: readonly string[];
  /** the planet's neon colour on its viewer (the prototype's G5[pl].c) */
  glow: string;
}

/** handoff 05's table: Mars MV in the theatre, Venus radio in a small booth, Uranus goods in the shop, Pluto stories in the library, Neptune games in the bubble dome */
export const FIVE: Record<FivePlanet, FivePlanetDef> = {
  mars: { kind: 'mv', placeName: 'シアター', top: 0.12, titles: ['ネオンの夜', '走れ', 'パーティー', '夜のバラード', 'はじまりの歌'], glow: '#ff5fd2' },
  venus: { kind: 'radio', placeName: 'ブース', top: 0.14, titles: ['深夜のひとりごと', 'ラーメン報告', 'ねこラジオ', '夏の作戦会議', '月夜の雑談'], glow: '#ffb36b' },
  uranus: { kind: 'goods', placeName: 'お店', top: 0.16, titles: ['夕焼けトート', 'ねこTシャツ', 'ラーメンステッカー', 'さくらアクスタ', '月夜マグカップ', '星の缶バッジ'], glow: '#4fe0ff' },
  pluto: { kind: 'book', placeName: '図書館', top: 0.22, titles: ['夕焼けの町の約束', '屋根の上のねこ', 'ラーメンと魔法', 'さくら通りの手紙', '月と海の物語'], glow: '#b48cff' },
  neptune: { kind: 'game', placeName: 'ゲーム小屋', top: 0.12, titles: ['ネオンランナー', 'ねこジャンプ', 'ラーメンパズル', 'さくらレース', 'ムーンダイブ'], glow: '#ff4fd8' },
};

/** a figure tapped on the home: it goes to the bottom left while its work is open, its name just under it (popG5) */
export const WHO_CORNER = { x: 0.15, y: 0.92, size: 0.85 } as const;
export const WHO_NAME = { x: 0.15, y: 0.955 } as const;
/** popG5's times: the figure to the corner (ms), its name after, a tap closes only after a moment, back to your place */
export const OPEN_MS = { corner: 350, name: 360, closeAfter: 300, viewerOut: 300, toPlace: 500 } as const;
/** a show's voice starts a moment after the viewer (the prototype's 500 ms) */
export const RADIO_VOICE_MS = 500;
/** ▶: one work stays this long (05: 5〜7 s; the prototype's 5.2 s); Mars: the whole MV (untilDone) */
export const FIVE_HOLD_MS = 5200;
/** said when ▶ has shown every work (playG5) */
export const ALL_SEEN_FIVE = '✨ 今日の作品、全部見たね！';

/** the radio's wave: 15 bars, their heights and delays (the prototype's .wave b) */
export const waveBars = (n = 15) => Array.from({ length: n }, (_, i) => ({ h: 10 + ((i * 7) % 5) * 6, delay: (i % 5) * 0.08 }));

/** the profile's shelf: each kind's frame shape (the prototype's .pgal .fr.t-*) */
export const SHELF_ASPECT: Record<FiveKind, number> = { mv: 0.72, radio: 1.55, goods: 1, book: 0.72, game: 0.72 };

// --- the title: each work its own font (05 共通: 題名は作品ごとの字体 TSTYLE) ---------------------------------------------

const T = (font: string, motion: TitleStyle['motion'], family = font.replace(/ /g, '+')): TitleStyle => ({ font, family, motion });
const MINCHO = T('Shippori Mincho B1', 'float', 'Shippori+Mincho+B1:wght@800');
/** the prototype's TSTYLE, by title (the sample works that have one) */
const BY_TITLE: Record<string, TitleStyle> = { パーティー: T('Rampart One', 'glitch'), 夜のバラード: MINCHO, 走れ: T('Reggae One', 'slam') };
/** by the work's main tag (handoff 05's tags, planet_work_meta.main): an MV by its song's genre, a show by its topic … */
const BY_MAIN: Record<string, TitleStyle> = {
  EDM: T('Rampart One', 'glitch'),
  ロック: T('Reggae One', 'slam'),
  ヒップホップ: T('Dela Gothic One', 'slam'),
  バラード: MINCHO,
  ジャズ: MINCHO,
  ローファイ: T('Zen Kurenaido', 'float'),
  'J-POP': T('Mochiy Pop One', 'pop'),
  アニソン: T('Hachi Maru Pop', 'pop'),
  シティポップ: T('Kaisei Decol', 'brush', 'Kaisei+Decol:wght@700'),
  恋バナ: T('Hachi Maru Pop', 'pop'),
  お笑い: T('Mochiy Pop One', 'pop'),
  夜: T('Zen Kurenaido', 'float'),
  ファンタジー: T('Kaisei Decol', 'brush', 'Kaisei+Decol:wght@700'),
  恋愛: T('Hachi Maru Pop', 'pop'),
  ホラー: T('Yuji Syuku', 'brush'),
  ミステリー: MINCHO,
  SF: T('DotGothic16', 'glitch'),
  日常: T('Zen Kurenaido', 'float'),
  アクション: T('Dela Gothic One', 'slam'),
  パズル: T('Rampart One', 'pop'),
  レース: T('Reggae One', 'slam'),
  リズム: T('Rampart One', 'glitch'),
  シューティング: T('DotGothic16', 'glitch'),
  クイズ: T('Mochiy Pop One', 'pop'),
};
/** the prototype's own default for the five (Dela Gothic One) */
export const FIVE_TITLE_DEFAULT = T('Dela Gothic One', 'pop');
/** a game's title is always in pixels-and-neon (a case on a shelf); the others by title, then by their main tag */
export function fiveTitleStyle(kind: FiveKind, title: string, tags?: WorkTags | null): TitleStyle {
  if (BY_TITLE[title]) return BY_TITLE[title];
  if (tags?.main && BY_MAIN[tags.main]) return BY_MAIN[tags.main];
  return kind === 'game' ? T('DotGothic16', 'glitch') : FIVE_TITLE_DEFAULT;
}

/** the work's title (never 「〜のアート」 or a by, M-R310): its own, else the first line of its words */
export function fiveTitleOf(w: Pick<HomeWork, 'title' | 'text'>): string {
  const t = (w.title || '').trim();
  if (t) return t;
  return ((w.text || '').split('\n')[0] ?? '').trim().slice(0, 24);
}

// --- each kind's viewer -------------------------------------------------------------------------------------------

/**
 * story 2026-11-25 Uranus: which mock-up a goods item is drawn on — its kind (the home's words carry it), else its main
 * tag (goodsTags), else a tote
 */
export function goodsKindOfWork(w: Pick<HomeWork, 'text' | 'tags'>): GoodsKind {
  const t = (w.text ?? '').trim();
  if (isGoodsKind(t)) return t;
  const m = w.tags?.main ?? '';
  return isGoodsKind(m) ? m : 'トート';
}
/** the sample's goods: one of each kind, by the sample title it carries (FIVE.uranus.titles, in GOODS_KINDS' order) */
export const SAMPLE_GOODS_KINDS: readonly GoodsKind[] = ['トート', 'Tシャツ', 'ステッカー', 'アクスタ', 'マグカップ', '缶バッジ'];
export const sampleGoodsKind = (i: number) => SAMPLE_GOODS_KINDS[i % SAMPLE_GOODS_KINDS.length] ?? GOODS_KINDS[0];

/** a Mars work is an MV (a film); the sample plays a song over its picture (the prototype's playSong) */
export const isAudioUrl = (u: string | null | undefined) => /\.(mp3|m4a|aac|wav|ogg|opus)(\?|#|$)/i.test(u ?? '');

/** Pluto's open book: the right page — the opening of its first chapter, in at most two short paragraphs */
export function bookOpening(text: string | null | undefined, max = 120): string[] {
  const t = (text ?? '').replace(/\r/g, '').trim();
  if (!t) return [];
  const paras = t
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  let left = max;
  for (const p of paras) {
    if (left <= 0 || out.length >= 2) break;
    const cut = p.length > left ? `${p.slice(0, left)}…` : p;
    out.push(cut);
    left -= p.length;
  }
  return out;
}
/** the prototype's opening for a sample book (`name`: whose it is) */
export const sampleOpening = (name: string) => `むかしむかし、${name}が見つけたのは、だれも知らない小さな光だった。\nその光は、夜になるとそっと歌いだす。`;

/** Neptune: a game has no painted cover — its case gets a neon face of its own (two hues from its id, its first letter) */
export function caseFace(id: string, title: string): { a: string; b: string; glyph: string } {
  let h = 0;
  for (const ch of id) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return { a: `hsl(${hue} 90% 55%)`, b: `hsl(${(hue + 140) % 360} 85% 30%)`, glyph: [...(title || '?')][0] };
}

/** the sample's work picture (popG5's ai: the prototype's jart-1 … 5) for the i-th person */
export const sampleArtIndex = (i: number, name: string) => ((i * 2 + [...name].length) % 5) + 1;

// --- a long title (story 2026-11-28) -----------------------------------------------------------------------------

/** the title's letter size on a screen `w` px wide (the CSS: clamp(22px, 7vw, 30px)) and the room it has (90% of the screen) */
export const titleBase = (w: number) => Math.max(22, Math.min(30, w * 0.07));
export const TITLE_ROOM = 0.9;
export const TITLE_MIN_PX = 13;
/**
 * A title too long for one line wraps to two; one too long for two lines gets smaller letters until two lines hold it
 * (never cut, never off the screen). `size` null: the CSS's own size. A letter is counted a full square wide (kanji are
 * drawn a little bigger, kana smaller: the square is the safe side).
 */
export function titleFit(title: string, screenW: number): { lines: 1 | 2; size: number | null } {
  const n = [...title].length;
  const base = titleBase(screenW);
  const room = screenW * TITLE_ROOM;
  if (n * base <= room) return { lines: 1, size: null };
  const perLine = Math.ceil(n / 2);
  if (perLine * base <= room) return { lines: 2, size: null };
  return { lines: 2, size: Math.max(TITLE_MIN_PX, Math.floor((room / perLine) * 10) / 10) };
}
