import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { LlmProvider, moderateText } from '@obolo/ai';
import type { CreateSaturnPostBody, Paged, SaturnPostView } from '@obolo/shared';
import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { decodeCursor, encodeCursor } from '../common/cursor';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { saturnPosts, starEvents, users } from '../db/schema';
import { LLM } from '../infra/tokens';
import { MediaService } from '../media/media.service';

@Injectable()
export class SaturnService {
  constructor(
    private readonly db: Database,
    private readonly media: MediaService,
    @Inject(LLM) private readonly llm: LlmProvider,
  ) {}

  /** Global timeline (newest first). PLACEHOLDER (P-SAT-2): following graph / ranking not built. */
  async feed(viewerId: string, cursor?: string, limit = 20, fresh = false): Promise<Paged<SaturnPostView>> {
    const c = decodeCursor(cursor);
    const db = fresh ? this.db.write : this.db.read;
    const rows = await db
      .select({ p: saturnPosts, u: { id: users.id, handle: users.handle, displayName: users.displayName, neoForm: users.neoForm } })
      .from(saturnPosts)
      .innerJoin(users, eq(users.id, saturnPosts.userId))
      .where(
        and(
          isNull(saturnPosts.deletedAt),
          c
            ? or(lt(saturnPosts.createdAt, new Date(c.t)), and(eq(saturnPosts.createdAt, new Date(c.t)), lt(saturnPosts.id, c.id)))
            : undefined,
        ),
      )
      .orderBy(desc(saturnPosts.createdAt), desc(saturnPosts.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const ids = page.map((r) => r.p.id);
    const mine = ids.length
      ? await db
          .select({ targetId: starEvents.targetId })
          .from(starEvents)
          .where(and(eq(starEvents.userId, viewerId), eq(starEvents.targetType, 'saturn_post'), inArray(starEvents.targetId, ids)))
      : [];
    const starred = new Set(mine.map((s) => s.targetId));
    const last = page[page.length - 1];
    return {
      items: page.map(({ p, u }) => this.toView(p, u, starred.has(p.id))),
      nextCursor: rows.length > limit && last ? encodeCursor({ t: last.p.createdAt.toISOString(), id: last.p.id }) : null,
    };
  }

  private toView(
    p: typeof saturnPosts.$inferSelect,
    u: { id: string; handle: string; displayName: string; neoForm?: string | null },
    starredByMe: boolean,
  ): SaturnPostView {
    return {
      id: p.id,
      author: u,
      text: p.text,
      voiceUrl: p.voiceAudioUrl,
      voiceSource: p.voiceSource as SaturnPostView['voiceSource'],
      voiceDurationSec: p.voiceDurationSec,
      starCount: p.starCount,
      starredByMe,
      createdAt: p.createdAt.toISOString(),
    };
  }

  async create(userId: string, body: CreateSaturnPostBody): Promise<SaturnPostView> {
    const media = await this.media.getOwned(userId, body.voiceMediaId, 'voice');
    if (!media) throw apiError(HttpStatus.BAD_REQUEST, 'VOICE_REQUIRED', 'Record your voice before posting');
    const mod = await moderateText(body.text, this.llm);
    if (mod.flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'This post breaks the community rules');
    const [p] = await this.db.write
      .insert(saturnPosts)
      .values({
        userId,
        text: body.text,
        voiceMediaId: media.id,
        voiceAudioUrl: media.url,
        voiceSource: 'recorded',
        voiceDurationSec: body.voiceDurationSec ?? null,
      })
      .returning();
    const [u] = await this.db.write
      .select({ id: users.id, handle: users.handle, displayName: users.displayName, neoForm: users.neoForm })
      .from(users)
      .where(eq(users.id, userId));
    return this.toView(p, u, false);
  }

  async remove(userId: string, postId: string): Promise<void> {
    const res = await this.db.write
      .update(saturnPosts)
      .set({ deletedAt: new Date() })
      .where(and(eq(saturnPosts.id, postId), eq(saturnPosts.userId, userId), isNull(saturnPosts.deletedAt)))
      .returning({ id: saturnPosts.id });
    if (!res.length) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Post not found');
  }

  async setStar(userId: string, postId: string, on: boolean): Promise<{ starCount: number; starredByMe: boolean }> {
    return this.db.write.transaction(async (tx) => {
      const [post] = await tx
        .select({ id: saturnPosts.id })
        .from(saturnPosts)
        .where(and(eq(saturnPosts.id, postId), isNull(saturnPosts.deletedAt)));
      if (!post) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Post not found');
      let delta = 0;
      if (on) {
        const ins = await tx
          .insert(starEvents)
          .values({ userId, targetType: 'saturn_post', targetId: postId, tier: 1 })
          .onConflictDoNothing()
          .returning({ id: starEvents.id });
        delta = ins.length;
      } else {
        const del = await tx
          .delete(starEvents)
          .where(and(eq(starEvents.userId, userId), eq(starEvents.targetType, 'saturn_post'), eq(starEvents.targetId, postId)))
          .returning({ id: starEvents.id });
        delta = -del.length;
      }
      const [p] = await tx
        .update(saturnPosts)
        .set({ starCount: sql`GREATEST(${saturnPosts.starCount} + ${delta}, 0)` })
        .where(eq(saturnPosts.id, postId))
        .returning({ starCount: saturnPosts.starCount });
      return { starCount: p.starCount, starredByMe: on };
    });
  }
}
