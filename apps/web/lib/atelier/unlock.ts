import { JOURNEY_DONE } from '@obolo/shared';

/**
 * Which kinds the Moon atelier (〔月で作る〕) can make today (client decision M-R208).
 * Making happens only in the atelier; on the first journey each day opens the kind that day teaches:
 *   2 your look and {bati}'s look + talking (Bati's room, /moon — not a kind here) · 3 コロリン (voice) · 4 アート ·
 *   5 曲 · 6 映像 (MV) · 7 金星のラジオ.
 * After the journey (journeyDay ≥ JOURNEY_DONE) everything is open. A member who joined early is on the same day
 * schedule (only journeyDay counts). グッズ・本・ゲーム are the members' later planets: not on this schedule.
 */
export const UNLOCK_DAY = {
  voice: 3,
  art: 4,
  song: 5,
  video: 6,
  radio: 7,
} as const;

export type ScheduledKind = keyof typeof UNLOCK_DAY;

/** the day a kind opens, or null when it is not on the journey's schedule (goods / book / game / any) */
export function unlockDay(kind: string): number | null {
  return (UNLOCK_DAY as Record<string, number>)[kind] ?? null;
}

/** the kinds open on this journey day, in the order they open */
export function openKinds(journeyDay: number | null | undefined): ScheduledKind[] {
  const all = Object.keys(UNLOCK_DAY) as ScheduledKind[];
  if (journeyDay == null || journeyDay >= JOURNEY_DONE) return all;
  return all.filter((k) => journeyDay >= UNLOCK_DAY[k]);
}

/**
 * Whether a kind can be made today. 'any' (おまかせ) follows what is open: it opens with the first kind.
 * Kinds off the schedule (goods / book / game) stay as they are.
 */
export function isOpen(kind: string, journeyDay: number | null | undefined): boolean {
  if (journeyDay == null || journeyDay >= JOURNEY_DONE) return true;
  if (kind === 'any') return openKinds(journeyDay).length > 0;
  const d = unlockDay(kind);
  return d === null || journeyDay >= d;
}

/**
 * What おまかせ makes: a song (talk → song) when songs are open, else the newest kind open today.
 * null when nothing is open yet.
 */
export function omakaseKind(journeyDay: number | null | undefined): ScheduledKind | null {
  const open = openKinds(journeyDay);
  if (open.includes('song')) return 'song';
  return open[open.length - 1] ?? null;
}

/** the calm one line on a locked kind (screen copy) */
export function lockLine(kind: string): string {
  const d = kind === 'any' ? UNLOCK_DAY.voice : unlockDay(kind);
  return d ? `${d}日目に、作れるようになる` : '';
}
