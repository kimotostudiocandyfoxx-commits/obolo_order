import { z } from 'zod';

/** a query-string flag: '1' / 'true' (anything else, or nothing, is off) */
const Flag = z.preprocess((v) => v === true || v === '1' || v === 'true', z.boolean()).optional();

/**
 * Bluena and findability (client decisions M-R236 / M-R237, docs/story-rewrite/Bluenaと探しやすさ.md):
 *  - ★ (お気に入り): on a work card, a talk bubble, a コロリン in the ring. Each tap: ★ → ★★ → ★★★ → none.
 *  - しるし ♠♦♥♣: one per item (to keep work / private apart), set from a small ring opened by a long press; the four
 *    names are the member's own (set from the gear at Bluena's top right; empty = no name).
 *  - Bluena's works and a thread's past talks are a spiral (a time map) and a list, with a filter strip (★ and the
 *    marks in use, the planets) and a small search box (title, lyrics, words).
 * Kept per member (item_marks / users.mark_names_json): only the member sees their own ★ and marks.
 */
export const ITEM_MARKS = ['spade', 'diamond', 'heart', 'club'] as const;
export type ItemMarkId = (typeof ITEM_MARKS)[number];
export const MARK_GLYPH: Record<ItemMarkId, string> = { spade: '♠', diamond: '♦', heart: '♥', club: '♣' };
export const MAX_STARS = 3;

/**
 * What can carry a ★ / mark. Works: the planets' own stores (Saturn post, Jupiter root, saved song, Mars backstage,
 * radio show); utterances: buddy_messages, dachi_messages; `local` = something kept on the device only (the atelier's
 * looks / pictures / its {bati} talk, the demo's songs) — its id is the device's own.
 */
export const MARKED_KINDS = ['saturn_post', 'jupiter_root', 'song', 'mars_backstage', 'radio_show', 'buddy_message', 'dachi_message', 'local', 'book', 'game'] as const;
export type MarkedKind = (typeof MARKED_KINDS)[number];

export interface ItemMarkView {
  kind: MarkedKind;
  id: string;
  stars: number;
  mark: ItemMarkId | null;
}
export type MarkNames = Partial<Record<ItemMarkId, string>>;
export interface ItemMarksView {
  marks: ItemMarkView[];
  names: MarkNames;
}

export const SetItemMarkBody = z.object({
  kind: z.enum(MARKED_KINDS),
  id: z.string().min(1).max(120),
  stars: z.number().int().min(0).max(MAX_STARS),
  mark: z.enum(ITEM_MARKS).nullable(),
});
export type SetItemMarkBody = z.infer<typeof SetItemMarkBody>;

const MarkName = z.string().trim().max(12).optional();
export const MarkNamesBody = z.object({ spade: MarkName, diamond: MarkName, heart: MarkName, club: MarkName });
export type MarkNamesBody = z.infer<typeof MarkNamesBody>;

/** one tap on the ★: ★ → ★★ → ★★★ → none */
export const nextStars = (n: number) => (Math.max(0, Math.min(MAX_STARS, n | 0)) + 1) % (MAX_STARS + 1);

/** Bluena's eight planets, in the orbit's order (M-R237 §2), and what each keeps */
export const BLUENA_PLANETS = ['saturn', 'jupiter', 'mercury', 'mars', 'venus', 'uranus', 'pluto', 'neptune'] as const;
export type BluenaPlanet = (typeof BLUENA_PLANETS)[number];

/**
 * Client 2026-11-25: the one map of each Moon-made kind to its home planet (works later fly to / are linked with it once
 * each planet's screen is settled). kororin ('voice') → Saturn, picture → Jupiter, song → Mercury, MV → Mars,
 * radio → Venus, goods → Uranus, book ('novel' / 'book') → Pluto, game → Neptune. Bluena's folders, the atelier's
 * 〔星へ飛ばす〕 and the works' records read it from here. Only the kinds in FLY_READY_KINDS can be flown today.
 */
export const KIND_HOME_PLANET = { voice: 'saturn', art: 'jupiter', song: 'mercury', video: 'mars', radio: 'venus', goods: 'uranus', novel: 'pluto', book: 'pluto', game: 'neptune' } as const satisfies Record<string, BluenaPlanet>;
export type HomedKind = keyof typeof KIND_HOME_PLANET;
export const homePlanetOf = (kind: string): BluenaPlanet | null => (KIND_HOME_PLANET as Record<string, BluenaPlanet>)[kind] ?? null;
/** the kinds whose planet has its screen and its 〔星へ飛ばす〕 now (the others keep their home planet as data only) */
export const FLY_READY_KINDS = ['voice', 'art', 'song', 'video', 'radio'] as const;
export const canFlyHome = (kind: string): boolean => (FLY_READY_KINDS as readonly string[]).includes(kind);

/** a work as Bluena's list shows it (newest first) */
export interface FoundWork {
  kind: MarkedKind;
  id: string;
  planet: BluenaPlanet;
  title: string;
  image?: string | null;
  audio?: string | null;
  video?: string | null;
  createdAt: string;
  /** on its planet already (flown / public) */
  flown?: boolean;
  stars: number;
  mark: ItemMarkId | null;
  /** M-R253: the Moon atelier's work this is the face of (its other tries are inside it, not listed) */
  atelierId?: string;
  versionCount?: number;
  /** M-R253 §5: the talk it was made in (a tap jumps there) */
  origin?: { thread: string; talkId?: string; msgId?: string; day?: string; at: string } | null;
}

/** the filter strip and the search box (★ = any number of stars) */
export const FindWorksQuery = z.object({
  planet: z.enum(BLUENA_PLANETS).optional(),
  star: Flag,
  mark: z.enum(ITEM_MARKS).optional(),
  q: z.string().trim().max(60).optional(),
});
export type FindWorksQuery = z.infer<typeof FindWorksQuery>;

/** one day of a thread's past talk (list row: the date, the day's first words, ★, mark) */
export interface TalkDayView {
  /** YYYY-MM-DD (Japan time on the server; the device's own day in the demo) */
  day: string;
  first: string;
  count: number;
  /** who spoke that day, the most first ('me' = you) */
  speakers: string[];
  /** the most stars any line of that day has */
  stars: number;
  /** the mark the day's lines carry the most */
  mark: ItemMarkId | null;
}
export const FindTalksQuery = z.object({
  /** 'bati' (buddy_messages) or a ダチ thread id (a dachi's user id, 'kimorin', 'mikie') */
  thread: z.string().min(1).max(64),
  star: Flag,
  mark: z.enum(ITEM_MARKS).optional(),
  q: z.string().trim().max(60).optional(),
});
export type FindTalksQuery = z.infer<typeof FindTalksQuery>;

/** what a filter asks of one item */
export function matchesFind(it: { stars: number; mark: ItemMarkId | null }, f: { star?: boolean; mark?: ItemMarkId }): boolean {
  if (f.star && !(it.stars > 0)) return false;
  if (f.mark && it.mark !== f.mark) return false;
  return true;
}

/**
 * M-R236 §4: {bati} tells this once, the first time the member has five works.
 * Rendered in the {bati}'s manner (BATI_VARIANTS has every style).
 */
export const STAR_TIP_LINE = '気に入ったのには、★をつけておくと、あとで見つけやすいよ！　長押しすると、しるしもつけられるよ！';
export const STAR_TIP_AT = 5;
/** me.story key: the tip was said (sys.*) */
export const STAR_TIP_KEY = 'star_tip';

/** a line of a talk, for talkDays */
export interface TalkLine {
  id: string;
  /** ISO time */
  at: string;
  /** who said it ('me' = you) */
  who: string;
  text: string;
}

/** the day a moment falls on, in Japan time (the server's days; the demo passes the device's own) */
export const jstDay = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);

/**
 * A thread's past talk as days, newest first (M-R237 §3): a day's first words, who spoke, its most ★ and its mark.
 * A filter keeps the days that have a matching line; `q` looks in the words.
 */
export function talkDays(lines: TalkLine[], markOf: (id: string) => { stars: number; mark: ItemMarkId | null } | undefined, f: { star?: boolean; mark?: ItemMarkId; q?: string } = {}, dayOf: (iso: string) => string = jstDay): TalkDayView[] {
  const by = new Map<string, TalkLine[]>();
  for (const l of [...lines].sort((a, b) => a.at.localeCompare(b.at))) {
    const d = dayOf(l.at);
    by.set(d, [...(by.get(d) ?? []), l]);
  }
  const q = f.q?.trim().toLowerCase();
  const out: TalkDayView[] = [];
  for (const [day, ls] of by) {
    const ms = ls.map((l) => ({ l, m: markOf(l.id) ?? { stars: 0, mark: null } }));
    if ((f.star || f.mark) && !ms.some(({ m }) => matchesFind(m, f))) continue;
    if (q && !ls.some((l) => l.text.toLowerCase().includes(q))) continue;
    const count = new Map<string, number>();
    for (const l of ls) count.set(l.who, (count.get(l.who) ?? 0) + 1);
    const marks = new Map<ItemMarkId, number>();
    for (const { m } of ms) if (m.mark) marks.set(m.mark, (marks.get(m.mark) ?? 0) + 1);
    const first = ls.find((l) => l.text.trim())?.text.trim() ?? '';
    out.push({
      day,
      first: [...first].slice(0, 40).join(''),
      count: ls.length,
      speakers: [...count.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w),
      stars: Math.max(0, ...ms.map(({ m }) => m.stars)),
      mark: [...marks.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    });
  }
  return out.sort((a, b) => b.day.localeCompare(a.day));
}
