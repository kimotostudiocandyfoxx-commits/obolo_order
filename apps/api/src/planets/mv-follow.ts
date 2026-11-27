import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Database } from '../db/db';
import { planetPosts } from '../db/schema';

/**
 * 月で作る → 星, story session 2026-11-27: an MV made again on the Moon — its scenes repainted, its cut changed, the
 * lyrics put on — is the same MV on Mars (as a changed song is the same song on Mercury: song-follow.ts). A flown post
 * keeps its own copy of the film (taken when it flew); without this Mars went on showing the film of before. Every live
 * Mars post of the MV (flown from its 裏スタジオ entry of before, or showing one of its films of before) shows the film
 * of now and belongs to its entry of now — so the new film is 「星にいる」 in Bluena and flies as the same post (one work
 * = one post). Its title, its words, its 88 hours and its ★ stay. Never fails the making itself.
 */
export async function followMv(
  db: Database,
  userId: string,
  before: { backstageId?: string | null; urls: (string | null | undefined)[] },
  now: { backstageId: string | null; url: string; posterUrl: string | null; seconds: number | null },
): Promise<void> {
  const urls = before.urls.filter((u): u is string => !!u);
  const was = or(before.backstageId ? eq(planetPosts.sourceId, before.backstageId) : undefined, urls.length ? inArray(planetPosts.url, urls) : undefined);
  if (!was) return;
  try {
    await db.write
      .update(planetPosts)
      .set({ url: now.url, posterUrl: now.posterUrl, seconds: now.seconds, ...(now.backstageId ? { sourceId: now.backstageId } : {}), updatedAt: new Date() })
      .where(and(eq(planetPosts.userId, userId), eq(planetPosts.planet, 'mars'), eq(planetPosts.kind, 'video'), isNull(planetPosts.deletedAt), was, sql`${planetPosts.url} IS DISTINCT FROM ${now.url}`));
  } catch {
    /* the MV itself is made; its post follows at the next making */
  }
}
