import { and, eq, isNull, or, sql } from 'drizzle-orm';
import type { Database } from '../db/db';
import { planetPosts } from '../db/schema';

/**
 * M-R326 audit (月で作る → 星): a song changed on the Moon after it flew — sung again in the maker's own voice, a line
 * changed, a tweak — is the same song on Mercury. A flown post keeps its own copy of the song's sound and length (taken
 * when it flew), while its lyrics' times are read from the song: without this the planet played the old sound under
 * the new words. Every live Mercury post of the song follows its sound of now. Never fails the change itself.
 */
export async function followSong(db: Database, song: { id: string; userId: string; mixUrl: string | null; seconds: number | null } | null | undefined): Promise<void> {
  if (!song?.mixUrl) return;
  try {
    await db.write
      .update(planetPosts)
      .set({ url: song.mixUrl, seconds: song.seconds, updatedAt: new Date() })
      .where(
        and(
          eq(planetPosts.sourceId, song.id),
          eq(planetPosts.userId, song.userId),
          eq(planetPosts.kind, 'song'),
          isNull(planetPosts.deletedAt),
          or(sql`${planetPosts.url} IS DISTINCT FROM ${song.mixUrl}`, sql`${planetPosts.seconds} IS DISTINCT FROM ${song.seconds}`),
        ),
      );
  } catch {
    /* the song itself is saved; its posts follow at the next change */
  }
}
