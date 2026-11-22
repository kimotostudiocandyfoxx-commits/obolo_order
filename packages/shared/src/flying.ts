import { z } from 'zod';

/**
 * M-R208 (client decision, approved): 「飛ばした作品は、飛ばしてから88時間、その星のみんなが見られる広い場所で生きている。
 * 88時間が終わると、自分の場所に帰る」. One rule for every planet (separate from the 88-minutes-a-day gate):
 *  - Saturn: kororins on the giant DJ record → your own record
 *  - Jupiter: butterflies in the forest → your myアトリエ / tree
 *  - Mercury: ships on the sea → your island
 *  - Mars: UFOs over the city → your studio
 *  - Venus: radio waves above the clouds → your booth (your shows list)
 * "When it was flown" is the work's own time: a post's createdAt, a radio show's publishedAt.
 */
export const PLANET_FLY_HOURS = 88;
export const PLANET_FLY_MS = PLANET_FLY_HOURS * 3600_000;

type When = string | number | Date;
const ms = (t: When) => (t instanceof Date ? t.getTime() : typeof t === 'number' ? t : Date.parse(t));

/** the moment a work flown at `flownAt` goes back to its maker's own place */
export function backHomeAt(flownAt: When): Date {
  return new Date(ms(flownAt) + PLANET_FLY_MS);
}

/** still out in the planet's shared place (everyone sees it) */
export function isFlying(flownAt: When | null | undefined, now: When = Date.now()): boolean {
  if (flownAt == null) return false;
  const t = ms(flownAt);
  return Number.isFinite(t) && t > ms(now) - PLANET_FLY_MS;
}

/** works flown after this moment are still flying (for a `> since` query) */
export function flyingSince(now: When = Date.now()): Date {
  return new Date(ms(now) - PLANET_FLY_MS);
}

/** whole hours left before it goes home (0 when home) */
export function hoursLeft(flownAt: When, now: When = Date.now()): number {
  return Math.max(0, Math.ceil((backHomeAt(flownAt).getTime() - ms(now)) / 3600_000));
}

/** split works into those flying now (everyone's place) and those back home (the maker's place), order kept */
export function splitFlying<T>(items: readonly T[], flownAt: (x: T) => When | null | undefined, now: When = Date.now()): { flying: T[]; home: T[] } {
  const flying: T[] = [];
  const home: T[] = [];
  for (const x of items) (isFlying(flownAt(x), now) ? flying : home).push(x);
  return { flying, home };
}

// --- M-R213: strangers' works on a planet's wide place: 〔通報〕 and 〔見えなくする〕 -----------------------------------

/** which kind of planet work: Saturn kororin, Jupiter butterfly, Mercury / Mars post, Venus show */
export const PLANET_WORK_KINDS = ['saturn_post', 'jupiter_post', 'planet_post', 'radio_show'] as const;
export type PlanetWorkKind = (typeof PLANET_WORK_KINDS)[number];
export const PlanetWorkHideBody = z.object({ on: z.boolean() });
export type PlanetWorkHideBody = z.infer<typeof PlanetWorkHideBody>;
export const PlanetWorkReportBody = z.object({
  reason: z.enum(['mean', 'scary', 'other']),
  note: z.string().trim().max(200).optional(),
});
export type PlanetWorkReportBody = z.infer<typeof PlanetWorkReportBody>;

