import { batiKindOpensLine, JOURNEY_DONE, type BatiPersonality } from '@obolo/shared';

/**
 * What the Moon atelier (〔月で作る〕, one Bati chat — M-R210) can do today. On the first journey each day opens more:
 *   2 your look (プロフィールの姿) · {bati}'s dress-up / 変身 · lookups (調べもの) · showing pictures ·
 *   3 コロリン · 4 アート · 5 曲 · 6 映像 (MV) · 7 金星のラジオ (a recorded show).
 * After the journey (journeyDay ≥ JOURNEY_DONE) everything is open. A member who joined early is on the same day
 * schedule (only journeyDay counts). Client 2026-11-25: 本 (novel) and ゲーム open after the journey (JOURNEY_DONE),
 * with the members' later planets they belong to (Pluto, Neptune); グッズ is not made here yet.
 */
export const UNLOCK_DAY = {
  look: 2,
  bati: 2,
  lookup: 2,
  image: 2,
  voice: 3,
  art: 4,
  song: 5,
  video: 6,
  radio: 7,
  novel: JOURNEY_DONE,
  game: JOURNEY_DONE,
} as const;

export type AtelierKind = keyof typeof UNLOCK_DAY;
export const KINDS = Object.keys(UNLOCK_DAY) as AtelierKind[];

const done = (day: number | null | undefined) => day == null || day >= JOURNEY_DONE;

export function isOpen(kind: AtelierKind, day: number | null | undefined): boolean {
  return done(day) || day! >= UNLOCK_DAY[kind];
}

/** the kinds open today, in the order they open */
export function openKinds(day: number | null | undefined): AtelierKind[] {
  return KINDS.filter((k) => isOpen(k, day));
}

/** how many days until a kind opens (0 = open) */
export function daysUntil(kind: AtelierKind, day: number | null | undefined): number {
  return done(day) ? 0 : Math.max(0, UNLOCK_DAY[kind] - day!);
}

/** R12: how a kind not open yet is named in {bati}'s line (「絵は、4日目から作れるようになるよ」) */
export const LOCK_WORD: Record<AtelierKind, string> = {
  look: '姿を変えるの',
  bati: '着せかえ',
  lookup: '調べもの',
  image: '絵を見るの',
  voice: 'コロリン',
  art: '絵',
  song: '曲',
  video: '映像',
  radio: 'ラジオ',
  novel: '本',
  game: 'ゲーム',
};

/**
 * {bati}'s line when a kind not open yet is asked for (M-R210). R12 (client): it names the kind and the day it opens
 * (「絵は、4日目から作れるようになるよ。」; a kind of after the journey: 「本は、旅が終わったら…」), in {bati}'s manner.
 * PLACEHOLDER (P-ATELIER-3): provisional until the story script lands.
 */
export function lockLine(kind: AtelierKind, day: number | null | undefined, personality: BatiPersonality = 'genki'): string {
  const open = UNLOCK_DAY[kind];
  return batiKindOpensLine(personality, LOCK_WORD[kind], open >= JOURNEY_DONE ? 'after' : open);
}

/**
 * What OBOLON teaches on the first open after something unlocks: the day-2 basics come as one lesson, every later kind
 * as its own. Returns the lessons open today, oldest first.
 */
export type Lesson = 'basics' | 'voice' | 'art' | 'song' | 'video' | 'radio';
export const LESSON_DAY: Record<Lesson, number> = { basics: 2, voice: 3, art: 4, song: 5, video: 6, radio: 7 };
export function openLessons(day: number | null | undefined): Lesson[] {
  // after the journey nothing new unlocks here: no lessons for people who arrive later with everything open
  if (done(day)) return [];
  return (Object.keys(LESSON_DAY) as Lesson[]).filter((l) => day! >= LESSON_DAY[l]);
}
