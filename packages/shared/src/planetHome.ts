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
  author: { id: string; name: string; pic?: string | null };
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
  /** your works in your place, forever: your order first, then newest first */
  own: HomeWork[];
  /** dachi and 推し, flown in the last 88 hours, newest first */
  around: HomeWork[];
  /** a few strangers for the far scenery (empty for the young) */
  far: HomeWork[];
}

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
