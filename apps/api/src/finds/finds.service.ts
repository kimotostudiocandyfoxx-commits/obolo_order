import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  ITEM_MARKS,
  isCharacterThread,
  matchesFind,
  talkDays,
  type BluenaPlanet,
  type FindTalksQuery,
  type FindWorksQuery,
  type FoundWork,
  type ItemMarkId,
  type ItemMarksView,
  type MarkedKind,
  type MarkNames,
  type MarkNamesBody,
  type SetItemMarkBody,
  type TalkDayView,
  type TalkLine,
} from '@obolo/shared';
import { and, desc, eq, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import { Database } from '../db/db';
import { books, buddyMessages, games, itemMarks, jupiterRoots, marsBackstage, radioShows, saturnPosts, songs, users } from '../db/schema';
import { DachiVoiceService } from '../dachi/dachi-voice.service';
import { MoonWorksService } from '../moon/moon-works.service';

type Mark = { stars: number; mark: ItemMarkId | null };
const LIMIT = 300;
/** ILIKE pattern for the words typed (their own % and _ are literal) */
export const likeOf = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const isMark = (m: unknown): m is ItemMarkId => (ITEM_MARKS as readonly string[]).includes(m as string);

/**
 * M-R236 / M-R237: the member's ★ and marks, their names for the marks, and finding things again — Bluena's works
 * across the planets' own stores (newest first) and a thread's past talk as days. Only the member's own.
 */
@Injectable()
export class FindsService {
  constructor(
    private readonly db: Database,
    private readonly dachi: DachiVoiceService,
    @Optional() private readonly moon?: MoonWorksService,
  ) {}

  async marks(userId: string): Promise<ItemMarksView> {
    const [rows, [u]] = await Promise.all([
      this.db.read.select().from(itemMarks).where(eq(itemMarks.userId, userId)).limit(5000),
      this.db.read.select({ names: users.markNamesJson }).from(users).where(eq(users.id, userId)),
    ]);
    return {
      marks: rows.map((r) => ({ kind: r.kind as MarkedKind, id: r.targetId, stars: r.stars, mark: isMark(r.mark) ? r.mark : null })),
      names: u?.names ?? {},
    };
  }

  /** one item's ★ and mark (no ★ and no mark: the row goes) */
  async setMark(userId: string, b: SetItemMarkBody) {
    const key = and(eq(itemMarks.userId, userId), eq(itemMarks.kind, b.kind), eq(itemMarks.targetId, b.id));
    if (!b.stars && !b.mark) await this.db.write.delete(itemMarks).where(key);
    else
      await this.db.write
        .insert(itemMarks)
        .values({ userId, kind: b.kind, targetId: b.id, stars: b.stars, mark: b.mark })
        .onConflictDoUpdate({ target: [itemMarks.userId, itemMarks.kind, itemMarks.targetId], set: { stars: b.stars, mark: b.mark, updatedAt: new Date() } });
    return { kind: b.kind, id: b.id, stars: b.stars, mark: b.mark };
  }

  async setNames(userId: string, b: MarkNamesBody): Promise<MarkNames> {
    const names: MarkNames = {};
    for (const k of ITEM_MARKS) if (b[k]) names[k] = b[k];
    await this.db.write.update(users).set({ markNamesJson: names }).where(eq(users.id, userId));
    return names;
  }

  private async markMap(userId: string, kinds?: MarkedKind[]): Promise<Map<string, Mark>> {
    const rows = await this.db.read
      .select()
      .from(itemMarks)
      .where(and(eq(itemMarks.userId, userId), kinds?.length === 1 ? eq(itemMarks.kind, kinds[0]) : undefined))
      .limit(5000);
    return new Map(rows.map((r) => [`${r.kind}:${r.targetId}`, { stars: r.stars, mark: isMark(r.mark) ? r.mark : null }]));
  }

  /** Bluena's list: every work of the planet (or all), newest first, with its ★ / mark; the strip and the search box */
  async works(userId: string, f: FindWorksQuery): Promise<FoundWork[]> {
    const q = f.q?.trim() ? likeOf(f.q.trim()) : null;
    const want = (p: BluenaPlanet) => !f.planet || f.planet === p;
    const ilike = (col: SQL | unknown) => (q ? sql`${col} ILIKE ${q}` : undefined);
    const jobs: Promise<FoundWork[]>[] = [];
    if (want('saturn'))
      jobs.push(
        this.db.read
          .select()
          .from(saturnPosts)
          .where(and(eq(saturnPosts.userId, userId), isNull(saturnPosts.replyToId), isNull(saturnPosts.deletedAt), ilike(saturnPosts.text)))
          .orderBy(desc(saturnPosts.createdAt))
          .limit(LIMIT)
          .then((rows) => rows.map((r) => this.w('saturn_post', r.id, 'saturn', r.text, r.createdAt, { audio: r.voiceAudioUrl, image: r.photoUrl, flown: !r.room }))),
      );
    // a picture has no words to search
    if (want('jupiter') && !q)
      jobs.push(
        this.db.read
          .select()
          .from(jupiterRoots)
          .where(and(eq(jupiterRoots.userId, userId), eq(jupiterRoots.kind, 'photo'), isNull(jupiterRoots.deletedAt)))
          .orderBy(desc(jupiterRoots.createdAt))
          .limit(LIMIT)
          .then((rows) => rows.map((r) => this.w('jupiter_root', r.id, 'jupiter', '', r.createdAt, { image: r.url }))),
      );
    if (want('mercury'))
      jobs.push(
        this.db.read
          .select({ s: songs, posted: sql<boolean>`EXISTS (SELECT 1 FROM planet_posts pp WHERE pp.source_id = "songs"."id" AND pp.planet = 'mercury' AND pp.deleted_at IS NULL)` })
          .from(songs)
          // the lyrics are in the phrases (one per line) and the design
          .where(and(eq(songs.userId, userId), isNull(songs.deletedAt), isNotNull(songs.savedAt), q ? sql`(${songs.title} ILIKE ${q} OR ${songs.phrasesJson}::text ILIKE ${q} OR ${songs.designJson}::text ILIKE ${q})` : undefined))
          .orderBy(desc(songs.savedAt))
          .limit(LIMIT)
          .then((rows) => rows.map(({ s, posted }) => this.w('song', s.id, 'mercury', s.title, s.savedAt ?? s.createdAt, { audio: s.mixUrl, flown: !!posted }))),
      );
    if (want('mars'))
      jobs.push(
        this.db.read
          .select()
          .from(marsBackstage)
          .where(and(eq(marsBackstage.userId, userId), isNull(marsBackstage.deletedAt), ilike(marsBackstage.title)))
          .orderBy(desc(marsBackstage.createdAt))
          .limit(LIMIT)
          .then((rows) => rows.map((r) => this.w('mars_backstage', r.id, 'mars', r.title, r.createdAt, { video: r.url, image: r.posterUrl }))),
      );
    if (want('venus'))
      jobs.push(
        this.db.read
          .select()
          .from(radioShows)
          .where(and(eq(radioShows.userId, userId), isNull(radioShows.deletedAt), isNull(radioShows.removedAt), ilike(radioShows.title)))
          .orderBy(desc(radioShows.createdAt))
          .limit(LIMIT)
          .then((rows) => rows.map((r) => this.w('radio_show', r.id, 'venus', r.title, r.createdAt, { audio: r.audioUrl, image: r.thumbUrl, flown: r.status === 'public' }))),
      );
    // client 2026-11-25: books (Pluto) and games (Neptune) made on the Moon; グッズ: nothing is made there yet
    if (want('pluto'))
      jobs.push(
        this.db.read
          .select()
          .from(books)
          .where(and(eq(books.userId, userId), isNull(books.deletedAt), q ? sql`(${books.title} ILIKE ${q} OR ${books.chaptersJson}::text ILIKE ${q})` : undefined))
          .orderBy(desc(books.createdAt))
          .limit(LIMIT)
          .then((rows) => rows.map((r) => this.w('book', r.id, 'pluto', r.title, r.createdAt, { image: r.coverUrl, flown: !!r.flownAt }))),
      );
    if (want('neptune'))
      jobs.push(
        this.db.read
          .select()
          .from(games)
          .where(and(eq(games.userId, userId), isNull(games.deletedAt), ilike(games.title)))
          .orderBy(desc(games.createdAt))
          .limit(LIMIT)
          .then((rows) => rows.map((r) => this.w('game', r.id, 'neptune', r.title, r.createdAt, { flown: !!r.flownAt }))),
      );
    const empty = { hidden: new Set<string>(), faces: new Map() } as Awaited<ReturnType<MoonWorksService['index']>>;
    const [lists, marks, moon] = await Promise.all([Promise.all(jobs), this.markMap(userId), this.moon?.index(userId).catch(() => empty) ?? empty]);
    return lists
      .flat()
      // M-R253 §1: one work in Bluena — its other tries are inside it, not listed on their own
      .filter((w) => !moon.hidden.has(`${w.kind}:${w.id}`))
      .map((w) => {
        const m = moon.faces.get(`${w.kind}:${w.id}`);
        return { ...w, ...(marks.get(`${w.kind}:${w.id}`) ?? {}), ...(m ? { atelierId: m.id, versionCount: m.versions.length, origin: m.origin } : {}) };
      })
      .filter((w) => matchesFind(w, f))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private w(kind: MarkedKind, id: string, planet: BluenaPlanet, title: string, at: Date, x: Partial<FoundWork>): FoundWork {
    return { kind, id, planet, title, createdAt: at.toISOString(), stars: 0, mark: null, ...x };
  }

  /** a thread's past talk as days: 'bati' = your talks with {bati} (buddy_messages), else a ダチ thread */
  async talkDays(userId: string, f: FindTalksQuery): Promise<TalkDayView[]> {
    const lines = await this.talkLines(userId, f.thread);
    const kind: MarkedKind = f.thread === 'bati' ? 'buddy_message' : 'dachi_message';
    const marks = await this.markMap(userId, [kind]);
    return talkDays(lines, (id) => marks.get(`${kind}:${id}`), f);
  }

  protected async talkLines(userId: string, thread: string): Promise<TalkLine[]> {
    if (thread === 'bati') {
      const rows = await this.db.read
        .select({ id: buddyMessages.id, role: buddyMessages.role, text: buddyMessages.text, at: buddyMessages.createdAt })
        .from(buddyMessages)
        .where(and(eq(buddyMessages.userId, userId), isNull(buddyMessages.deletedAt)))
        .orderBy(desc(buddyMessages.createdAt))
        .limit(3000);
      return rows.map((r) => ({ id: r.id, at: r.at.toISOString(), who: r.role === 'user' ? 'me' : 'bati', text: r.text }));
    }
    if (!isCharacterThread(thread) && !/^[0-9a-f-]{36}$/i.test(thread)) throw new NotFoundException();
    const ms = await this.dachi.messages(userId, thread.toLowerCase());
    return ms.map((m) => ({ id: m.id, at: m.createdAt, who: m.fromMe ? 'me' : (m.character ?? thread), text: m.text ?? (m.kind === 'work' ? (m.work?.title ?? '') : '') }));
  }
}
