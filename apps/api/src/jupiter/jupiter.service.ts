import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { LlmProvider, moderateText } from '@obolo/ai';
import {
  JUPITER_DEFAULT_BRANCHES,
  JUPITER_FLY_HOURS,
  type CreateJupiterPostBody,
  type JupiterAuthor,
  type JupiterFlyer,
  type JupiterPostView,
  type JupiterRootBody,
  type JupiterRootView,
  type JupiterTreeView,
} from '@obolo/shared';
import { and, count, desc, eq, gt, ilike, inArray, isNull, or, sql, sum } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { follows, jupiterPosts, jupiterRoots, mediaObjects, starEvents, users } from '../db/schema';
import { LLM } from '../infra/tokens';

type PostRow = typeof jupiterPosts.$inferSelect;

const authorCols = { id: users.id, handle: users.handle, displayName: users.displayName, neoForm: users.neoForm, butterfly: users.butterflyUrl, pic: users.puniPicUrl };
const flyingSince = () => new Date(Date.now() - JUPITER_FLY_HOURS * 3600_000);

/**
 * Jupiter — パタパタ (client design 2026-10-05, docs/jupiter.md).
 *  - 根っこ: your private folder; every photo lands here first (videos live in Mars's 裏スタジオ —
 *    photos on Jupiter, videos on Mars, client decision 2026-10-07)
 *  - a post is made from a root item; it flies as a butterfly for 88 hours (the sky), then hangs
 *    on its branch of your tree as a leaf
 *  - the sky's tabs (every planet): みんな / フォロー / ダチ — one butterfly per person
 *  - follows are the platform-wide graph (the same as Saturn's)
 */
@Injectable()
export class JupiterService {
  constructor(
    private readonly db: Database,
    @Inject(LLM) private readonly llm: LlmProvider,
  ) {}

  // --- 根っこ ------------------------------------------------------------------------------------

  async roots(userId: string): Promise<JupiterRootView[]> {
    const rows = await this.db.read
      .select()
      .from(jupiterRoots)
      .where(and(eq(jupiterRoots.userId, userId), isNull(jupiterRoots.deletedAt)))
      .orderBy(desc(jupiterRoots.createdAt))
      .limit(300);
    return rows.map((r) => ({ id: r.id, kind: r.kind as 'photo' | 'video', url: r.url, posterUrl: r.posterUrl, createdAt: r.createdAt.toISOString() }));
  }

  /** A photo upload (POST /media/photo) goes into your roots. Videos live in Mars's 裏スタジオ. */
  async addRoot(userId: string, body: JupiterRootBody): Promise<JupiterRootView> {
    const [m] = await this.db.write
      .select({ id: mediaObjects.id, url: mediaObjects.url, kind: mediaObjects.kind })
      .from(mediaObjects)
      .where(and(eq(mediaObjects.id, body.mediaId), eq(mediaObjects.userId, userId), isNull(mediaObjects.deletedAt)));
    if (m?.kind === 'video') throw apiError(HttpStatus.BAD_REQUEST, 'VIDEO_GOES_TO_MARS', 'Videos are kept in the Mars backstage studio');
    if (!m || m.kind !== 'photo') throw apiError(HttpStatus.BAD_REQUEST, 'MEDIA_NOT_FOUND', 'Upload the photo first');
    const [r] = await this.db.write.insert(jupiterRoots).values({ userId, mediaId: m.id, kind: 'photo', url: m.url }).returning();
    return { id: r.id, kind: 'photo', url: r.url, posterUrl: null, createdAt: r.createdAt.toISOString() };
  }

  async removeRoot(userId: string, rootId: string): Promise<void> {
    const res = await this.db.write
      .update(jupiterRoots)
      .set({ deletedAt: new Date() })
      .where(and(eq(jupiterRoots.id, rootId), eq(jupiterRoots.userId, userId), isNull(jupiterRoots.deletedAt)))
      .returning({ id: jupiterRoots.id });
    if (!res.length) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
  }

  // --- posts -------------------------------------------------------------------------------------

  async create(userId: string, body: CreateJupiterPostBody): Promise<JupiterPostView> {
    const [root] = await this.db.write
      .select()
      .from(jupiterRoots)
      .where(and(eq(jupiterRoots.id, body.rootId), eq(jupiterRoots.userId, userId), isNull(jupiterRoots.deletedAt)));
    if (!root) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Pick something from your roots');
    if (body.text) {
      const mod = await moderateText(body.text, this.llm);
      if (mod.flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'This post breaks the community rules');
    }
    const [p] = await this.db.write
      .insert(jupiterPosts)
      .values({ userId, rootId: root.id, kind: root.kind, url: root.url, posterUrl: root.posterUrl, text: body.text, filter: body.filter, branch: body.branch })
      .returning();
    const [author] = await this.db.write.select(authorCols).from(users).where(eq(users.id, userId));
    return this.toView(p, author, false);
  }

  async remove(userId: string, postId: string): Promise<void> {
    const res = await this.db.write
      .update(jupiterPosts)
      .set({ deletedAt: new Date() })
      .where(and(eq(jupiterPosts.id, postId), eq(jupiterPosts.userId, userId), isNull(jupiterPosts.deletedAt)))
      .returning({ id: jupiterPosts.id });
    if (!res.length) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
  }

  /**
   * The sky: everyone with posts in the last 88 hours, one butterfly per person (their posts
   * inside, newest first), most recent first. PLACEHOLDER (P-JUP-2): ranking.
   */
  async sky(viewerId: string, tab: 'all' | 'following' | 'friends', limit = 40): Promise<JupiterFlyer[]> {
    const scope =
      tab === 'following'
        ? sql`(${jupiterPosts.userId} IN (SELECT ${follows.followeeId} FROM ${follows} WHERE ${follows.followerId} = ${viewerId}) OR ${jupiterPosts.userId} = ${viewerId})`
        : tab === 'friends'
          ? sql`${jupiterPosts.userId} IN (SELECT f.followee_id FROM follows f JOIN follows g ON g.follower_id = f.followee_id AND g.followee_id = f.follower_id WHERE f.follower_id = ${viewerId})`
          : undefined;
    const rows = await this.db.read
      .select({ p: jupiterPosts, u: authorCols })
      .from(jupiterPosts)
      .innerJoin(users, eq(users.id, jupiterPosts.userId))
      .where(and(isNull(jupiterPosts.deletedAt), isNull(users.deletedAt), gt(jupiterPosts.createdAt, flyingSince()), scope))
      .orderBy(desc(jupiterPosts.createdAt))
      .limit(400);
    const views = await this.views(viewerId, rows);
    const byUser = new Map<string, JupiterFlyer>();
    for (const v of views) {
      const f = byUser.get(v.author.id) ?? { author: v.author, posts: [] };
      if (f.posts.length < 20) f.posts.push(v);
      byUser.set(v.author.id, f);
    }
    return [...byUser.values()].slice(0, limit);
  }

  async tree(viewerId: string, userId: string): Promise<JupiterTreeView> {
    const [u] = await this.db.read
      .select({ ...authorCols, branches: users.jupiterBranches })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));
    if (!u) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found');
    const since = flyingSince();
    const [rows, [stars], [friends], [mine]] = await Promise.all([
      this.db.read
        .select({ p: jupiterPosts, u: authorCols })
        .from(jupiterPosts)
        .innerJoin(users, eq(users.id, jupiterPosts.userId))
        .where(and(eq(jupiterPosts.userId, userId), isNull(jupiterPosts.deletedAt)))
        .orderBy(desc(jupiterPosts.createdAt))
        .limit(300),
      this.db.read
        .select({ n: sum(jupiterPosts.starCount) })
        .from(jupiterPosts)
        .where(and(eq(jupiterPosts.userId, userId), isNull(jupiterPosts.deletedAt))),
      this.db.read
        .select({ n: count() })
        .from(follows)
        .where(and(eq(follows.followerId, userId), sql`${follows.followeeId} IN (SELECT follower_id FROM follows WHERE followee_id = ${userId})`)),
      this.db.read
        .select({ n: count() })
        .from(follows)
        .where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, userId))),
    ]);
    const views = await this.views(viewerId, rows);
    const { branches, ...author } = u;
    return {
      author,
      branches: branchNames(branches),
      leaves: views.filter((v) => new Date(v.createdAt) <= since),
      flying: views.filter((v) => new Date(v.createdAt) > since),
      fruits: Number(stars?.n ?? 0),
      friends: friends?.n ?? 0,
      followedByMe: (mine?.n ?? 0) > 0,
      isMe: viewerId === userId,
    };
  }

  async renameBranch(userId: string, index: number, name: string): Promise<string[]> {
    const mod = await moderateText(name, this.llm);
    if (mod.flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'This name breaks the community rules');
    const [u] = await this.db.write.select({ b: users.jupiterBranches }).from(users).where(eq(users.id, userId));
    const next = branchNames(u?.b ?? null);
    next[index] = name;
    await this.db.write.update(users).set({ jupiterBranches: next, updatedAt: new Date() }).where(eq(users.id, userId));
    return next;
  }

  /** 探す: people on Jupiter by name (those who posted first). */
  async search(q: string): Promise<JupiterAuthor[]> {
    const term = q.trim().slice(0, 30);
    const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const posters = sql`EXISTS (SELECT 1 FROM jupiter_posts jp WHERE jp.user_id = ${users.id} AND jp.deleted_at IS NULL)`;
    return this.db.read
      .select(authorCols)
      .from(users)
      .where(and(isNull(users.deletedAt), term ? or(ilike(users.displayName, like), ilike(users.handle, like)) : posters))
      .orderBy(desc(posters), desc(users.createdAt))
      .limit(30);
  }

  async setStar(userId: string, postId: string, on: boolean): Promise<{ starCount: number; starredByMe: boolean }> {
    return this.db.write.transaction(async (tx) => {
      const [post] = await tx
        .select({ id: jupiterPosts.id })
        .from(jupiterPosts)
        .where(and(eq(jupiterPosts.id, postId), isNull(jupiterPosts.deletedAt)));
      if (!post) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Post not found');
      const delta = on
        ? (await tx.insert(starEvents).values({ userId, targetType: 'jupiter_post', targetId: postId, tier: 1 }).onConflictDoNothing().returning({ id: starEvents.id })).length
        : -(await tx
            .delete(starEvents)
            .where(and(eq(starEvents.userId, userId), eq(starEvents.targetType, 'jupiter_post'), eq(starEvents.targetId, postId)))
            .returning({ id: starEvents.id })).length;
      const [p] = await tx
        .update(jupiterPosts)
        .set({ starCount: sql`GREATEST(${jupiterPosts.starCount} + ${delta}, 0)` })
        .where(eq(jupiterPosts.id, postId))
        .returning({ starCount: jupiterPosts.starCount });
      return { starCount: p.starCount, starredByMe: on };
    });
  }

  private async views(viewerId: string, rows: { p: PostRow; u: JupiterAuthor }[]): Promise<JupiterPostView[]> {
    const ids = rows.map((r) => r.p.id);
    const mine = ids.length
      ? await this.db.read
          .select({ id: starEvents.targetId })
          .from(starEvents)
          .where(and(eq(starEvents.userId, viewerId), eq(starEvents.targetType, 'jupiter_post'), inArray(starEvents.targetId, ids)))
      : [];
    const starred = new Set(mine.map((m) => m.id));
    return rows.map(({ p, u }) => this.toView(p, u, starred.has(p.id)));
  }

  private toView(p: PostRow, u: JupiterAuthor, starredByMe: boolean): JupiterPostView {
    return {
      id: p.id,
      author: u,
      kind: p.kind as 'photo' | 'video',
      url: p.url,
      posterUrl: p.posterUrl,
      text: p.text,
      filter: p.filter,
      branch: p.branch,
      starCount: p.starCount,
      starredByMe,
      createdAt: p.createdAt.toISOString(),
    };
  }
}

function branchNames(saved: string[] | null): string[] {
  return JUPITER_DEFAULT_BRANCHES.map((d, i) => saved?.[i] || d);
}
