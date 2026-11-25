import type { FigureWings, WorkTags } from '@obolo/shared';
import type { PlayPath } from './config';
import type { TitleMotion, TitleStyle } from './mercury';

/**
 * 木星（handoff docs/handoff/planets-03-jupiter.md; prototype design/home/template.html setupJup / makeBf / popBf / openArt /
 * KKS / TSTYLE / playJ / WG / WB): the numbers and rules of Jupiter's home — the butterflies' wings, the hanging scroll
 * the art opens in, the art's title, ▶ from the porch and the atelier's frames (tested in jupiter.test.ts).
 */

// --- §1 the butterflies: only the wings move (M-R292 追記) ----------------------------------------------------------

/**
 * Where a figure's wings meet its body (percent of the picture's width, left and right). The picture is cut in three:
 * the left wing (0 → L+2), the right wing (R−2 → 100) and the body (L → R) drawn over both, so a flapping wing never
 * covers the face. The prototype's WB table (tuned per character by the story session).
 */
export type WingCut = readonly [left: number, right: number];
export const WING_CUTS: Record<string, WingCut> = {
  user: [20, 72],
  kimorin: [18, 75],
  monban: [22, 76],
  mikie: [17, 73],
  brother: [24, 77],
  sister: [22, 70],
};
/** a figure whose cut could not be measured (the look code measures each member's figure when it is painted: author.wings) */
export const DEFAULT_WING_CUT: WingCut = [18, 76];
/** the wings overlap the body by this much (percent), so no gap shows at the hinge */
export const WING_OVERLAP = 2;

/**
 * the cut for a figure picture: the member's own, measured when it was painted (`wings`, from the feed's author.wings or
 * GET /me figureWings); else the sample's characters by name (fig-jupiter-<name>.webp / chibi4-<name>); else the default
 */
export function wingCutOf(src: string | null | undefined, wings?: FigureWings | null, cuts: Record<string, WingCut> = WING_CUTS): WingCut {
  if (wings && wings.l > 0 && wings.r < 100 && wings.r - wings.l >= 20) return [wings.l, wings.r];
  const m = /(?:fig-jupiter-|chibi4-)([a-z]+)\.webp/.exec(src ?? '');
  return (m && cuts[m[1]]) || DEFAULT_WING_CUT;
}

export interface WingParts {
  left: { clip: string; origin: string };
  right: { clip: string; origin: string };
  body: { clip: string };
}
/** the three cuts as CSS (the prototype's WG): each wing hinges at the body's edge, at 52% of the height */
export function wingParts([L, R]: WingCut): WingParts {
  return {
    left: { clip: `inset(0 ${100 - L - WING_OVERLAP}% 0 0)`, origin: `${L}% 52%` },
    right: { clip: `inset(0 0 0 ${R - WING_OVERLAP}%)`, origin: `${R}% 52%` },
    body: { clip: `inset(0 ${100 - R}% 0 ${L}%)` },
  };
}

/** one wing beat (s, there and back is twice this): 0.26–0.38 s, each butterfly its own (makeBf's --fl) */
export const flapSeconds = (i: number) => Math.round((0.26 + (((i * 7) % 5) + 5) % 5 * 0.03) * 1000) / 1000;
/** a wing folds to this much of its width at the top of the beat (wflap) */
export const WING_FOLD = 0.3;
/** the body only floats a little, up and down (bodybob: 3 px, 0.6 s) */
export const BODY_BOB = { px: 3, s: 0.6 } as const;

// --- §2 the art in a hanging scroll (M-R284〜M-R286, M-R310) --------------------------------------------------------

/** one painted scroll: its picture, the square paper inside it (fractions of the picture: x, y, w, h) and height / width */
export interface Kakejiku {
  src: string;
  box: readonly [x: number, y: number, w: number, h: number];
  ar: number;
}
/** the four scrolls (赤の雲柄・紺の波柄・黒の幾何柄・緑の唐草; the prototype's kakejiku 1–4 with box- / ar-) */
export const KAKEJIKU: readonly Kakejiku[] = [
  { src: '/planets/jupiter/kakejiku-1.webp', box: [0.2107, 0.2103, 0.5692, 0.4671], ar: 1.2179 },
  { src: '/planets/jupiter/kakejiku-2.webp', box: [0.1918, 0.1168, 0.6117, 0.5369], ar: 1.1393 },
  { src: '/planets/jupiter/kakejiku-3.webp', box: [0.1219, 0.1235, 0.7516, 0.6255], ar: 1.2018 },
  { src: '/planets/jupiter/kakejiku-4.webp', box: [0.1504, 0.1076, 0.6946, 0.6346], ar: 1.0946 },
];
/** the art is this much of the screen's width (M-R285) and starts this far down (fraction of the height) */
export const ART_WIDTH = 0.95;
export const ART_TOP = 0.09;

/** the five ways the camera comes in (M-R286): スッと寄る／ギュッと弾む／ブルッと震える／傾きながら寄る／横からビュッ */
export const CAMERAS = ['push', 'slam', 'shake', 'drift', 'whip'] as const;
export type Camera = (typeof CAMERAS)[number];
/** the screen shakes too, this long after it opens (ms) — slam and shake only */
export const SHAKE_AT: Partial<Record<Camera, number>> = { slam: 120, shake: 380 };

/** a random pick (`rnd` in [0, 1)) */
export const pick = <T>(xs: readonly T[], rnd: number): T => xs[Math.min(xs.length - 1, Math.floor(Math.max(0, rnd) * xs.length))];

export interface ScrollLayout {
  /** the scroll's width (px) and its top (px); it is centred across the screen */
  width: number;
  top: number;
  /** the art on the paper (percent of the scroll's picture): square, and ART_WIDTH of the screen wide */
  art: { left: number; top: number; width: number; height: number };
}
/**
 * Where the scroll goes on a W×H screen so its square paper — the art — is ART_WIDTH of the screen wide with its top at
 * ART_TOP of the height (openArt): the scroll is wider than the screen; its rods and edges go off the sides.
 */
export function scrollLayout(k: Kakejiku, W: number, H: number): ScrollLayout {
  const [bx, by, bw, bh] = k.box;
  const width = (ART_WIDTH / bw) * W;
  const sh = width * k.ar;
  const aw = ART_WIDTH * W;
  const top = ART_TOP * H - (by * sh + (bh * sh - aw) / 2);
  return { width, top, art: { left: bx * 100, top: (by + (bh - bw / k.ar) / 2) * 100, width: bw * 100, height: (bw / k.ar) * 100 } };
}

/** the timings (ms): the scroll opens this soon after the tap, unrolling for UNROLL; a second tap closes it (not sooner than CLOSE_AFTER) */
export const SCROLL_MS = {
  /** tap → the scroll starts to open (popBf: 120 ms) */
  open: 120,
  /** the paper unrolls top to bottom */
  unroll: 550,
  /** rolled up again (fast) */
  roll: 220,
  /** the butterfly goes to the bottom left (0.35 s) and its name shows there after */
  toCorner: 350,
  name: 360,
  /** a second tap closes, not the one that opened it */
  closeAfter: 300,
  /** closed: the butterfly flies off to the atelier (your tree) */
  toTree: 500,
} as const;
/** the title's letters come in after the paper (s): the first at this, then one per gap */
export const TITLE_FIRST_S = 0.45;
export const TITLE_GAP_S = 0.07;

/** the butterfly's place while its art is open (fractions of the screen) and its size (popBf / playJ) */
export const BF_CORNER = { x: 0.15, y: 0.93, size: 0.9 } as const;
/** its name, under it */
export const BF_NAME = { x: 0.15, y: 0.955 } as const;

// --- the title: each art its own font and entrance, laid over the art (M-R284 / M-R288) -------------------------------

const T = (font: string, motion: TitleMotion, family = font.replace(/ /g, '+')): TitleStyle => ({ font, family, motion });
/** the prototype's pairs (TSTYLE), by title — the five sample arts */
const BY_TITLE: Record<string, TitleStyle> = {
  夕焼けの町: T('Kaisei Decol', 'brush', 'Kaisei+Decol:wght@700'),
  屋根の上のねこ: T('Hachi Maru Pop', 'pop'),
  ラーメン: T('Dela Gothic One', 'slam'),
  さくら通り: T('Yuji Syuku', 'brush'),
  月と海: T('Shippori Mincho B1', 'float', 'Shippori+Mincho+B1:wght@800'),
};
/**
 * Until each art's own pair is chosen and kept when it is made (03 §2: by AI, later): by the art's style — its main tag,
 * kept when it was made (planet_work_meta, 2-1), so an art keeps its font. The styles are the spell's (artTags).
 */
const BY_STYLE: Record<string, TitleStyle> = {
  アニメ塗り: T('Mochiy Pop One', 'pop'),
  水彩: T('Zen Kurenaido', 'float'),
  ドット絵: T('DotGothic16', 'glitch'),
  油絵: T('Shippori Mincho B1', 'float', 'Shippori+Mincho+B1:wght@800'),
  ゆめかわ: T('Hachi Maru Pop', 'pop'),
  和モダン: T('Yuji Syuku', 'brush'),
  レトロ: T('Kaisei Decol', 'brush', 'Kaisei+Decol:wght@700'),
  ポップ: T('Rampart One', 'glitch'),
  モノクロ: T('Dela Gothic One', 'slam'),
};
const ANY: TitleStyle[] = [BY_TITLE.夕焼けの町, BY_TITLE.屋根の上のねこ, BY_TITLE.ラーメン, BY_TITLE.さくら通り, BY_TITLE.月と海];

export function artTitleStyle(title: string, tags?: WorkTags | null): TitleStyle {
  if (BY_TITLE[title]) return BY_TITLE[title];
  if (tags?.main && BY_STYLE[tags.main]) return BY_STYLE[tags.main];
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return ANY[h % ANY.length];
}

/**
 * the art's title: its own (story 2026-11-25: {bati} proposes one when the art is painted, the member may change it; the
 * feed's work.title), else — a work with none — the first line of its words. Never 「〜のアート」 or a by (M-R310)
 */
export function artTitleOf(w: { title?: string; text?: string }): string {
  const t = (w.title || '').trim();
  if (t) return t;
  return ((w.text || '').split('\n')[0] ?? '').trim().slice(0, 24);
}

/** the prototype's five arts (JART), the sample's art-1 … art-5 */
export const SAMPLE_ARTS = ['夕焼けの町', '屋根の上のねこ', 'ラーメン', 'さくら通り', '月と海'] as const;

// --- §3 ▶ from the porch ------------------------------------------------------------------------------------------

/** your tree on the backdrop (JTREE): you come out of it, and a closed butterfly flies back to it */
export const JTREE = { x: 0.74, y: 0.62 } as const;
/**
 * a butterfly in the play view (playJ): it flies down from the top, stops in front of you, moves to the bottom left as
 * its scroll opens (about 3 s), then flies off to the top right. First one 1.7 s after ▶.
 */
export const PORCH_PATH: PlayPath = {
  from: { x: 0.3, y: 0.18, size: 0.3 },
  sit: { x: 0.3, y: 0.76, size: 1.35 },
  front: { x: 0.15, y: 0.92, size: 0.75 },
  away: { x: 0.9, y: 0.15, size: 0.3 },
  arriveMs: 850,
  leaveMs: 700,
};
export const PORCH_INTRO_MS = 1700;
/** the scroll stays open this long (M-R283: about 3 s), then rolls up and the butterfly goes */
export const PORCH_HOLD_MS = 3050;
/** the fireflies over the porch at night */
export const FIREFLIES = 18;
export const ALL_SEEN = '🌳 今日のアート、全部見たね！';

// --- §4 the atelier: the arts in gold frames on the wall --------------------------------------------------------------

/** each frame hangs a little crooked (deg): −1.5 … +1.5 by its place on the wall (the prototype's pgal) */
export const frameTilt = (j: number) => (((j * 37) % 7) - 3) * 0.5;
