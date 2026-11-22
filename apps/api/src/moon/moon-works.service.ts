import { HttpStatus, Injectable } from '@nestjs/common';
import {
  addVersion,
  dropVersion,
  flyingSince,
  hiddenRefs,
  PLANET_FLY_MS,
  reactionsFor,
  setFace,
  type AddVersionBody,
  type BluenaPlanet,
  type CreateMoonWorkBody,
  type HomeReaction,
  type HomecomingView,
  type MoonWorkKind,
  type MoonWorkView,
  type WorkVersion,
} from '@obolo/shared';
import { and, desc, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { apiError } from '../common/errors';
import { dachiOf } from '../common/child';
import { Database } from '../db/db';
import { jupiterPosts, moonWorks, planetPosts, radioShows, saturnPosts, starEvents, users, workHomecomings } from '../db/schema';

type Row = typeof moonWorks.$inferSelect;
/** a flown post that came home (before its reactions are read) */
export type HomeItem = { key: string; targetType: string; id: string; planet: BluenaPlanet; title: string; image: string | null; flownAt: Date };

/** how far back a homecoming is still told (a member away for a while hears about the last week only) */
const TELL_WITHIN_MS = 7 * 86400_000;
const HOME_LIMIT = 5;

/**
 * M-R253: the Moon atelier's works — the tries inside one work and its face (§1), its material (§3), the talk it was
 * made in (§5) — and the reports of flown works that came home (§5). Each try's thing itself stays in its planet's
 * store (the post, the root, the song …); this keeps how they belong together.
 */
@Injectable()
export class MoonWorksService {
  constructor(private readonly db: Database) {}

  async list(userId: string, ids?: string[]): Promise<MoonWorkView[]> {
    const rows = await this.db.read
      .select()
      .from(moonWorks)
      .where(and(eq(moonWorks.userId, userId), isNull(moonWorks.deletedAt), ids?.length ? inArray(moonWorks.id, ids) : undefined))
      .orderBy(desc(moonWorks.createdAt))
      .limit(500);
    return rows.map(view);
  }

  async create(userId: string, b: CreateMoonWorkBody): Promise<MoonWorkView> {
    const [row] = await this.db.write
      .insert(moonWorks)
      .values({ userId, kind: b.kind, versionsJson: [b.version], active: 0, originJson: b.origin ?? null, materialsJson: b.materials })
      .returning();
    return view(row);
  }

  protected async own(userId: string, id: string): Promise<Row> {
    const [row] = await this.db.write
      .select()
      .from(moonWorks)
      .where(and(eq(moonWorks.id, id), eq(moonWorks.userId, userId), isNull(moonWorks.deletedAt)));
    if (!row) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Work not found');
    return row;
  }

  protected async save(id: string, set: Partial<typeof moonWorks.$inferInsert>): Promise<Row> {
    const [row] = await this.db.write
      .update(moonWorks)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(moonWorks.id, id))
      .returning();
    return row;
  }

  /** §1: a redo goes on top of the same work and is its face (returns the tries pushed out past the cap) */
  async addVersion(userId: string, id: string, b: AddVersionBody): Promise<MoonWorkView & { dropped: WorkVersion[] }> {
    const row = await this.own(userId, id);
    const r = addVersion(row.versionsJson, b.version);
    return { ...view(await this.save(id, { versionsJson: r.versions, active: r.active })), dropped: r.dropped };
  }

  /** §1: the try looked at last is the face (Bluena's list, flying it) */
  async setFace(userId: string, id: string, index: number): Promise<MoonWorkView> {
    const row = await this.own(userId, id);
    const active = setFace(row.versionsJson, index);
    if (active === row.active) return view(row);
    return view(await this.save(id, { active }));
  }

  /** §1: a try thrown away inside the work (the app throws its thing away from its store) */
  async dropVersion(userId: string, id: string, index: number): Promise<MoonWorkView & { dropped: WorkVersion }> {
    const row = await this.own(userId, id);
    const r = dropVersion(row.versionsJson, row.active, index);
    if (!r) throw apiError(HttpStatus.BAD_REQUEST, 'LAST_VERSION', 'The last try is the work itself');
    return { ...view(await this.save(id, { versionsJson: r.versions, active: r.active })), dropped: r.dropped };
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.own(userId, id);
    await this.save(id, { deletedAt: new Date() });
  }

  /** for Bluena's list: the stores' items that are another try of a work (hidden), and each face's work */
  async index(userId: string): Promise<{ hidden: Set<string>; faces: Map<string, MoonWorkView> }> {
    const works = await this.list(userId);
    const faces = new Map<string, MoonWorkView>();
    for (const w of works) {
      const f = w.versions[w.active]?.ref;
      if (f) faces.set(`${f.kind}:${f.id}`, w);
    }
    return { hidden: hiddenRefs(works), faces };
  }

  // --- §5: back home after 88 hours ----------------------------------------------------------------------------

  /** the flown works that came home and were not told about yet, with who put a ★ (under 15: the dachi only) */
  async homecomings(userId: string, now = new Date()): Promise<HomecomingView[]> {
    const [items, told, birthYear] = await Promise.all([this.homeItems(userId, now), this.told(userId), this.birthYear(userId)]);
    const fresh = items.filter((x) => !told.has(x.key)).slice(0, HOME_LIMIT);
    if (!fresh.length) return [];
    const stars = await this.reactions(userId, fresh);
    return fresh.map((x) => ({
      key: x.key,
      planet: x.planet,
      title: x.title,
      image: x.image,
      homeAt: new Date(x.flownAt.getTime() + PLANET_FLY_MS).toISOString(),
      ...reactionsFor(birthYear, stars.get(x.key) ?? [], now),
      workId: null,
    }));
  }

  /** said: not told again */
  async markTold(userId: string, keys: string[]): Promise<void> {
    if (!keys.length) return;
    await this.db.write
      .insert(workHomecomings)
      .values(keys.map((key) => ({ userId, key })))
      .onConflictDoNothing();
  }

  protected async told(userId: string): Promise<Set<string>> {
    const rows = await this.db.read.select({ key: workHomecomings.key }).from(workHomecomings).where(eq(workHomecomings.userId, userId)).limit(5000);
    return new Set(rows.map((r) => r.key));
  }

  protected async birthYear(userId: string): Promise<number | null> {
    const [u] = await this.db.read.select({ o: users.onboardingJson }).from(users).where(eq(users.id, userId));
    const y = Number((u?.o as { birthYear?: unknown } | null)?.birthYear);
    return Number.isFinite(y) && y > 0 ? y : null;
  }

  /** what flew and is home now (flown more than 88 h ago, within the last week of homecomings) */
  protected async homeItems(userId: string, now: Date): Promise<HomeItem[]> {
    const home = flyingSince(now);
    const from = new Date(home.getTime() - TELL_WITHIN_MS);
    const win = (col: AnyPgColumn) => and(gt(col, from), lte(col, home));
    const [sat, jup, pp, radio] = await Promise.all([
      this.db.read
        .select()
        .from(saturnPosts)
        .where(and(eq(saturnPosts.userId, userId), eq(saturnPosts.room, 0), isNull(saturnPosts.replyToId), isNull(saturnPosts.deletedAt), win(saturnPosts.createdAt)))
        .limit(50),
      this.db.read
        .select()
        .from(jupiterPosts)
        .where(and(eq(jupiterPosts.userId, userId), isNull(jupiterPosts.deletedAt), win(jupiterPosts.createdAt)))
        .limit(50),
      this.db.read
        .select()
        .from(planetPosts)
        .where(and(eq(planetPosts.userId, userId), isNull(planetPosts.deletedAt), win(planetPosts.createdAt)))
        .limit(50),
      this.db.read
        .select()
        .from(radioShows)
        .where(and(eq(radioShows.userId, userId), eq(radioShows.status, 'public'), isNull(radioShows.deletedAt), win(radioShows.publishedAt)))
        .limit(50),
    ]);
    return [
      ...sat.map((r) => ({ key: `saturn_post:${r.id}`, targetType: 'saturn_post', id: r.id, planet: 'saturn' as const, title: r.text, image: r.photoUrl, flownAt: r.createdAt })),
      ...jup.map((r) => ({ key: `jupiter_post:${r.id}`, targetType: 'jupiter_post', id: r.id, planet: 'jupiter' as const, title: r.text, image: r.url, flownAt: r.createdAt })),
      ...pp.map((r) => ({ key: `planet_post:${r.id}`, targetType: 'planet_post', id: r.id, planet: (r.planet === 'mars' ? 'mars' : 'mercury') as BluenaPlanet, title: r.title, image: r.posterUrl, flownAt: r.createdAt })),
      ...radio.map((r) => ({ key: `radio_show:${r.id}`, targetType: 'radio_show', id: r.id, planet: 'venus' as const, title: r.title, image: r.thumbUrl, flownAt: r.publishedAt! })),
    ].sort((a, b) => a.flownAt.getTime() - b.flownAt.getTime());
  }

  /** the ★ others put on them, and whether each was a dachi (the maker's own ★ does not count) */
  protected async reactions(userId: string, items: HomeItem[]): Promise<Map<string, HomeReaction[]>> {
    const rows = await this.db.read
      .select({
        type: starEvents.targetType,
        id: starEvents.targetId,
        tier: starEvents.tier,
        name: users.displayName,
        dachi: sql<boolean>`${starEvents.userId} IN (${dachiOf(userId)})`,
      })
      .from(starEvents)
      .innerJoin(users, eq(users.id, starEvents.userId))
      .where(
        and(
          inArray(starEvents.targetId, items.map((x) => x.id)),
          sql`${starEvents.userId} <> ${userId}`,
          sql`${starEvents.userId} NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ${userId})`,
        ),
      )
      .limit(2000);
    const out = new Map<string, HomeReaction[]>();
    for (const r of rows) {
      const key = `${r.type}:${r.id}`;
      (out.get(key) ?? out.set(key, []).get(key)!).push({ name: r.name, dachi: !!r.dachi, stars: r.tier });
    }
    return out;
  }
}

function view(r: Row): MoonWorkView {
  return {
    id: r.id,
    kind: r.kind as MoonWorkKind,
    versions: r.versionsJson,
    active: r.active,
    origin: r.originJson ?? null,
    materials: r.materialsJson ?? [],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
