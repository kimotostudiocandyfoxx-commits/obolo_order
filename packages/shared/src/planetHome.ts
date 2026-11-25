import { z } from 'zod';
import { PLANET_FLY_MS, type PlanetWorkKind } from './flying';
import { seesOnlyDachi } from './schemas';
import type { HomePlanet } from './planetHomeConfig';

/**
 * 星のホーム (M-R258, docs/story-rewrite/星のホーム_共通の作り.md; Saturn M-R257 土星_自分のレコード.md): every planet is one
 * screen — your own place in front (your works, kept forever), your dachi's and 推し's works around it for 88 hours, and
 * strangers' works small in the far scenery (never for a viewer under 15, nor one with no birth year yet). One rule set for
 * all five planets; each planet only swaps the art and the motion (apps/web/lib/planetHome/planets.ts).
 *
 * 推し: the people you follow (follows, one way). Your dachi (mutual follows) count by themselves; a stranger seen in the
 * far scenery can be pushed (〔推す〕), and from then on their works come around too. M-R213's 「推しはダチだけ」 is widened.
 */


/** own = gold, dachi = white, oshi = pink; a stranger only in the far scenery */
export type HomeRel = 'own' | 'dachi' | 'oshi' | 'stranger';

export interface HomeWork {
  id: string;
  kind: PlanetWorkKind;
  /** pic: the puni face; chibi: the 2-heads mini figure that jumps out of the popped ball (M-R262; a round face until made) */
  /** M-R275: the maker's chosen kororin picture (1–24; none: not chosen yet) */
  /** client 2026-11-25: figure = the maker's own figure on this planet (Saturn: the chibi out of the ball); ball = their Saturn kororin ball in their own pattern */
  author: { id: string; name: string; pic?: string | null; chibi?: string | null; kororin?: KororinChoice | null; figure?: string | null; ball?: string | null };
  rel: HomeRel;
  /** the words (Saturn: what was blown in, shown while it sings) */
  text: string;
  title?: string;
  /** what plays or opens: a voice, a song, a picture, a film, a show */
  url: string | null;
  thumbUrl?: string | null;
  seconds?: number | null;
  /** when it was flown (its 88 hours start here) */
  flownAt: string;
  /** a scripted / demo item (the story's resident place, seeded works): no 〔推す〕〔外す〕〔通報〕 */
  demo?: boolean;
}

export interface HomeOshi {
  id: string;
  name: string;
  pic?: string | null;
  /** a dachi is in the list by itself and cannot be taken out here */
  dachi: boolean;
}

export interface PlanetHomeView {
  planet: HomePlanet;
  /** the planet's store is wired (Uranus / Pluto / Neptune: not yet, so nothing comes around) */
  live: boolean;
  owner: { id: string; name: string };
  /** under 15 or no birth year: own and dachi only, no far scenery, no 〔推す〕 for strangers */
  young: boolean;
  /** the last time this screen was opened (null the first time): newer works sparkle and fall in */
  lastVisitAt: string | null;
  /** M-R262 (Saturn): the colour chosen for your record (RECORD_COLOURS id; black when unset) */
  recordColour?: string | null;
  /** your works in your place, forever: your order first, then newest first */
  own: HomeWork[];
  /** dachi and 推し, flown in the last 88 hours, newest first */
  around: HomeWork[];
  /** a few strangers for the far scenery (empty for the young) */
  far: HomeWork[];
}

/** M-R262: the record's colours (a screen-blended layer over the record, design/home/saturn-record-mask.png) */
export const RECORD_COLOURS = [
  { id: 'black', name: '黒', color: null },
  { id: 'pink', name: 'ピンク', color: '#ff7ac8' },
  { id: 'lavender', name: 'ラベンダー', color: '#9b7bff' },
  { id: 'mint', name: 'ミント', color: '#3fe0b8' },
  { id: 'gold', name: 'ゴールド', color: '#ffbf40' },
  { id: 'sky', name: '空色', color: '#5cb8ff' },
] as const;
export type RecordColour = (typeof RECORD_COLOURS)[number]['id'];

/**
 * M-R275 (decisions_round20 M-R275): a kororin is one of 24 painted anime balls (design/mv-art/out/kor3-01…24; the
 * face is in the picture, only the club's sunglasses go over it). Each member chooses one (D04-S005c, or later by
 * asking {bati}); a maker who has not chosen gets one from the ball itself (kororinPicOf). The names are the words a
 * member may use for one in the Moon chat (「コロリンをドヤ顔にして」).
 */
export const KORORIN_PICS: { n: number; name: string; words: string[] }[] = [
  { n: 1, name: 'キラキラ目のピンク', words: ['キラキラ目', 'きらきら目'] },
  { n: 2, name: 'ドヤ顔', words: ['ドヤ顔', 'どや顔', 'ドヤ'] },
  { n: 3, name: 'ねむねむ', words: ['ねむねむ', 'ねむい', '眠い', 'ねむそう', 'クリーム'] },
  { n: 4, name: 'にっこにこ', words: ['にっこにこ', '笑ってる', 'わらってる', '大笑い'] },
  { n: 5, name: 'ウインク', words: ['ウインク', 'ウィンク', 'オレンジ'] },
  { n: 6, name: 'にこにこピンク', words: ['にこにこ', 'ピンク'] },
  { n: 7, name: 'よぞら', words: ['よぞら', '夜空', '夜色', '星空', '紺', 'ネイビー'] },
  { n: 8, name: 'しろもち', words: ['しろもち', 'にっこり', '銀', 'シルバー', 'グレー'] },
  { n: 9, name: 'うるうる', words: ['うるうる', '黄色', 'きいろ'] },
  { n: 10, name: 'ぽかんの空色', words: ['空色', 'そら色', '水色', '青', 'ブルー'] },
  { n: 11, name: 'ジト目', words: ['ジト目', 'じと目', 'ジトめ'] },
  { n: 12, name: 'ぷくー', words: ['ぷくー', 'ぷく', 'ふくれ', 'むすっ'] },
  { n: 13, name: 'きんぴか', words: ['きんぴか', '金', 'ゴールド', '星の目'] },
  { n: 14, name: 'しろの青い目', words: ['青い目', 'あおい目', '白', 'しろ', 'ホワイト'] },
  { n: 15, name: '八重歯', words: ['八重歯', 'やえば', '赤', 'あか', 'レッド'] },
  { n: 16, name: 'ちゅっ', words: ['ちゅっ', 'キス', 'ちゅー', 'パステル'] },
  { n: 17, name: 'すごく驚く', words: ['すごく驚く', '驚く', 'おどろく', 'びっくり', 'ミント'] },
  { n: 18, name: 'ガーン', words: ['ガーン', 'がーん', 'ショック'] },
  { n: 19, name: 'ブチギレ', words: ['ブチギレ', 'ぶちぎれ', '怒って', 'おこ'] },
  { n: 20, name: '滝の涙', words: ['滝の涙', '泣いて', 'なみだ', '涙'] },
  { n: 21, name: 'ポカン', words: ['ポカン', 'ぽかん', 'はてな', '紫', 'むらさき', 'ラベンダー'] },
  { n: 22, name: '点の目のしろ', words: ['点の目', 'てんの目', 'ω'] },
  { n: 23, name: '点の目のベージュ', words: ['ベージュ', 'きなこ', '茶', 'ちゃいろ'] },
  { n: 24, name: '点の目のさくら', words: ['さくら', '桜', 'うすピンク'] },
];
export const KORORIN_PIC_COUNT = KORORIN_PICS.length;
export interface KororinChoice {
  /** 1–24 */
  pic: number;
}
export const isKororinPic = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= KORORIN_PIC_COUNT;
/** someone's chosen kororin (null: not chosen yet) */
export function kororinOf(c?: { pic?: number | string | null } | null): KororinChoice | null {
  const n = typeof c?.pic === 'string' ? Number(c.pic.replace(/^k/, '')) : c?.pic;
  return isKororinPic(n) ? { pic: n } : null;
}
/**
 * the picture a ball shows: its maker's chosen one; else, from the ball's own number and the maker's name, as the
 * prototype does ((i×5 + the name's length×3) mod 24) — the same every time for the same ball
 */
export function kororinPicOf(chosen: { pic?: number | string | null } | null | undefined, i: number, name: string): number {
  return kororinOf(chosen)?.pic ?? ((((i * 5 + [...name].length * 3) % KORORIN_PIC_COUNT) + KORORIN_PIC_COUNT) % KORORIN_PIC_COUNT) + 1;
}
/** the choice id {bati} and the API use for a picture ('k01'…'k24') */
export const kororinPicId = (n: number) => `k${String(n).padStart(2, '0')}`;
export const PlanetHomeColourBody = z.object({ colour: z.enum(['black', 'pink', 'lavender', 'mint', 'gold', 'sky']) });
export type PlanetHomeColourBody = z.infer<typeof PlanetHomeColourBody>;

export const PlanetHomeOrderBody = z.object({ ids: z.array(z.string().uuid()).max(500) });
export type PlanetHomeOrderBody = z.infer<typeof PlanetHomeOrderBody>;

/** how many strangers the far scenery holds at once */
export const HOME_FAR_MAX = 6;
/** how many new arrivals fall one by one when the screen opens; the rest fall together as one 「＋」 */
export const HOME_DROP_MAX = 5;

type When = string | number | Date;
const ms = (t: When) => (t instanceof Date ? t.getTime() : typeof t === 'number' ? t : Date.parse(t));

/** a candidate work with what the server knows about its maker */
export interface HomeCandidate {
  id: string;
  authorId: string;
  flownAt: When;
  /** the maker is the viewer's dachi (mutual follow) */
  dachi: boolean;
  /** the viewer follows the maker (推し) */
  oshi: boolean;
  /** the maker is under 15 / has no birth year (never shown to strangers) */
  authorYoung?: boolean;
  hidden?: boolean;
}

/**
 * The feed rules, in one place (the SQL in apps/api/src/planets/planet-home.service.ts does the same; tests pin both):
 *  - own works: always, however old
 *  - dachi / 推し: only within 88 hours of being flown, never hidden; a young viewer gets dachi only
 *  - strangers: only for a viewer who is not young, not a young maker, within 88 hours, never hidden — far scenery only
 */
export function homeRelOf(viewerId: string, c: HomeCandidate, viewerYoung: boolean, now: When = Date.now()): HomeRel | null {
  if (c.authorId === viewerId) return 'own';
  if (c.hidden) return null;
  if (ms(c.flownAt) <= ms(now) - PLANET_FLY_MS) return null;
  if (c.dachi) return 'dachi';
  if (viewerYoung) return null;
  if (c.authorYoung) return null;
  return c.oshi ? 'oshi' : 'stranger';
}

/** split candidates into the three parts of the screen (input newest first; order kept) */
export function splitHome<T extends HomeCandidate>(viewerId: string, items: readonly T[], viewerBirthYear: number | null | undefined, now: When = Date.now()) {
  const young = seesOnlyDachi(viewerBirthYear, now instanceof Date ? now : new Date(ms(now)));
  const own: T[] = [];
  const around: T[] = [];
  const far: T[] = [];
  for (const c of items) {
    const r = homeRelOf(viewerId, c, young, now);
    if (r === 'own') own.push(c);
    else if (r === 'dachi' || r === 'oshi') around.push(c);
    else if (r === 'stranger' && far.length < HOME_FAR_MAX) far.push(c);
  }
  return { young, own, around, far };
}

/** your order first (ids you placed), the rest newest first after them; ids no longer there are dropped */
export function orderOwn<T extends { id: string; flownAt: When }>(items: readonly T[], order: readonly string[] | null | undefined): T[] {
  const byNew = [...items].sort((a, b) => ms(b.flownAt) - ms(a.flownAt));
  if (!order?.length) return byNew;
  const pos = new Map(order.map((id, i) => [id, i]));
  const placed = byNew.filter((x) => pos.has(x.id)).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
  // a work flown after you last arranged comes first (newest first), then your arrangement
  return [...byNew.filter((x) => !pos.has(x.id)), ...placed];
}

/** arrived since the last visit (sparkles; never counted on screen) */
export const isNewSince = (flownAt: When, lastVisitAt: When | null | undefined) => lastVisitAt == null || ms(flownAt) > ms(lastVisitAt);

/** what falls when the screen opens: up to HOME_DROP_MAX one by one, the rest as one 「＋」 */
export function dropPlan<T>(fresh: readonly T[], max = HOME_DROP_MAX): { drops: T[]; plus: T[] } {
  return { drops: fresh.slice(0, max), plus: fresh.slice(max) };
}

/** whole hours before a dachi's / 推し's work goes back to its maker (0 = leaving) */
export const homeHoursLeft = (flownAt: When, now: When = Date.now()) => Math.max(0, Math.ceil((ms(flownAt) + PLANET_FLY_MS - ms(now)) / 3600_000));
