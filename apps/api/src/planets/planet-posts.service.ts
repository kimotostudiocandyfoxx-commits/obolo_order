import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { LlmProvider, moderateText } from '@obolo/ai';
import {
  MARS_VIDEO_SECONDS,
  type CreatePlanetPostBody,
  type PlanetAuthor,
  type PlanetFlyer,
  type PlanetPostView,
  type PlanetProfileView,
  type PlanetReplyView,
  type TimelinePlanet,
} from '@obolo/shared';
import { and, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { follows, marsBackstage, mvProjects, planetPosts, planetReplies, songs, starEvents, users } from '../db/schema';
import { LLM } from '../infra/tokens';
import { MediaService } from '../media/media.service';

type PostRow = typeof planetPosts.$inferSelect;

const authorCols = { id: users.id, handle: users.handle, displayName: users.displayName, neoForm: users.neoForm, pic: users.puniPicUrl };
const FLY_HOURS = 88;
const since = () => new Date(Date.now() - FLY_HOURS * 3600_000);

/**
 * Mercury & Mars timelines (client decision 2026-10-07): they work like Saturn and Jupiter.
 *  - post: Mercury = one of your songs (made with Bati), Mars = one of your 裏スタジオ videos,
 *    cut to a square (made with Bati)
 *  - 88 hours on the timelines (みんな / フォロー / ダチ, one ship / UFO per person), then it stays
 *    on your island (Mercury) / studio (Mars)
 *  - ☆ and replies; no counts are ever sent (client rule: nobody is measured by numbers)
 */
@Injectable()
export class PlanetPostsService {
  constructor(
    private readonly db: Database,
    private readonly media: MediaService,
    @Inject(LLM) private readonly llm: LlmProvider,
  ) {}

  async create(userId: string, planet: TimelinePlanet, body: CreatePlanetPostBody, origin: string): Promise<PlanetPostView> {
    if (body.text) {
      const mod = await moderateText(`${body.title ?? ''} ${body.text}`, this.llm);
      if (mod.flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'This post breaks the community rules');
    }
    let values: typeof planetPosts.$inferInsert;
    if (planet === 'mercury') {
      const [s] = await this.db.write
        .select()
        .from(songs)
        .where(and(eq(songs.id, body.sourceId), eq(songs.userId, userId), isNull(songs.deletedAt)));
      if (!s) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Song not found');
      values = { planet, userId, kind: 'song', sourceId: s.id, title: body.title || s.title, text: body.text, url: s.mixUrl, seconds: s.seconds };
    } else {
      const [v] = await this.db.write
        .select()
        .from(marsBackstage)
        .where(and(eq(marsBackstage.id, body.sourceId), eq(marsBackstage.userId, userId), isNull(marsBackstage.deletedAt)));
      if (!v) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Pick a video from your 裏スタジオ');
      // an MV Bati made is already square and may fly for the whole song (MV_MAX_SECONDS)
      const [mv] = await this.db.write
        .select({ id: mvProjects.id })
        .from(mvProjects)
        .where(and(eq(mvProjects.userId, userId), or(eq(mvProjects.videoUrl, v.url), eq(mvProjects.lyricsVideoUrl, v.url))))
        .limit(1);
      // other Mars posts are square: a centre-cropped copy; the original stays in the 裏スタジオ
      const sq = mv ? { url: v.url, posterUrl: v.posterUrl, seconds: v.seconds } : await this.media.squareCopy(userId, v.url, MARS_VIDEO_SECONDS, origin);
      values = { planet, userId, kind: 'video', sourceId: v.id, title: body.title || v.title || '', text: body.text, url: sq.url, posterUrl: sq.posterUrl, seconds: sq.seconds };
    }
    const [p] = await this.db.write.insert(planetPosts).values(values).returning();
    const [author] = await this.db.write.select(authorCols).from(users).where(eq(users.id, userId));
    return this.toView(p, author, false, []);
  }

  async remove(userId: string, postId: string): Promise<void> {
    const res = await this.db.write
      .update(planetPosts)
      .set({ deletedAt: new Date() })
      .where(and(eq(planetPosts.id, postId), eq(planetPosts.userId, userId), isNull(planetPosts.deletedAt)))
      .returning({ id: planetPosts.id });
    if (!res.length) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
  }

  /** The timeline: everyone with posts in the last 88 hours, one ship / UFO per person, newest first. */
  async sky(viewerId: string, planet: TimelinePlanet, tab: 'all' | 'following' | 'friends'): Promise<PlanetFlyer[]> {
    const scope =
      tab === 'following'
        ? sql`(${planetPosts.userId} IN (SELECT ${follows.followeeId} FROM ${follows} WHERE ${follows.followerId} = ${viewerId}) OR ${planetPosts.userId} = ${viewerId})`
        : tab === 'friends'
          ? sql`${planetPosts.userId} IN (SELECT f.followee_id FROM follows f JOIN follows g ON g.follower_id = f.followee_id AND g.followee_id = f.follower_id WHERE f.follower_id = ${viewerId})`
          : undefined;
    const rows = await this.db.read
      .select({ p: planetPosts, u: authorCols })
      .from(planetPosts)
      .innerJoin(users, eq(users.id, planetPosts.userId))
      .where(and(eq(planetPosts.planet, planet), isNull(planetPosts.deletedAt), isNull(users.deletedAt), gt(planetPosts.createdAt, since()), scope))
      .orderBy(desc(planetPosts.createdAt))
      .limit(300);
    const views = await this.views(viewerId, rows);
    const by = new Map<string, PlanetFlyer>();
    for (const v of views) {
      const f = by.get(v.author.id) ?? { author: v.author, posts: [] };
      if (f.posts.length < 20) f.posts.push(v);
      by.set(v.author.id, f);
    }
    return [...by.values()].slice(0, 40);
  }

  async profile(viewerId: string, planet: TimelinePlanet, userId: string): Promise<PlanetProfileView> {
    const [u] = await this.db.read
      .select(authorCols)
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));
    if (!u) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found');
    const [rows, [mine]] = await Promise.all([
      this.db.read
        .select({ p: planetPosts, u: authorCols })
        .from(planetPosts)
        .innerJoin(users, eq(users.id, planetPosts.userId))
        .where(and(eq(planetPosts.planet, planet), eq(planetPosts.userId, userId), isNull(planetPosts.deletedAt)))
        .orderBy(desc(planetPosts.createdAt))
        .limit(120),
      this.db.read
        .select({ n: sql<number>`count(*)` })
        .from(follows)
        .where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, userId))),
    ]);
    const views = await this.views(viewerId, rows);
    const cut = since();
    return {
      author: u,
      flying: views.filter((v) => new Date(v.createdAt) > cut),
      works: views.filter((v) => new Date(v.createdAt) <= cut),
      followedByMe: Number(mine?.n ?? 0) > 0,
      isMe: viewerId === userId,
    };
  }

  async setStar(userId: string, postId: string, on: boolean): Promise<{ starredByMe: boolean }> {
    await this.db.write.transaction(async (tx) => {
      const [post] = await tx
        .select({ id: planetPosts.id })
        .from(planetPosts)
        .where(and(eq(planetPosts.id, postId), isNull(planetPosts.deletedAt)));
      if (!post) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Post not found');
      const delta = on
        ? (await tx.insert(starEvents).values({ userId, targetType: 'planet_post', targetId: postId, tier: 1 }).onConflictDoNothing().returning({ id: starEvents.id })).length
        : -(
            await tx
              .delete(starEvents)
              .where(and(eq(starEvents.userId, userId), eq(starEvents.targetType, 'planet_post'), eq(starEvents.targetId, postId)))
              .returning({ id: starEvents.id })
          ).length;
      if (delta)
        await tx
          .update(planetPosts)
          .set({ starCount: sql`GREATEST(${planetPosts.starCount} + ${delta}, 0)` })
          .where(eq(planetPosts.id, postId));
    });
    return { starredByMe: on };
  }

  async replies(postId: string): Promise<PlanetReplyView[]> {
    const rows = await this.db.read
      .select({ r: planetReplies, u: authorCols })
      .from(planetReplies)
      .innerJoin(users, eq(users.id, planetReplies.userId))
      .where(and(eq(planetReplies.postId, postId), isNull(planetReplies.deletedAt)))
      .orderBy(planetReplies.createdAt)
      .limit(200);
    return rows.map(({ r, u }) => ({ id: r.id, author: u, text: r.text, createdAt: r.createdAt.toISOString() }));
  }

  async reply(userId: string, postId: string, text: string): Promise<PlanetReplyView> {
    const [post] = await this.db.write
      .select({ id: planetPosts.id })
      .from(planetPosts)
      .where(and(eq(planetPosts.id, postId), isNull(planetPosts.deletedAt)));
    if (!post) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Post not found');
    const mod = await moderateText(text, this.llm);
    if (mod.flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'This reply breaks the community rules');
    const r = await this.db.write.transaction(async (tx) => {
      const [row] = await tx.insert(planetReplies).values({ postId, userId, text }).returning();
      await tx
        .update(planetPosts)
        .set({ replyCount: sql`${planetPosts.replyCount} + 1` })
        .where(eq(planetPosts.id, postId));
      return row;
    });
    const [author] = await this.db.write.select(authorCols).from(users).where(eq(users.id, userId));
    return { id: r.id, author, text: r.text, createdAt: r.createdAt.toISOString() };
  }

  private async views(viewerId: string, rows: { p: PostRow; u: PlanetAuthor }[]): Promise<PlanetPostView[]> {
    const ids = rows.map((r) => r.p.id);
    const mine = ids.length
      ? await this.db.read
          .select({ id: starEvents.targetId })
          .from(starEvents)
          .where(and(eq(starEvents.userId, viewerId), eq(starEvents.targetType, 'planet_post'), inArray(starEvents.targetId, ids)))
      : [];
    const starred = new Set(mine.map((m) => m.id));
    const withReplies = rows.filter((r) => r.p.replyCount > 0).map((r) => r.p.id);
    const recent = withReplies.length
      ? await this.db.read
          .select({ postId: planetReplies.postId, u: authorCols })
          .from(planetReplies)
          .innerJoin(users, eq(users.id, planetReplies.userId))
          .where(and(inArray(planetReplies.postId, withReplies), isNull(planetReplies.deletedAt)))
          .orderBy(desc(planetReplies.createdAt))
          .limit(Math.min(400, withReplies.length * 12))
      : [];
    const repliers = new Map<string, PlanetAuthor[]>();
    for (const r of recent) {
      const list = repliers.get(r.postId) ?? [];
      if (list.length < 3 && !list.some((a) => a.id === r.u.id)) list.push(r.u);
      repliers.set(r.postId, list);
    }
    return rows.map(({ p, u }) => this.toView(p, u, starred.has(p.id), repliers.get(p.id) ?? []));
  }

  private toView(p: PostRow, u: PlanetAuthor, starredByMe: boolean, repliers: PlanetAuthor[]): PlanetPostView {
    return {
      id: p.id,
      planet: p.planet as TimelinePlanet,
      author: u,
      kind: p.kind as 'song' | 'video',
      title: p.title,
      text: p.text,
      url: p.url,
      posterUrl: p.posterUrl,
      seconds: p.seconds,
      starredByMe,
      repliers,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
