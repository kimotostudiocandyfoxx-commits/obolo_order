import { z } from 'zod';
import type { BookView, GameView } from './craft';
import { HOME_PLANETS } from './planetHomeConfig';

/**
 * Client 2026-11-28 (docs/planets.md 09, 「物語で作った本とゲームを本物に」): the first book (day 8, Pluto) and the first
 * game (day 9, Neptune) made inside the first journey become REAL works of the member — a `books` / `games` row that flies
 * from the Moon to its planet like any Moon-made work (one work = one post, 88 hours, the homecoming report). Free for the
 * member: what writing them costs is the operator's (the absorbed usage feature 'storyFirst', manaPrice.ts). Once per
 * member per kind, and only on the journey day it belongs to (the server checks both: story_first_works, users.journey_day).
 */
export const STORY_FIRST_KINDS = ['book', 'game'] as const;
export type StoryFirstKind = (typeof STORY_FIRST_KINDS)[number];
/** the day of the first journey each belongs to (M-R341: 8 Pluto, 9 Neptune) */
export const STORY_FIRST_DAY: Readonly<Record<StoryFirstKind, number>> = { book: 8, game: 9 };

const Cards = z.array(z.string().trim().min(1).max(24)).min(1).max(8);

/** POST /moon/story-first/book: the story's spell cards (what was said, made into cards) → the short story, kept as a real book */
export const StoryFirstBookBody = z.object({ cards: Cards, said: z.string().trim().max(400).optional() });
export type StoryFirstBookBody = z.infer<typeof StoryFirstBookBody>;
/** POST /moon/story-first/game: the story's game (its cards and the title it was given) → a real game from the catch template */
export const StoryFirstGameBody = z.object({ cards: Cards, title: z.string().trim().max(20).optional(), said: z.string().trim().max(400).optional() });
export type StoryFirstGameBody = z.infer<typeof StoryFirstGameBody>;

export interface StoryFirstBookView {
  book: BookView;
  /** the short story's pages as the story shows them (the book's one chapter is these, one paragraph each) */
  pages: { text: string; scene: string }[];
  /** made on an earlier play: the same book again (nothing new was written) */
  again: boolean;
}
export interface StoryFirstGameView {
  game: GameView;
  again: boolean;
}

// --- the residents as oshi (client 2026-11-28) ---------------------------------------------------------------------

/**
 * The homes' residents (the cast who are oshi: the seven Sushimon and the eleven residents of the planets — apps/web
 * lib/planetTemplate/roster.ts). They are the app's own characters, not accounts: every one in the member's roster
 * starts as oshi (♡ on). What the member changes is kept per member (cast_choices): the residents they took the ♡ from
 * and the residents' works they ☆-saved to Bluena. KIMORIN⭐︎ / MIKIE⭐︎DRILL are ダチ, not oshi: not here.
 */
export const CAST_OSHI_KEYS = ['sapon', 'gari', 'ebi', 'uni', 'ika', 'shari', 'kani', 'brother', 'sister', 'kaiser', 'freezy', 'hipokin', 'bossg', 'longg', 'hatg', 'croco', 'onimonk', 'monban'] as const;
export type CastOshiKey = (typeof CAST_OSHI_KEYS)[number];
export const isCastOshiKey = (k: unknown): k is CastOshiKey => typeof k === 'string' && (CAST_OSHI_KEYS as readonly string[]).includes(k);
/** every cast member with works (the oshi and the two ダチ): whose work may be ☆-saved */
export const CAST_WORK_KEYS: readonly string[] = [...CAST_OSHI_KEYS, 'kimorin', 'mikie'];
/** a cast work's id on a home: cast-<key>-<planet> (lib/planetTemplate/castWorks.ts castWorkId) */
export const isCastWorkId = (id: unknown): id is string => {
  const m = typeof id === 'string' ? /^cast-([a-z]+)-([a-z]+)$/.exec(id) : null;
  return !!m && CAST_WORK_KEYS.includes(m[1]) && (HOME_PLANETS as readonly string[]).includes(m[2]);
};

export interface CastChoicesView {
  /** residents the member took the ♡ from (they no longer come to the member's homes) */
  unoshi: CastOshiKey[];
  /** the residents' works ☆-saved to Bluena, newest first */
  saved: { id: string; savedAt: string }[];
}
/** PUT /me/cast/oshi: ♡ on / off for one resident */
export const CastOshiBody = z.object({ key: z.enum(CAST_OSHI_KEYS), on: z.boolean() });
export type CastOshiBody = z.infer<typeof CastOshiBody>;
/** PUT /me/cast/save: ☆ one cast work into Bluena / out of it */
export const CastSaveBody = z.object({ id: z.string().max(40).refine(isCastWorkId, 'not a cast work'), on: z.boolean() });
export type CastSaveBody = z.infer<typeof CastSaveBody>;
