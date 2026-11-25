import type { JobView } from '@obolo/shared';

/**
 * R18 (client 2026-11-25): 「待っている間、ふつうのローディングじゃなくて — 後ろの水盤が神々しく光って、光る数字がカウントダウン
 * したり、神秘的な時計が回って、だいたいどれくらいかかるか分かるように」. The arcane clock over the bowl while a work of the
 * talk is being made: how far its ring has filled, what its glowing numerals say, and which of several jobs is shown big.
 * Pure (the scene's CastClock draws it).
 */
export type ClockJob = Pick<JobView, 'etaAt' | 'startedAt' | 'createdAt' | 'late' | 'status'>;

export type ClockFace = {
  /** the outer ring: elapsed / the time it was given (0..1; full once the time is up) */
  fill: number;
  /** ms to its time (0 once it is up) */
  left: number;
  /** its time is up (or the server moved it on: 「ごめん、あと1分だけ」) — the numerals give way to 「もうすこし…」, never counting up or below zero */
  overdue: boolean;
  /** the glowing numerals: 「02:41」 up to ten minutes, 「あと12分」 longer, 「もうすこし…」 when over, null when there is no time (yet, or a quick one) */
  numerals: string | null;
  /** the numerals are words (あと◯分 / もうすこし…), not a clock face */
  words: boolean;
};

/** up to this much left, the numerals are a clock (mm:ss); longer, words (「あと12分」) */
export const CLOCK_MMSS_MS = 10 * 60_000;
export const OVERDUE_WORDS = 'もうすこし…';

const pad = (n: number) => String(n).padStart(2, '0');

/** 「02:41」 (seconds rounded up: it never shows 00:00 while there is time left) */
export function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

/** the clock's face for a job at `now`; `long`: a slow job (its time is said) — a quick one shows no numerals */
export function clockFace(job: ClockJob | undefined, now: number, long = true): ClockFace {
  if (!job?.etaAt) return { fill: 0, left: 0, overdue: false, numerals: null, words: false };
  const eta = Date.parse(job.etaAt);
  const start = Date.parse(job.startedAt ?? job.createdAt);
  const left = Math.max(0, eta - now);
  const overdue = left <= 0 || !!job.late;
  const fill = overdue || eta <= start ? 1 : Math.max(0, Math.min(1, (now - start) / (eta - start)));
  if (!long) return { fill, left, overdue, numerals: null, words: false };
  if (overdue) return { fill, left: 0, overdue, numerals: OVERDUE_WORDS, words: true };
  if (left > CLOCK_MMSS_MS) return { fill, left, overdue, numerals: `あと${Math.ceil(left / 60_000)}分`, words: true };
  return { fill, left, overdue, numerals: mmss(left), words: false };
}

/**
 * several works being made: the one to show big first (the soonest to finish), the others after it (as small sigils
 * orbiting the clock). Overdue ones are the soonest (they are about to be done); one with no time yet comes last.
 */
export function clockOrder<T extends { job: ClockJob | undefined }>(xs: T[], now: number): T[] {
  const key = (j: ClockJob | undefined) => (j?.etaAt ? (j.late ? 0 : Math.max(0, Date.parse(j.etaAt) - now)) : Number.POSITIVE_INFINITY);
  return xs
    .map((x, i) => ({ x, i, k: key(x.job) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((e) => e.x);
}

/** SVG: an arc's dash for `fill` of a ring of radius r (stroke-dasharray / -offset, starting at the top) */
export function ringDash(fill: number, r: number): { dasharray: string; dashoffset: number } {
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fill));
  return { dasharray: `${c.toFixed(2)} ${c.toFixed(2)}`, dashoffset: +(c * (1 - f)).toFixed(2) };
}
