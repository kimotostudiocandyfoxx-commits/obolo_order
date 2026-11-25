import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CHILD_AGE,
  HOME_FAR_MAX,
  PLANET_FIGURE_OF,
  PLANET_HOMES,
  flyingSince,
  orderOwn,
  seesOnlyDachi,
  type HomeOshi,
  type HomePlanet,
  type HomeRel,
  type HomeWork,
  type PlanetHomeView,
  type PlanetWorkKind,
  isKororinPic,
  kororinOf,
  type KororinChoice,
  readTags,
} from '@obolo/shared';
import { and, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { dachiOf, notHidden, notPersonHidden, viewerIsYoung } from '../common/child';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { follows, jupiterPosts, planetHomes, planetPosts, planetWorkMeta, radioShows, saturnPosts, userBlocks, users } from '../db/schema';
import { isPublicWork, metaView } from './planet-works.service';

/**
 * 星のホーム (M-R258; Saturn M-R257). One feed for every planet's home:
 *  - own:    the viewer's works on this planet, forever (their arrangement first, then newest first)
 *  - around: their dachi's and 推し's works flown in the last 88 hours (a young viewer: dachi only), not hidden, not blocked
 *  - far:    a few strangers' works for the far scenery — never for a young viewer, never a young maker's, never on Saturn
 * 推し = the people the viewer follows (follows); dachi = mutual follows, in the list by themselves.
 * The same rules as @obolo/shared splitHome / homeRelOf (pure, tested there); the SQL here is pinned by planet-home.test.ts.
 */

/** one planet store, seen the same way: who made it, when it was flown, what plays */
type Store = {
  t: typeof saturnPosts | typeof jupiterPosts | typeof planetPosts | typeof radioShows;
  id: SQL;
  userId: SQL;
  flownAt: SQL;
  text: SQL;
  title: SQL;
  url: SQL;
  thumb: SQL;
  seconds: SQL;
  /** what counts as "on the planet" at all (flown, not removed) */
  live: SQL;
};

export function storeOf(planet: HomePlanet): Store | null {
  const cfg = PLANET_HOMES[planet];
  switch (cfg.store) {
    case 'saturn_post':
      return {
        t: saturnPosts,
        id: sql`${saturnPosts.id}`,
        userId: sql`${saturnPosts.userId}`,
        flownAt: sql`${saturnPosts.createdAt}`,
        text: sql`${saturnPosts.text}`,
        title: sql`''`,
        url: sql`${saturnPosts.voiceAudioUrl}`,
        thumb: sql`${saturnPosts.photoUrl}`,
        seconds: sql`${saturnPosts.voiceDurationSec}`,
        // flown (not kept in the room), not a reply, not deleted
        live: sql`(${saturnPosts.deletedAt} IS NULL AND ${saturnPosts.replyToId} IS NULL AND ${saturnPosts.room} = 0)`,
      };
    case 'jupiter_post':
      return {
        t: jupiterPosts,
        id: sql`${jupiterPosts.id}`,
        userId: sql`${jupiterPosts.userId}`,
        flownAt: sql`${jupiterPosts.createdAt}`,
        text: sql`${jupiterPosts.text}`,
        title: sql`''`,
        url: sql`${jupiterPosts.url}`,
        thumb: sql`${jupiterPosts.posterUrl}`,
        seconds: sql`NULL::real`,
        live: sql`(${jupiterPosts.deletedAt} IS NULL)`,
      };
    case 'planet_post':
      return {
        t: planetPosts,
        id: sql`${planetPosts.id}`,
        userId: sql`${planetPosts.userId}`,
        flownAt: sql`${planetPosts.createdAt}`,
        text: sql`${planetPosts.text}`,
        title: sql`${planetPosts.title}`,
        url: sql`${planetPosts.url}`,
        thumb: sql`${planetPosts.posterUrl}`,
        seconds: sql`${planetPosts.seconds}`,
        live: sql`(${planetPosts.deletedAt} IS NULL AND ${planetPosts.planet} = ${cfg.storePlanet})`,
      };
    case 'radio_show':
      return {
        t: radioShows,
        id: sql`${radioShows.id}`,
        userId: sql`${radioShows.userId}`,
        flownAt: sql`${radioShows.publishedAt}`,
        text: sql`''`,
        title: sql`${radioShows.title}`,
        url: sql`${radioShows.audioUrl}`,
        thumb: sql`${radioShows.thumbUrl}`,
        seconds: sql`${radioShows.seconds}`,
        live: sql`(${radioShows.deletedAt} IS NULL AND ${radioShows.removedAt} IS NULL AND ${radioShows.status} = 'public' AND ${radioShows.publishedAt} IS NOT NULL)`,
      };
    default:
      return null;
  }
}

/** the author in `col` is under CHILD_AGE or has no birth year (never reaches strangers) */
export const authorIsYoung = (col: SQL): SQL =>
  sql`EXISTS (SELECT 1 FROM users a WHERE a.id = ${col} AND COALESCE(NULLIF(a.onboarding_json->>'birthYear', '')::int, 9999) > EXTRACT(YEAR FROM now())::int - ${CHILD_AGE})`;
const followsOf = (viewerId: string): SQL => sql`SELECT f.followee_id FROM follows f WHERE f.follower_id = ${viewerId}`;
export const blockedWith = (viewerId: string, col: SQL): SQL =>
  sql`EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = ${viewerId} AND b.blocked_id = ${col}) OR (b.blocker_id = ${col} AND b.blocked_id = ${viewerId}))`;

/** own works: no time limit at all (kept forever) */
export const ownWhere = (s: Store, viewerId: string): SQL => sql`(${s.live} AND ${s.userId} = ${viewerId})`;

/** dachi always (within 88h); 推し only for a viewer who is not young, and never a young maker who is not a dachi */
export const aroundWhere = (s: Store, viewerId: string, kind: PlanetWorkKind, since: Date): SQL =>
  sql`(${s.live} AND ${s.flownAt} > ${since} AND ${s.userId} <> ${viewerId} AND (${s.userId} IN (${dachiOf(viewerId)}) OR (${s.userId} IN (${followsOf(viewerId)}) AND NOT ${viewerIsYoung(viewerId)} AND NOT ${authorIsYoung(s.userId)})) AND ${notHidden(viewerId, kind, s.id)} AND ${notPersonHidden(viewerId, s.userId)} AND NOT ${blockedWith(viewerId, s.userId)})`;

/**
 * strangers (not followed), for a viewer who is not young, never a young maker, within 88h — and (planets 2-2) only a
 * work that is public in effect: a dachi work never reaches a stranger
 */
export const farWhere = (s: Store, viewerId: string, kind: PlanetWorkKind, since: Date): SQL =>
  sql`(${s.live} AND ${s.flownAt} > ${since} AND ${s.userId} <> ${viewerId} AND ${s.userId} NOT IN (${followsOf(viewerId)}) AND NOT ${viewerIsYoung(viewerId)} AND NOT ${authorIsYoung(s.userId)} AND ${notHidden(viewerId, kind, s.id)} AND ${notPersonHidden(viewerId, s.userId)} AND NOT ${blockedWith(viewerId, s.userId)} AND ${isPublicWork(kind, s.id)})`;

type Row = { id: string; userId: string; flownAt: Date | string; text: string | null; title: string | null; url: string | null; thumb: string | null; seconds: number | null; name: string; pic: string | null; chibi?: string | null; kPic?: number | null; figure?: string | null; ball?: string | null };

export function toWork(r: Row, kind: PlanetWorkKind, rel: HomeRel): HomeWork {
  return {
    id: r.id,
    kind,
    author: { id: r.userId, name: r.name, pic: r.pic, chibi: r.chibi ?? null, kororin: kororinOf({ pic: r.kPic }), figure: r.figure ?? null, ball: r.ball ?? null },
    rel,
    text: r.text ?? '',
    title: r.title || undefined,
    url: r.url,
    thumbUrl: r.thumb,
    seconds: r.seconds,
    flownAt: (r.flownAt instanceof Date ? r.flownAt : new Date(r.flownAt)).toISOString(),
  };
}

@Injectable()
export class PlanetHomeService {
  constructor(private readonly db: Database) {}

  /** `planet`: the maker's figure on it (client 2026-11-25: the figures of the look they wear now) and, on Saturn, their ball */
  private async rows(s: Store, where: SQL, order: SQL, limit: number, planet?: HomePlanet): Promise<Row[]> {
    const fig = (f: string) => sql<string | null>`(${users.planetFigures} -> ${users.avatarUrl} ->> ${f})`;
    const extra = planet ? { figure: fig(PLANET_FIGURE_OF[planet]), ...(planet === 'saturn' ? { ball: fig('saturnBall') } : {}) } : {};
    return (await this.db.read
      .select({ id: s.id, userId: s.userId, flownAt: s.flownAt, text: s.text, title: s.title, url: s.url, thumb: s.thumb, seconds: s.seconds, name: users.displayName, pic: users.puniPicUrl, chibi: users.chibiPicUrl, kPic: users.kororinPic, ...extra })
      .from(s.t as typeof saturnPosts)
      .innerJoin(users, sql`${users.id} = ${s.userId}`)
      .where(and(where, isNull(users.deletedAt)))
      .orderBy(order)
      .limit(limit)) as Row[];
  }

  async home(userId: string, planet: HomePlanet) {
    const [h] = await this.db.read.select().from(planetHomes).where(and(eq(planetHomes.userId, userId), eq(planetHomes.planet, planet)));
    return h ?? null;
  }

  private async dachiIds(viewerId: string): Promise<Set<string>> {
    const r = await this.db.read.execute<{ id: string }>(sql`SELECT f.followee_id AS id FROM follows f JOIN follows g ON g.follower_id = f.followee_id AND g.followee_id = f.follower_id WHERE f.follower_id = ${viewerId}`);
    return new Set(r.rows.map((x) => x.id));
  }

  async feed(viewerId: string, planet: HomePlanet, now = new Date()): Promise<PlanetHomeView> {
    const cfg = PLANET_HOMES[planet];
    const [me] = await this.db.read.select({ id: users.id, name: users.displayName, onboarding: users.onboardingJson }).from(users).where(eq(users.id, viewerId));
    if (!me) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found');
    const young = seesOnlyDachi((me.onboarding as { birthYear?: number } | null)?.birthYear ?? null, now);
    const h = await this.home(viewerId, planet);
    const base = { planet, owner: { id: me.id, name: me.name }, young, lastVisitAt: h?.lastVisitAt?.toISOString() ?? null, recordColour: h?.recordColour ?? null };
    const s = storeOf(planet);
    if (!s || !cfg.store) return { ...base, live: false, own: [], around: [], far: [] };
    const kind = cfg.store;
    const since = flyingSince(now);
    const newest = sql`${s.flownAt} DESC`;
    const [own, around, far, dachi] = await Promise.all([
      this.rows(s, ownWhere(s, viewerId), newest, 300, planet),
      this.rows(s, aroundWhere(s, viewerId, kind, since), newest, 60, planet),
      cfg.far && !young ? this.rows(s, farWhere(s, viewerId, kind, since), sql`random()`, HOME_FAR_MAX, planet) : Promise.resolve([] as Row[]),
      this.dachiIds(viewerId),
    ]);
    // planets 2-1 / 2-2: every work carries its hidden tags; your own also their visibility (and why one is held)
    const ids = [...own, ...around, ...far].map((r) => r.id);
    const metas = ids.length ? (((await this.db.read.select().from(planetWorkMeta).where(and(eq(planetWorkMeta.kind, kind), inArray(planetWorkMeta.workId, ids)))) ?? []) as (typeof planetWorkMeta.$inferSelect)[]) : [];
    const byId = new Map(metas.map((m) => [m.workId, m]));
    const tagged = (w: HomeWork, mine = false): HomeWork => {
      const m = byId.get(w.id);
      const tags = m ? readTags(m.main, m.moodsJson, m.bpm) : undefined;
      if (!mine) return tags ? { ...w, tags } : w;
      const v = metaView(kind, w.id, m);
      return { ...w, ...(tags ? { tags } : {}), visibility: v.visibility, heldReason: v.check === 'held' ? v.reason : null };
    };
    return {
      ...base,
      live: true,
      own: orderOwn(
        own.map((r) => tagged(toWork(r, kind, 'own'), true)),
        h?.orderJson,
      ),
      around: around.map((r) => tagged(toWork(r, kind, dachi.has(r.userId) ? 'dachi' : 'oshi'))),
      far: far.map((r) => tagged(toWork(r, kind, 'stranger'))),
    };
  }

  /** opened: remember when (the next visit sparkles what came after); returns the visit before */
  async visit(userId: string, planet: HomePlanet, now = new Date()): Promise<{ lastVisitAt: string | null }> {
    const h = await this.home(userId, planet);
    await this.db.write
      .insert(planetHomes)
      .values({ userId, planet, lastVisitAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: [planetHomes.userId, planetHomes.planet], set: { lastVisitAt: now, updatedAt: now } });
    return { lastVisitAt: h?.lastVisitAt?.toISOString() ?? null };
  }

  /** M-R262: your record's colour (kept with the home) */
  async setColour(userId: string, planet: HomePlanet, colour: string): Promise<{ colour: string }> {
    await this.db.write
      .insert(planetHomes)
      .values({ userId, planet, recordColour: colour, updatedAt: new Date() })
      .onConflictDoUpdate({ target: [planetHomes.userId, planetHomes.planet], set: { recordColour: colour, updatedAt: new Date() } });
    return { colour };
  }

  /** M-R275: the member's kororin picture (1–24; null = not chosen) */
  async kororin(userId: string): Promise<{ pic: number | null } | null> {
    const [u] = await this.db.read.select({ pic: users.kororinPic }).from(users).where(eq(users.id, userId));
    return u ?? null;
  }

  async setKororin(userId: string, pic: number): Promise<KororinChoice> {
    if (!isKororinPic(pic)) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Not a kororin picture');
    await this.db.write.update(users).set({ kororinPic: pic, updatedAt: new Date() }).where(eq(users.id, userId));
    return { pic };
  }

  /** 並べかえ: your own works in your place (only your own ids are kept) */
  async reorder(userId: string, planet: HomePlanet, ids: string[]): Promise<{ ids: string[] }> {
    const s = storeOf(planet);
    if (!s) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'No works on this planet yet');
    const mine = ids.length ? await this.rows(s, and(ownWhere(s, userId), inArray(s.id as never, ids))!, sql`${s.flownAt} DESC`, 500) : [];
    const ok = new Set(mine.map((r) => r.id));
    const kept = [...new Set(ids)].filter((id) => ok.has(id));
    await this.db.write
      .insert(planetHomes)
      .values({ userId, planet, orderJson: kept, updatedAt: new Date() })
      .onConflictDoUpdate({ target: [planetHomes.userId, planetHomes.planet], set: { orderJson: kept, updatedAt: new Date() } });
    return { ids: kept };
  }

  /**
   * 外す (your own work, from your place): it goes back into Bluena only — the kororin back to the room, the show back to
   * private; a Jupiter / Mercury / Mars post is taken down (its art / song / film stays in Bluena).
   */
  async takeOut(userId: string, planet: HomePlanet, id: string): Promise<void> {
    const cfg = PLANET_HOMES[planet];
    let n = 0;
    if (cfg.store === 'saturn_post')
      n = (await this.db.write.update(saturnPosts).set({ room: 1, updatedAt: new Date() }).where(and(eq(saturnPosts.id, id), eq(saturnPosts.userId, userId), eq(saturnPosts.room, 0), isNull(saturnPosts.deletedAt))).returning({ id: saturnPosts.id })).length;
    else if (cfg.store === 'jupiter_post')
      n = (await this.db.write.update(jupiterPosts).set({ deletedAt: new Date() }).where(and(eq(jupiterPosts.id, id), eq(jupiterPosts.userId, userId), isNull(jupiterPosts.deletedAt))).returning({ id: jupiterPosts.id })).length;
    else if (cfg.store === 'planet_post')
      n = (await this.db.write.update(planetPosts).set({ deletedAt: new Date() }).where(and(eq(planetPosts.id, id), eq(planetPosts.userId, userId), eq(planetPosts.planet, cfg.storePlanet!), isNull(planetPosts.deletedAt))).returning({ id: planetPosts.id })).length;
    else if (cfg.store === 'radio_show')
      n = (await this.db.write.update(radioShows).set({ status: 'private', publishedAt: null, updatedAt: new Date() }).where(and(eq(radioShows.id, id), eq(radioShows.userId, userId))).returning({ id: radioShows.id })).length;
    if (!n) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Work not found');
  }

  // --- 推し -------------------------------------------------------------------------------------------------------

  /** your 推し: everyone you follow; dachi (mutual) marked, they are in by themselves */
  async oshiList(viewerId: string): Promise<HomeOshi[]> {
    const rows = await this.db.read
      .select({ id: users.id, name: users.displayName, pic: users.puniPicUrl })
      .from(follows)
      .innerJoin(users, eq(users.id, follows.followeeId))
      .where(and(eq(follows.followerId, viewerId), isNull(users.deletedAt)))
      .orderBy(sql`${follows.createdAt} DESC`)
      .limit(500);
    const dachi = await this.dachiIds(viewerId);
    return rows.map((r) => ({ ...r, dachi: dachi.has(r.id) })).sort((a, b) => Number(b.dachi) - Number(a.dachi));
  }

  private async birthYear(id: string): Promise<{ exists: boolean; by: number | null }> {
    const [u] = await this.db.read.select({ onboarding: users.onboardingJson, deletedAt: users.deletedAt }).from(users).where(eq(users.id, id));
    return { exists: !!u && !u.deletedAt, by: (u?.onboarding as { birthYear?: number } | null)?.birthYear ?? null };
  }

  /**
   * 〔推す〕: follow someone seen on a planet. A young viewer cannot push strangers (no button either), and a young
   * maker cannot be pushed by a stranger (their works never reach strangers anyway). Blocks stop it as on Earth.
   */
  async push(viewerId: string, userId: string, now = new Date()): Promise<HomeOshi[]> {
    if (viewerId === userId) throw apiError(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', 'You cannot push yourself');
    const [me, them] = await Promise.all([this.birthYear(viewerId), this.birthYear(userId)]);
    if (!them.exists) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found');
    const dachi = (await this.dachiIds(viewerId)).has(userId);
    if (!dachi && (seesOnlyDachi(me.by, now) || seesOnlyDachi(them.by, now))) throw apiError(HttpStatus.FORBIDDEN, 'CHILD', 'Not for under 15');
    const [blocked] = await this.db.read
      .select({ x: userBlocks.blockerId })
      .from(userBlocks)
      .where(or(and(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, userId)), and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, viewerId))))
      .limit(1);
    if (blocked) throw apiError(HttpStatus.FORBIDDEN, 'BLOCKED', 'You cannot push this person');
    await this.db.write.insert(follows).values({ followerId: viewerId, followeeId: userId }).onConflictDoNothing();
    return this.oshiList(viewerId);
  }

  /** 外す from the 推し list (a dachi stays: taking them out would end the dachi) */
  async unpush(viewerId: string, userId: string): Promise<HomeOshi[]> {
    if ((await this.dachiIds(viewerId)).has(userId)) throw apiError(HttpStatus.CONFLICT, 'DACHI', 'A dachi is in by themselves');
    await this.db.write.delete(follows).where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, userId)));
    return this.oshiList(viewerId);
  }
}
