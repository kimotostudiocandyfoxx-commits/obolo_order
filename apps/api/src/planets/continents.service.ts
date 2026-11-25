import { HttpStatus, Injectable } from '@nestjs/common';
import {
  checkFavourites,
  DRIFT_MIN_SCORE,
  favouritesOf,
  pickTravel,
  PLANET_FIGURE_OF,
  PLANET_HOMES,
  PLANET_WORK_DEFAULT_VISIBILITY,
  rankContinents,
  readTags,
  seesOnlyDachi,
  toggleFavourite,
  TRAVEL_COUNT,
  workScore,
  type ContinentRule,
  type ContinentView,
  type FavouriteSlots,
  type HomePlanet,
  type HomeRel,
  type HomeWork,
  type WorkTags,
} from '@obolo/shared';
import { and, asc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { notHidden, notPersonHidden } from '../common/child';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { continents, continentSeen, planetHomes, planetWorkMeta, users } from '../db/schema';
import { WINGS_KEY } from '../look/figures';
import { authorIsYoung, blockedWith, storeOf, toWork } from './planet-home.service';

type ContinentRow = typeof continents.$inferSelect & { creatorName?: string | null };

/** a work on a continent: the planet's work, its hidden tags, how well it fits there */
export type ContinentWork = HomeWork & { tags: WorkTags; score: number };

export interface ContinentLanding {
  continent: ContinentView;
  /** a viewer under 15 (or with no birth year) meets no strangers: no works (M-R213) */
  young: boolean;
  works: ContinentWork[];
}

export interface SkyView {
  planet: HomePlanet;
  continents: ContinentView[];
  /** じぶんの空: the five slots (null = empty, 〔＋ さがす〕) */
  favourites: FavouriteSlots;
}

/** the most works read for one continent / one count (newest first; scored and shuffled after) */
const WORKS_READ = 400;

export const toContinent = (r: ContinentRow): ContinentView => ({
  key: r.key,
  planet: r.planet as HomePlanet,
  name: r.name,
  creator: r.creatorId ? { id: r.creatorId, name: r.creatorName ?? '' } : null,
  rule: r.ruleJson,
  tags: r.tagsJson ?? [],
  pictures: { sky: r.skyUrl, land: r.landUrl, shore: r.shoreUrl },
});

const textArray = (xs: readonly string[]): SQL => sql`ARRAY[${sql.join(
  xs.map((x) => sql`${x}`),
  sql`, `,
)}]::text[]`;

/** only works whose tags could score on the rule (a main class or a mood in common: workScore ≥ 2 needs one) */
export function ruleFilter(rule: ContinentRule | null): SQL | undefined {
  if (!rule) return undefined;
  const parts: SQL[] = [];
  if (rule.g.length) parts.push(sql`${planetWorkMeta.main} = ANY(${textArray(rule.g)})`);
  if (rule.m.length) parts.push(sql`${planetWorkMeta.moodsJson} ?| ${textArray(rule.m)}`);
  return parts.length ? sql`(${sql.join(parts, sql` OR `)})` : sql`FALSE`;
}

/**
 * 2-2 + safety: which works may drift to strangers' continents — public in effect (chosen or by the default, and the
 * check passed: a dachi work NEVER), live in its store, its maker not deleted / suspended; someone else's work also
 * not a young maker's, not hidden by the viewer, nobody blocked either way. The viewer's own public works drift too.
 */
export function continentWhere(viewerId: string, planet: HomePlanet): SQL | null {
  const s = storeOf(planet);
  const kind = PLANET_HOMES[planet].store;
  if (!s || !kind) return null;
  return sql`(${s.live} AND COALESCE(${planetWorkMeta.visibility}, ${PLANET_WORK_DEFAULT_VISIBILITY}) = 'public' AND ${planetWorkMeta.checkState} = 'ok' AND ${users.deletedAt} IS NULL AND ${users.suspendedAt} IS NULL AND (${s.userId} = ${viewerId} OR (NOT ${authorIsYoung(s.userId)} AND ${notHidden(viewerId, kind, s.id)} AND ${notPersonHidden(viewerId, s.userId)} AND NOT ${blockedWith(viewerId, s.userId)})))`;
}

/**
 * 2-4 / 2-5 (docs/planets.md): the continents of a planet (data, not code), the works that drift to each (the
 * prototype's workScore ≥ 2, one work on several), じぶんの空's five favourites, 〔🔍 大陸をさがす〕 and 〔✈ 旅〕 (unseen
 * continents first, M-R312). Never ordered by popularity (M-R298): by the score, then at random.
 */
@Injectable()
export class ContinentsService {
  constructor(private readonly db: Database) {}

  async list(planet: HomePlanet): Promise<ContinentRow[]> {
    return (await this.db.read
      .select({ c: continents, creatorName: users.displayName })
      .from(continents)
      .leftJoin(users, eq(users.id, continents.creatorId))
      .where(and(eq(continents.planet, planet), isNull(continents.deletedAt)))
      .orderBy(asc(continents.sortOrder), asc(continents.createdAt))).map((r) => ({ ...r.c, creatorName: r.creatorName }));
  }

  private async one(planet: HomePlanet, key: string): Promise<ContinentRow> {
    const c = (await this.list(planet)).find((x) => x.key === key);
    if (!c) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Unknown continent');
    return c;
  }

  private async young(viewerId: string): Promise<boolean> {
    const [me] = await this.db.read.select({ onboarding: users.onboardingJson }).from(users).where(eq(users.id, viewerId));
    if (!me) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found');
    return seesOnlyDachi((me.onboarding as { birthYear?: number } | null)?.birthYear ?? null);
  }

  /** the public works of the planet that could reach `rule` (all of them when null), with their tags */
  protected async works(viewerId: string, planet: HomePlanet, rule: ContinentRule | null): Promise<(Parameters<typeof toWork>[0] & { main: string | null; moods: unknown; bpm: number | null })[]> {
    const s = storeOf(planet);
    const kind = PLANET_HOMES[planet].store;
    const where = continentWhere(viewerId, planet);
    if (!s || !kind || !where) return [];
    const fig = sql<string | null>`(${users.planetFigures} -> ${users.avatarUrl} ->> ${PLANET_FIGURE_OF[planet]})`;
    const wings: Record<string, SQL> = planet === 'jupiter' ? { wings: sql<string | null>`(${users.planetFigures} -> ${users.avatarUrl} ->> ${WINGS_KEY})` } : {};
    return (await this.db.read
      .select({ id: s.id, userId: s.userId, flownAt: s.flownAt, text: s.text, title: s.title, url: s.url, thumb: s.thumb, seconds: s.seconds, name: users.displayName, pic: users.puniPicUrl, chibi: users.chibiPicUrl, kPic: users.kororinPic, figure: fig, ...wings, main: planetWorkMeta.main, moods: planetWorkMeta.moodsJson, bpm: planetWorkMeta.bpm })
      .from(s.t as never)
      .innerJoin(users, sql`${users.id} = ${s.userId}`)
      .innerJoin(planetWorkMeta, sql`${planetWorkMeta.kind} = ${kind} AND ${planetWorkMeta.workId} = ${s.id}`)
      .where(and(where, ruleFilter(rule)))
      .orderBy(sql`${s.flownAt} DESC`)
      .limit(WORKS_READ)) as never;
  }

  /** who the viewer follows (推し) and which of them are dachi */
  private async rels(viewerId: string): Promise<Map<string, HomeRel>> {
    const r = await this.db.read.execute<{ id: string; dachi: boolean }>(
      sql`SELECT f.followee_id AS id, EXISTS (SELECT 1 FROM follows g WHERE g.follower_id = f.followee_id AND g.followee_id = f.follower_id) AS dachi FROM follows f WHERE f.follower_id = ${viewerId}`,
    );
    return new Map((r?.rows ?? []).map((x) => [x.id, x.dachi ? 'dachi' : 'oshi']));
  }

  // --- じぶんの空 ------------------------------------------------------------------------------------------------

  async sky(viewerId: string, planet: HomePlanet): Promise<SkyView> {
    const rows = await this.list(planet);
    return { planet, continents: rows.map(toContinent), favourites: favouritesOf(await this.savedFavs(viewerId, planet), rows) };
  }

  private async savedFavs(viewerId: string, planet: HomePlanet): Promise<(string | null)[] | null> {
    const [h] = await this.db.read.select({ f: planetHomes.continentFavsJson }).from(planetHomes).where(and(eq(planetHomes.userId, viewerId), eq(planetHomes.planet, planet)));
    return h?.f ?? null;
  }

  private async keepFavs(viewerId: string, planet: HomePlanet, slots: FavouriteSlots): Promise<FavouriteSlots> {
    const now = new Date();
    await this.db.write
      .insert(planetHomes)
      .values({ userId: viewerId, planet, continentFavsJson: slots, updatedAt: now })
      .onConflictDoUpdate({ target: [planetHomes.userId, planetHomes.planet], set: { continentFavsJson: slots, updatedAt: now } });
    return slots;
  }

  /** the five at once (after a swap) */
  async setFavourites(viewerId: string, planet: HomePlanet, slots: (string | null)[]): Promise<FavouriteSlots> {
    const keys = new Set((await this.list(planet)).map((c) => c.key));
    const r = checkFavourites(slots, keys);
    if (typeof r === 'string') throw apiError(HttpStatus.BAD_REQUEST, r, 'Not five continents of this planet');
    return this.keepFavs(viewerId, planet, r);
  }

  /** ☆ on one continent: into an empty slot (or the slot said); 409 FULL when all five are taken */
  async favourite(viewerId: string, planet: HomePlanet, key: string, on: boolean, slot?: number): Promise<FavouriteSlots> {
    const rows = await this.list(planet);
    if (on && !rows.some((c) => c.key === key)) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Unknown continent');
    const cur = favouritesOf(await this.savedFavs(viewerId, planet), rows);
    const next = toggleFavourite(cur, key, on, slot);
    if (next === 'FULL') throw apiError(HttpStatus.CONFLICT, 'FULL', 'Five continents already: pick one to swap');
    return this.keepFavs(viewerId, planet, next);
  }

  // --- landing ------------------------------------------------------------------------------------------------

  /** score the works for a continent: ≥ DRIFT_MIN_SCORE drift; best first, the same score at random */
  static drift<W extends { main: string | null; moods: unknown; bpm: number | null }>(rule: ContinentRule, ws: W[], rand: () => number = Math.random) {
    return ws
      .map((w) => {
        const tags = readTags(w.main, w.moods, w.bpm);
        return { w, tags, s: workScore(tags, rule), r: rand() };
      })
      .filter((x) => x.s >= DRIFT_MIN_SCORE)
      .sort((a, b) => b.s - a.s || a.r - b.r);
  }

  /** 降りる: the continent and the works drifted there (the landing is recorded with visit()) */
  async land(viewerId: string, planet: HomePlanet, key: string): Promise<ContinentLanding> {
    const c = await this.one(planet, key);
    const young = await this.young(viewerId);
    if (young) return { continent: toContinent(c), young, works: [] };
    const kind = PLANET_HOMES[planet].store!;
    const [ws, rels] = await Promise.all([this.works(viewerId, planet, c.ruleJson), this.rels(viewerId)]);
    const works = ContinentsService.drift(c.ruleJson, ws).map(({ w, tags, s }) => ({ ...toWork(w, kind, w.userId === viewerId ? 'own' : (rels.get(w.userId) ?? 'stranger')), tags, score: s }));
    return { continent: toContinent(c), young, works };
  }

  /** 2-5 the seen record: landed on (〔旅〕 shows unseen continents first) */
  async visit(viewerId: string, planet: HomePlanet, key: string, now = new Date()): Promise<{ ok: true }> {
    await this.one(planet, key);
    await this.db.write
      .insert(continentSeen)
      .values({ userId: viewerId, planet, key, landedAt: now })
      .onConflictDoUpdate({ target: [continentSeen.userId, continentSeen.planet, continentSeen.key], set: { landedAt: now } });
    return { ok: true };
  }

  /** 〔✈ 旅〕 (M-R312): six continents, never shown ones first; the ones shown are recorded so the next press brings others */
  async travel(viewerId: string, planet: HomePlanet, n = TRAVEL_COUNT, now = new Date()): Promise<ContinentView[]> {
    const rows = await this.list(planet);
    const seenRows = await this.db.read.select().from(continentSeen).where(and(eq(continentSeen.userId, viewerId), eq(continentSeen.planet, planet)));
    const seen = new Map<string, number>();
    for (const r of seenRows ?? []) seen.set(r.key, Math.max(r.shownAt?.getTime() ?? 0, r.landedAt?.getTime() ?? 0));
    const keys = pickTravel(
      rows.map((c) => c.key),
      seen,
      Math.max(1, Math.min(12, n)),
    );
    for (const key of keys)
      await this.db.write
        .insert(continentSeen)
        .values({ userId: viewerId, planet, key, shownAt: now })
        .onConflictDoUpdate({ target: [continentSeen.userId, continentSeen.planet, continentSeen.key], set: { shownAt: now } });
    const by = new Map(rows.map((c) => [c.key, c]));
    return keys.map((k) => toContinent(by.get(k)!));
  }

  /** 〔🔍 大陸をさがす〕: by name / #tag / maker, best first then at random; each with how many public works drifted there */
  async search(viewerId: string, planet: HomePlanet, q = '', tag?: string | null): Promise<ContinentView[]> {
    const rows = await this.list(planet);
    const views = rows.map(toContinent);
    const found = rankContinents(views, q, tag);
    const ws = (await this.young(viewerId)) ? [] : await this.works(viewerId, planet, null);
    const tags = ws.map((w) => readTags(w.main, w.moods, w.bpm));
    return found.map((c) => ({ ...c, count: tags.filter((t) => workScore(t, c.rule) >= DRIFT_MIN_SCORE).length }));
  }
}
