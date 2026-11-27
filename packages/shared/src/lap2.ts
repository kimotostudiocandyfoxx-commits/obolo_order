import { z } from 'zod';
import { JOURNEY_EIGHT_KEY, JOURNEY_WAIT_MS } from './journey';

/**
 * After becoming Obolo Order (simple version, M-R198; script part P05m): the three locked planets on the back of the
 * ticket open one a day — 天王星 (goods, M-URANUS-S001/S002), 冥王星 (stories, M-PLUTO-S001/S002), 海王星 (games,
 * M-NEPTUNE-S001/S002, then the end M-END-S001 the same day). After that, no more story constraints.
 * This replaces the old "second journey" (9 chapters); the progress key and the endpoint stay: `story['l2.done']`
 * on Me (days finished, 0–3) and POST /me/lap2/complete. `story['l2.at']` is when the last day was finished (ISO,
 * written by the server); the next day opens LAP2_WAIT_MS after it (no skipping, M-R199).
 *
 * M-R341 (2026-11-27): the three planets are days 8–10 of the FIRST journey now (Pluto, Neptune, Uranus — before
 * becoming Obolo Order). These days after joining stay only for the accounts of the eight-day journey
 * (`story[JOURNEY_EIGHT_KEY]`, migration 0064): they never visited the three planets on the first journey, and play
 * the days as they were (the words of before, lib/onboarding/after.ts). Everyone else has none (lap2Done = all).
 */
export const LAP2 = [
  { id: 'uranus', planet: 'uranus' },
  { id: 'pluto', planet: 'pluto' },
  { id: 'neptune', planet: 'neptune' },
] as const;
export type Lap2Chapter = (typeof LAP2)[number]['id'];
export const LAP2_DONE = LAP2.length;
/** the next day opens this long after the one before was finished */
export const LAP2_WAIT_MS = JOURNEY_WAIT_MS;

/**
 * days finished after joining (0 = none … LAP2_DONE = all three). Progress from the old second journey (written
 * before `l2.at` existed) does not count: those members play the three new days from the first.
 */
export function lap2Done(story: Record<string, string> | undefined): number {
  // M-R341: the outer planets were visited on the first journey — no days after joining
  if (!lap2Applies(story)) return LAP2_DONE;
  if (!story?.['l2.at']) return 0;
  const n = Number(story['l2.done'] ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(LAP2_DONE, Math.floor(n))) : 0;
}

/** the days after joining exist for this account: only one of the eight-day journey (M-R341) */
export function lap2Applies(story: Record<string, string> | undefined): boolean {
  return story?.[JOURNEY_EIGHT_KEY] === '1';
}

/** when the next day opens (ms since the epoch); null = open now (the first day, or nothing left to wait for) */
export function lap2OpensAt(story: Record<string, string> | undefined): number | null {
  const done = lap2Done(story);
  if (done === 0 || done >= LAP2_DONE) return null;
  const at = Date.parse(story?.['l2.at'] ?? '');
  return Number.isFinite(at) ? at + LAP2_WAIT_MS : null;
}

export const CompleteLap2Body = z.object({
  chapter: z.number().int().min(0).max(LAP2_DONE - 1),
  /** what was made / chosen in the day, kept as `l2.<chapter id>.<key>` */
  answers: z.record(z.string().max(40), z.string().max(200)).optional(),
});
export type CompleteLap2Body = z.infer<typeof CompleteLap2Body>;
