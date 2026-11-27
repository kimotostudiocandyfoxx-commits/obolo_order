import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { LlmProvider, moderateText } from '@obolo/ai';
import {
  JUPITER_DEFAULT_BRANCHES,
  artTags,
  cleanArtTitle,
  flyingSince as sharedFlyingSince,
  splitFlying,
  type CreateJupiterPostBody,
  type JupiterAuthor,
  type JupiterFlyer,
  type JupiterPostView,
  type JupiterReplyView,
  type JupiterRootBody,
  type JupiterRootView,
  type JupiterTreeView,
} from '@obolo/shared';
import { and, count, desc, eq, gt, ilike, inArray, isNull, or, sql, sum } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { follows, jupiterPosts, jupiterReplies, jupiterRoots, mediaObjects, starEvents, users } from '../db/schema';
import { LLM } from '../infra/tokens';
import { notChild, planetWorkScope } from '../common/child';
import { postOfArt } from '../planets/one-post';
import { PlanetWorksService } from '../planets/planet-works.service';

type PostRow = typeof jupiterPosts.$inferSelect;

const authorCols = { id: users.id, handle: users.handle, displayName: users.displayName, neoForm: users.neoForm, butterfly: users.butterflyUrl, pic: users.puniPicUrl };
const flyingSince = () => sharedFlyingSince();

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
    @Optional() private readonly works?: PlanetWorksService,
  ) {}

  // --- 根っこ ------------------------------------------------------------------------------------

  async roots(userId: string): Promise<JupiterRootView[]> {
    const rows = await this.db.read
      .select()
      .from(jupiterRoots)
      .where(and(eq(jupiterRoots.userId, userId), isNull(jupiterRoots.deletedAt)))
      .orderBy(desc(jupiterRoots.createdAt))
      .limit(300);
    return rows.map((r) => ({ id: r.id, kind: r.kind as 'photo' | 'video', url: r.url, posterUrl: r.posterUrl, title: r.title ?? null, createdAt: r.createdAt.toISOString() }));
  }

  /** A photo upload (POST /media/photo) goes into your roots. Videos live in Mars's 裏スタジオ. */
  async addRoot(userId: string, body: JupiterRootBody): Promise<JupiterRootView> {
    const [m] = await this.db.write
      .select({ id: mediaObjects.id, url: mediaObjects.url, kind: mediaObjects.kind })
      .from(mediaObjects)
      .where(and(eq(mediaObjects.id, body.mediaId), eq(mediaObjects.userId, userId), isNull(mediaObjects.deletedAt)));
    if (m?.kind === 'video') throw apiError(HttpStatus.BAD_REQUEST, 'VIDEO_GOES_TO_MARS', 'Videos are kept in the Mars backstage studio');
    if (!m || m.kind !== 'photo') throw apiError(HttpStatus.BAD_REQUEST, 'MEDIA_NOT_FOUND', 'Upload the photo first');
    const title = await this.checkedTitle(body.title);
    const [r] = await this.db.write.insert(jupiterRoots).values({ userId, mediaId: m.id, kind: 'photo', url: m.url, spellJson: body.spell ?? null, title }).returning();
    return { id: r.id, kind: 'photo', url: r.url, posterUrl: null, title: r.title ?? null, createdAt: r.createdAt.toISOString() };
  }

  /** a title as kept (cleaned; null = none); one that breaks the rules is refused */
  private async checkedTitle(t: string | null | undefined): Promise<string | null> {
    const title = cleanArtTitle(t) || null;
    if (title && (await moderateText(title, this.llm)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'This title breaks the community rules');
    return title;
  }

  /**
   * story 2026-11-25: the art's title changed by words in the Moon atelier — on the root and on every post flown from it
   * (the title follows the art wherever it hangs)
   */
  async setRootTitle(userId: string, rootId: string, raw: string): Promise<JupiterRootView> {
    const title = await this.checkedTitle(raw);
    if (!title) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'A title is needed');
    const [r] = await this.db.write
      .update(jupiterRoots)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(jupiterRoots.id, rootId), eq(jupiterRoots.userId, userId), isNull(jupiterRoots.deletedAt)))
      .returning();
    if (!r) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
    await this.db.write
      .update(jupiterPosts)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(jupiterPosts.rootId, rootId), eq(jupiterPosts.userId, userId)));
    return { id: r.id, kind: r.kind as 'photo' | 'video', url: r.url, posterUrl: r.posterUrl, title: r.title ?? null, createdAt: r.createdAt.toISOString() };
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
    // story 2026-11-27 (one work = one post): an art that flew before flies as the same post — what it shows now, its 88
    // hours from now (also when it was taken out: 外す) — never a second one
    const prev = await postOfArt(this.db, userId, root.id);
    const shown = { kind: root.kind, url: root.url, posterUrl: root.posterUrl, text: body.text, title: root.title ?? null, filter: body.filter, branch: body.branch };
    const now = new Date();
    const [p] = prev
      ? await this.db.write
          .update(jupiterPosts)
          .set({ ...shown, createdAt: now, updatedAt: now, deletedAt: null })
          .where(eq(jupiterPosts.id, prev.id))
          .returning()
      : await this.db.write
          .insert(jupiterPosts)
          .values({ userId, rootId: root.id, ...shown })
          .returning();
    // planets 2-1: the hidden tags, from the spell the picture was painted with (a photo: none yet)
    await this.works?.tag('jupiter_post', p.id, { userId, planet: 'jupiter', tags: artTags(root.spellJson), words: p.text });
    const [author] = await this.db.write.select(authorCols).from(users).where(eq(users.id, userId));
    return this.toView(p, author, prev ? await this.starredBy(userId, p.id) : false);
  }

  private async starredBy(userId: string, postId: string): Promise<boolean> {
    const [r] = await this.db.read
      .select({ id: starEvents.id })
      .from(starEvents)
      .where(and(eq(starEvents.userId, userId), eq(starEvents.targetType, 'jupiter_post'), eq(starEvents.targetId, postId)))
      .limit(1);
    return !!r;
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
          : notChild(viewerId);
    const rows = await this.db.read
      .select({ p: jupiterPosts, u: authorCols })
      .from(jupiterPosts)
      .innerJoin(users, eq(users.id, jupiterPosts.userId))
      // M-R213: strangers too, except for a viewer under 15 (dachi only); never a work this viewer hid
      .where(and(isNull(jupiterPosts.deletedAt), isNull(users.deletedAt), gt(jupiterPosts.createdAt, flyingSince()), scope, planetWorkScope(viewerId, jupiterPosts.userId, 'jupiter_post', jupiterPosts.id)))
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
    // no counts (client rule 2026-10-07): no fruits / friends numbers
    const [rows, [mine]] = await Promise.all([
      this.db.read
        .select({ p: jupiterPosts, u: authorCols })
        .from(jupiterPosts)
        .innerJoin(users, eq(users.id, jupiterPosts.userId))
        .where(and(eq(jupiterPosts.userId, userId), isNull(jupiterPosts.deletedAt), planetWorkScope(viewerId, jupiterPosts.userId, 'jupiter_post', jupiterPosts.id)))
        .orderBy(desc(jupiterPosts.createdAt))
        .limit(300),
      this.db.read
        .select({ n: count() })
        .from(follows)
        .where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, userId))),
    ]);
    const views = await this.views(viewerId, rows);
    const { branches, ...author } = u;
    const split = splitFlying(views, (v) => v.createdAt);
    return {
      author,
      branches: branchNames(branches),
      leaves: split.home,
      flying: split.flying,
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
      .where(and(isNull(users.deletedAt), notChild(), term ? or(ilike(users.displayName, like), ilike(users.handle, like)) : posters))
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
    // the latest few repliers per post (their butterflies sit on the sticker)
    const withReplies = rows.filter((r) => r.p.replyCount > 0).map((r) => r.p.id);
    const recent = withReplies.length
      ? await this.db.read
          .select({ postId: jupiterReplies.postId, u: authorCols })
          .from(jupiterReplies)
          .innerJoin(users, eq(users.id, jupiterReplies.userId))
          .where(and(inArray(jupiterReplies.postId, withReplies), isNull(jupiterReplies.deletedAt)))
          .orderBy(desc(jupiterReplies.createdAt))
          .limit(Math.min(400, withReplies.length * 12))
      : [];
    const repliers = new Map<string, JupiterAuthor[]>();
    for (const r of recent) {
      const list = repliers.get(r.postId) ?? [];
      if (list.length < 3 && !list.some((a) => a.id === r.u.id)) list.push(r.u);
      repliers.set(r.postId, list);
    }
    return rows.map(({ p, u }) => this.toView(p, u, starred.has(p.id), repliers.get(p.id) ?? []));
  }

  // --- replies -----------------------------------------------------------------------------------

  async replies(postId: string): Promise<JupiterReplyView[]> {
    const rows = await this.db.read
      .select({ r: jupiterReplies, u: authorCols })
      .from(jupiterReplies)
      .innerJoin(users, eq(users.id, jupiterReplies.userId))
      .where(and(eq(jupiterReplies.postId, postId), isNull(jupiterReplies.deletedAt)))
      .orderBy(jupiterReplies.createdAt)
      .limit(200);
    return rows.map(({ r, u }) => ({ id: r.id, author: u, text: r.text, createdAt: r.createdAt.toISOString() }));
  }

  async reply(userId: string, postId: string, text: string): Promise<JupiterReplyView> {
    const [post] = await this.db.write
      .select({ id: jupiterPosts.id })
      .from(jupiterPosts)
      .where(and(eq(jupiterPosts.id, postId), isNull(jupiterPosts.deletedAt)));
    if (!post) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Post not found');
    const mod = await moderateText(text, this.llm);
    if (mod.flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'This reply breaks the community rules');
    const r = await this.db.write.transaction(async (tx) => {
      const [row] = await tx.insert(jupiterReplies).values({ postId, userId, text }).returning();
      await tx.update(jupiterPosts).set({ replyCount: sql`${jupiterPosts.replyCount} + 1` }).where(eq(jupiterPosts.id, postId));
      return row;
    });
    const [author] = await this.db.write.select(authorCols).from(users).where(eq(users.id, userId));
    return { id: r.id, author, text: r.text, createdAt: r.createdAt.toISOString() };
  }

  async removeReply(userId: string, replyId: string): Promise<void> {
    const res = await this.db.write
      .update(jupiterReplies)
      .set({ deletedAt: new Date() })
      .where(and(eq(jupiterReplies.id, replyId), eq(jupiterReplies.userId, userId), isNull(jupiterReplies.deletedAt)))
      .returning({ postId: jupiterReplies.postId });
    if (!res.length) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
    await this.db.write.update(jupiterPosts).set({ replyCount: sql`GREATEST(${jupiterPosts.replyCount} - 1, 0)` }).where(eq(jupiterPosts.id, res[0].postId));
  }

  private toView(p: PostRow, u: JupiterAuthor, starredByMe: boolean, repliers: JupiterAuthor[] = []): JupiterPostView {
    return {
      id: p.id,
      author: u,
      kind: p.kind as 'photo' | 'video',
      url: p.url,
      posterUrl: p.posterUrl,
      text: p.text,
      title: p.title ?? null,
      filter: p.filter,
      branch: p.branch,
      starCount: p.starCount,
      starredByMe,
      createdAt: p.createdAt.toISOString(),
      replyCount: p.replyCount,
      repliers,
    };
  }
}

function branchNames(saved: string[] | null): string[] {
  return JUPITER_DEFAULT_BRANCHES.map((d, i) => saved?.[i] || d);
}
