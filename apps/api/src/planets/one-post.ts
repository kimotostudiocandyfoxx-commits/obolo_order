import { and, desc, eq, isNull, ne, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../db/db';
import { jupiterPosts, planetPosts } from '../db/schema';

/**
 * 月で作る → 星, story session 2026-11-27: **one work = one post**. Flying an art, a song or a video again does not make
 * a new post: the work's post is refreshed (what it shows now, its 88 hours from now) — as a kororin, a show, goods, a
 * book and a game always were (one row, its time set again). The posts flown twice before this rule stay where they
 * are (readable on the screens of before); the new homes and the continents show a work once: its newest live post.
 */

/** this Jupiter post is the newest live one of its art (a post with no root is its own work) */
export const newestOfArt: SQL = sql`NOT EXISTS (SELECT 1 FROM jupiter_posts d WHERE d.user_id = ${jupiterPosts.userId} AND d.root_id = ${jupiterPosts.rootId} AND d.deleted_at IS NULL AND (d.created_at, d.id) > (${jupiterPosts.createdAt}, ${jupiterPosts.id}))`;

/** this Mercury / Mars post is the newest live one of its song / video (a post with no source is its own work) */
export const newestOfSource: SQL = sql`NOT EXISTS (SELECT 1 FROM planet_posts d WHERE d.user_id = ${planetPosts.userId} AND d.planet = ${planetPosts.planet} AND d.source_id = ${planetPosts.sourceId} AND d.deleted_at IS NULL AND (d.created_at, d.id) > (${planetPosts.createdAt}, ${planetPosts.id}))`;

/** the post an art flies as: its live one (the newest), else the one taken out last — null when it never flew */
export async function postOfArt(db: Database, userId: string, rootId: string): Promise<typeof jupiterPosts.$inferSelect | null> {
  const rows = await db.write
    .select()
    .from(jupiterPosts)
    .where(and(eq(jupiterPosts.userId, userId), eq(jupiterPosts.rootId, rootId)))
    .orderBy(sql`(${jupiterPosts.deletedAt} IS NULL) DESC`, desc(jupiterPosts.createdAt))
    .limit(1);
  return (Array.isArray(rows) ? rows[0] : null) ?? null;
}

/** the post a song (Mercury) / a 裏スタジオ video (Mars) flies as: its live one (the newest), else the one taken out last */
export async function postOfSource(db: Database, userId: string, planet: string, sourceId: string): Promise<typeof planetPosts.$inferSelect | null> {
  const rows = await db.write
    .select()
    .from(planetPosts)
    .where(and(eq(planetPosts.userId, userId), eq(planetPosts.planet, planet), eq(planetPosts.sourceId, sourceId)))
    .orderBy(sql`(${planetPosts.deletedAt} IS NULL) DESC`, desc(planetPosts.createdAt))
    .limit(1);
  return (Array.isArray(rows) ? rows[0] : null) ?? null;
}

/** 外す: the other live posts of the same work (flown twice before the rule) leave the planet with it */
export async function takeOutTwinsOfArt(db: Database, userId: string, post: { id: string; rootId: string | null }): Promise<void> {
  if (!post.rootId) return;
  await db.write
    .update(jupiterPosts)
    .set({ deletedAt: new Date() })
    .where(and(eq(jupiterPosts.userId, userId), eq(jupiterPosts.rootId, post.rootId), ne(jupiterPosts.id, post.id), isNull(jupiterPosts.deletedAt)));
}
export async function takeOutTwinsOfSource(db: Database, userId: string, post: { id: string; planet: string; sourceId: string | null }): Promise<void> {
  if (!post.sourceId) return;
  await db.write
    .update(planetPosts)
    .set({ deletedAt: new Date() })
    .where(and(eq(planetPosts.userId, userId), eq(planetPosts.planet, post.planet), eq(planetPosts.sourceId, post.sourceId), ne(planetPosts.id, post.id), isNull(planetPosts.deletedAt)));
}
