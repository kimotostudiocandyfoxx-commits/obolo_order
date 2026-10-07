import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { LlmProvider, moderateText } from '@obolo/ai';
import { neoVoiceUrl, SATURN_LIFETIME_HOURS, type CreateSaturnPostBody, type PuniLook, type Paged, type SaturnPostRef, type SaturnPostView, type SaturnProfileView } from '@obolo/shared';
import { and, asc, count, desc, eq, gt, inArray, isNull, lt, or, sql, sum, type SQL } from 'drizzle-orm';
import { decodeCursor, encodeCursor } from '../common/cursor';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { follows, saturnPosts, starEvents, users } from '../db/schema';
import { LLM } from '../infra/tokens';
import { MediaService } from '../media/media.service';
import { VoiceService } from '../voice/voice.service';

type PostRow = typeof saturnPosts.$inferSelect;
type Author = { id: string; handle: string; displayName: string; neoForm?: string | null; look?: PuniLook | null; pic?: string | null };

const authorCols = { id: users.id, handle: users.handle, displayName: users.displayName, neoForm: users.neoForm, look: users.lookJson, pic: users.puniPicUrl };

const alive = () => gt(saturnPosts.createdAt, new Date(Date.now() - SATURN_LIFETIME_HOURS * 3600_000));

@Injectable()
export class SaturnService {
  constructor(
    private readonly db: Database,
    private readonly media: MediaService,
    @Inject(LLM) private readonly llm: LlmProvider,
    private readonly voices: VoiceService,
  ) {}

  /**
   * Timeline (newest first), replies left out (they live under their post). Tabs (every planet,
   * client decision 2026-10-07): みんな = everyone, フォロー = people the viewer follows (and the
   * viewer), ダチ = mutual follows only. PLACEHOLDER (P-SAT-2): ranking.
   */
  async feed(viewerId: string, cursor?: string, limit = 20, fresh = false, tab: 'all' | 'following' | 'friends' = 'all'): Promise<Paged<SaturnPostView>> {
    const scope =
      tab === 'following'
        ? sql`(${saturnPosts.userId} IN (SELECT ${follows.followeeId} FROM ${follows} WHERE ${follows.followerId} = ${viewerId}) OR ${saturnPosts.userId} = ${viewerId})`
        : tab === 'friends'
          ? sql`${saturnPosts.userId} IN (SELECT f.followee_id FROM follows f JOIN follows g ON g.follower_id = f.followee_id AND g.followee_id = f.follower_id WHERE f.follower_id = ${viewerId})`
          : undefined;
    return this.page(viewerId, and(isNull(saturnPosts.replyToId), alive(), scope), cursor, limit, fresh);
  }

  /** Someone's posts (their page), replies left out. */
  async userPosts(viewerId: string, userId: string, cursor?: string, limit = 30): Promise<Paged<SaturnPostView>> {
    return this.page(viewerId, and(eq(saturnPosts.userId, userId), isNull(saturnPosts.replyToId), alive()), cursor, limit, true);
  }

  /** The voice replies under a post, oldest first (they line up as little balls under it). */
  async replies(viewerId: string, postId: string): Promise<SaturnPostView[]> {
    const rows = await this.db.read
      .select({ p: saturnPosts, u: authorCols })
      .from(saturnPosts)
      .innerJoin(users, eq(users.id, saturnPosts.userId))
      .where(and(eq(saturnPosts.replyToId, postId), isNull(saturnPosts.deletedAt)))
      .orderBy(asc(saturnPosts.createdAt), asc(saturnPosts.id))
      .limit(60);
    return this.views(viewerId, rows, this.db.read);
  }

  private async page(viewerId: string, where: SQL | undefined, cursor: string | undefined, limit: number, fresh: boolean): Promise<Paged<SaturnPostView>> {
    const c = decodeCursor(cursor);
    const db = fresh ? this.db.write : this.db.read;
    const rows = await db
      .select({ p: saturnPosts, u: authorCols })
      .from(saturnPosts)
      .innerJoin(users, eq(users.id, saturnPosts.userId))
      .where(
        and(
          isNull(saturnPosts.deletedAt),
          where,
          c ? or(lt(saturnPosts.createdAt, new Date(c.t)), and(eq(saturnPosts.createdAt, new Date(c.t)), lt(saturnPosts.id, c.id))) : undefined,
        ),
      )
      .orderBy(desc(saturnPosts.createdAt), desc(saturnPosts.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: await this.views(viewerId, page, db),
      nextCursor: rows.length > limit && last ? encodeCursor({ t: last.p.createdAt.toISOString(), id: last.p.id }) : null,
    };
  }

  /** Rows → views with the viewer's stars and the quoted posts filled in. */
  private async views(viewerId: string, rows: { p: PostRow; u: Author }[], db: Database['read']): Promise<SaturnPostView[]> {
    const ids = rows.map((r) => r.p.id);
    const mine = ids.length
      ? await db
          .select({ targetId: starEvents.targetId })
          .from(starEvents)
          .where(and(eq(starEvents.userId, viewerId), eq(starEvents.targetType, 'saturn_post'), inArray(starEvents.targetId, ids)))
      : [];
    const starred = new Set(mine.map((s) => s.targetId));
    const quoted = await this.refs(
      db,
      rows.map((r) => r.p.repostOfId).filter((x): x is string => !!x),
    );
    return rows.map(({ p, u }) => this.toView(p, u, starred.has(p.id), p.repostOfId ? (quoted.get(p.repostOfId) ?? null) : null));
  }

  private async refs(db: Database['read'], ids: string[]): Promise<Map<string, SaturnPostRef>> {
    if (!ids.length) return new Map();
    const rows = await db
      .select({ p: { id: saturnPosts.id, text: saturnPosts.text, voiceUrl: saturnPosts.voiceAudioUrl }, u: authorCols })
      .from(saturnPosts)
      .innerJoin(users, eq(users.id, saturnPosts.userId))
      .where(and(inArray(saturnPosts.id, [...new Set(ids)]), isNull(saturnPosts.deletedAt)));
    return new Map(rows.map(({ p, u }) => [p.id, { id: p.id, author: u, text: p.text, voiceUrl: p.voiceUrl }]));
  }

  private toView(p: PostRow, u: Author, starredByMe: boolean, repostOf: SaturnPostRef | null = null): SaturnPostView {
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
      replyToId: p.replyToId,
      replyCount: p.replyCount,
      repostCount: p.repostCount,
      repostOf,
    };
  }

  async create(userId: string, body: CreateSaturnPostBody, origin: string): Promise<SaturnPostView> {
    if (body.replyToId && body.repostOfId) throw apiError(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', 'A post is either a reply or a repost');
    const [author] = await this.db.write.select(authorCols).from(users).where(eq(users.id, userId));
    // the post answered / quoted must exist (a reply to a reply is filed under the first post)
    let replyToId: string | null = null;
    let repostOf: SaturnPostRef | null = null;
    if (body.replyToId) {
      const [t] = await this.db.write.select({ id: saturnPosts.id, replyToId: saturnPosts.replyToId }).from(saturnPosts).where(and(eq(saturnPosts.id, body.replyToId), isNull(saturnPosts.deletedAt)));
      if (!t) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Post not found');
      replyToId = t.replyToId ?? t.id;
    }
    if (body.repostOfId) {
      const [t] = await this.db.write.select({ id: saturnPosts.id, repostOfId: saturnPosts.repostOfId }).from(saturnPosts).where(and(eq(saturnPosts.id, body.repostOfId), isNull(saturnPosts.deletedAt)));
      if (!t) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Post not found');
      // quoting a quote points at the original (one level only)
      repostOf = (await this.refs(this.db.write, [t.repostOfId ?? t.id])).get(t.repostOfId ?? t.id) ?? null;
      if (!repostOf) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Post not found');
    }
    // check the words first: a flagged post must not cost a voice generation
    const mod = await moderateText(body.text, this.llm);
    if (mod.flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'This post breaks the community rules');
    let voice: { mediaId: string | null; url: string; source: 'recorded' | 'cloned' | 'default' };
    if (body.readBy === 'bati' && body.voiceStyle) {
      // Bati reads every post (client decision 2026-10-07): the registered Bati voice, the shared
      // default voice, or — when neither exists — the device's reading voice (P-SAT-8)
      const v = await this.voices.readByBati(userId, { text: body.text, style: body.voiceStyle }, origin);
      voice = v ? { mediaId: null, url: v.url, source: 'cloned' } : { mediaId: null, url: neoVoiceUrl(body.voiceStyle, author?.neoForm, body.text), source: 'default' };
    } else if (body.ownVoice && body.voiceStyle) {
      // the member's own registered voice, read in the chosen style (P-SAT-5)
      const v = await this.voices.readAloud(userId, { slot: 'self', text: body.text, style: body.voiceStyle }, origin);
      voice = { mediaId: null, url: v.url, source: 'cloned' };
    } else if (body.voiceMediaId) {
      const media = await this.media.getOwned(userId, body.voiceMediaId, 'voice');
      if (!media) throw apiError(HttpStatus.BAD_REQUEST, 'VOICE_REQUIRED', 'Record your voice before posting');
      voice = { mediaId: media.id, url: media.url, source: 'recorded' };
    } else {
      // NEO voice (P-VOICE-1): read aloud on the device today; later rendered server-side to audio.
      voice = { mediaId: null, url: neoVoiceUrl(body.voiceStyle!, author?.neoForm, body.text), source: 'default' };
    }
    const p = await this.db.write.transaction(async (tx) => {
      const [row] = await tx
        .insert(saturnPosts)
        .values({
          userId,
          text: body.text,
          voiceMediaId: voice.mediaId,
          voiceAudioUrl: voice.url,
          voiceSource: voice.source,
          voiceDurationSec: body.voiceDurationSec ?? null,
          replyToId,
          repostOfId: repostOf?.id ?? null,
        })
        .returning();
      if (replyToId) await tx.update(saturnPosts).set({ replyCount: sql`${saturnPosts.replyCount} + 1` }).where(eq(saturnPosts.id, replyToId));
      if (repostOf) await tx.update(saturnPosts).set({ repostCount: sql`${saturnPosts.repostCount} + 1` }).where(eq(saturnPosts.id, repostOf.id));
      return row;
    });
    return this.toView(p, author, false, repostOf);
  }

  async remove(userId: string, postId: string): Promise<void> {
    const res = await this.db.write
      .update(saturnPosts)
      .set({ deletedAt: new Date() })
      .where(and(eq(saturnPosts.id, postId), eq(saturnPosts.userId, userId), isNull(saturnPosts.deletedAt)))
      .returning({ id: saturnPosts.id, replyToId: saturnPosts.replyToId, repostOfId: saturnPosts.repostOfId });
    if (!res.length) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Post not found');
    const { replyToId, repostOfId } = res[0];
    if (replyToId) await this.db.write.update(saturnPosts).set({ replyCount: sql`GREATEST(${saturnPosts.replyCount} - 1, 0)` }).where(eq(saturnPosts.id, replyToId));
    if (repostOfId) await this.db.write.update(saturnPosts).set({ repostCount: sql`GREATEST(${saturnPosts.repostCount} - 1, 0)` }).where(eq(saturnPosts.id, repostOfId));
  }

  // --- profiles & follows -------------------------------------------------------------------------

  async profile(viewerId: string, userId: string): Promise<SaturnProfileView> {
    const [u] = await this.db.read.select({ ...authorCols, bio: users.bio }).from(users).where(and(eq(users.id, userId), isNull(users.deletedAt)));
    if (!u) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found');
    const [[posts], [followers], [following], [mine]] = await Promise.all([
      this.db.read
        .select({ n: count(), stars: sum(saturnPosts.starCount) })
        .from(saturnPosts)
        .where(and(eq(saturnPosts.userId, userId), isNull(saturnPosts.replyToId), isNull(saturnPosts.deletedAt), alive())),
      this.db.read.select({ n: count() }).from(follows).where(eq(follows.followeeId, userId)),
      this.db.read.select({ n: count() }).from(follows).where(eq(follows.followerId, userId)),
      this.db.read.select({ n: count() }).from(follows).where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, userId))),
    ]);
    return {
      user: u,
      postCount: posts?.n ?? 0,
      stars: Number(posts?.stars ?? 0),
      followers: followers?.n ?? 0,
      following: following?.n ?? 0,
      followedByMe: (mine?.n ?? 0) > 0,
      isMe: viewerId === userId,
    };
  }

  async follow(viewerId: string, userId: string, on: boolean): Promise<SaturnProfileView> {
    if (viewerId === userId) throw apiError(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', 'You cannot follow yourself');
    const [u] = await this.db.write.select({ id: users.id }).from(users).where(and(eq(users.id, userId), isNull(users.deletedAt)));
    if (!u) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found');
    if (on) await this.db.write.insert(follows).values({ followerId: viewerId, followeeId: userId }).onConflictDoNothing();
    else await this.db.write.delete(follows).where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, userId)));
    return this.profile(viewerId, userId);
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
