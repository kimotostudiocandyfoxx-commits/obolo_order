import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { type LlmProvider, moderateText } from '@obolo/ai';
import { demoChapter, KIND_HOME_PLANET, isFinalChapter, jstDay, NOVEL_CHAPTERS_PER_DAY, NOVEL_MAX_CHAPTERS, novelSystem, novelUser, type BookView, type NovelChapterBody, type SpellTag } from '@obolo/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { books } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV, LLM, NOVEL_LLM } from '../infra/tokens';
import { bookView, notFound, sentTo, type BookRow } from './craft.store';

const json = (raw: string) => JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Record<string, unknown>;
const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
/** a chapter shorter than this is not a chapter (the model stopped early): written again once */
const MIN_CHARS = 500;

/**
 * Client 2026-11-25 (本): a book written chapter by chapter — free (no mana, no confirm card), capped a day
 * (NOVEL_CHAPTERS_PER_DAY) and per book (NOVEL_MAX_CHAPTERS). The words in and the words out go through the same text
 * check as {bati}'s chat (moderateText). The writer is NOVEL_LLM (NOVEL_MODEL: Gemini Flash now); without a key the
 * canned demo chapters stand in.
 */
@Injectable()
export class NovelService {
  private readonly log = new Logger('Novel');
  constructor(
    @Inject(NOVEL_LLM) private readonly llm: LlmProvider,
    @Inject(LLM) private readonly modLlm: LlmProvider,
    private readonly db: Database,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  private async clean(text: string) {
    if ((await moderateText(text, this.modLlm)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'その言葉は使えません');
  }

  /** the day's chapters so far (+1 for this one); over the cap → CHAPTER_LIMIT ({bati}: また明日) */
  protected async countToday(userId: string) {
    const n = await this.kv.incr(`novel-day:${userId}:${jstDay(new Date().toISOString())}`, 30 * 3600);
    if (n > NOVEL_CHAPTERS_PER_DAY) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'CHAPTER_LIMIT', '今日は、もうたくさん書いたね');
  }

  protected async own(userId: string, id: string): Promise<BookRow> {
    const [row] = await this.db.write
      .select()
      .from(books)
      .where(and(eq(books.id, id), eq(books.userId, userId), isNull(books.deletedAt)));
    if (!row) throw notFound('Book');
    return row;
  }

  async list(userId: string): Promise<BookView[]> {
    const rows = await this.db.read
      .select()
      .from(books)
      .where(and(eq(books.userId, userId), isNull(books.deletedAt)))
      .orderBy(desc(books.createdAt))
      .limit(100);
    return rows.map(bookView);
  }

  /** the book for its maker, or for a ダチ it was sent to */
  async read(viewerId: string, id: string): Promise<BookView> {
    const [row] = await this.db.read
      .select()
      .from(books)
      .where(and(eq(books.id, id), isNull(books.deletedAt)));
    if (!row || (row.userId !== viewerId && !(await sentTo(this.db, row.userId, viewerId, id)))) throw notFound('Book');
    return bookView(row);
  }

  /** a new book and its first chapter (no bookId: `tags` is the book's spell), or the next chapter (`tags`: its spell) */
  async chapter(userId: string, b: NovelChapterBody): Promise<BookView> {
    const row = b.bookId ? await this.own(userId, b.bookId) : null;
    if (row && (row.done || row.chaptersJson.length >= NOVEL_MAX_CHAPTERS)) throw apiError(HttpStatus.CONFLICT, 'BOOK_FULL', 'この本は、もういっぱい');
    await this.clean([...b.tags.map((t) => t.ja), b.said ?? ''].join('、'));
    await this.countToday(userId);
    const book: SpellTag[] = row ? row.spellJson : b.tags;
    const chapter = row ? b.tags : undefined;
    const n = (row?.chaptersJson.length ?? 0) + 1;
    const final = !!chapter && isFinalChapter(chapter);
    const written = await this.write(book, n, row, chapter, b.said, final);
    await this.clean(`${written.bookTitle}\n${written.title}\n${written.text}`);
    const at = new Date();
    const ch = { n, title: written.title || `第${n}章`, text: written.text, tags: chapter ?? book, at: at.toISOString(), summary: written.summary };
    if (!row) {
      const [made] = await this.db.write
        .insert(books)
        .values({ userId, title: written.bookTitle || 'わたしの本', spellJson: book, chaptersJson: [ch], homePlanet: KIND_HOME_PLANET.novel })
        .returning();
      return bookView(made);
    }
    const [saved] = await this.db.write
      .update(books)
      .set({ chaptersJson: [...row.chaptersJson, ch], done: final, updatedAt: at })
      .where(eq(books.id, row.id))
      .returning();
    return bookView(saved);
  }

  /** the chapter by the model (once more when it came back too short); the canned one without a model */
  protected async write(book: SpellTag[], n: number, row: BookRow | null, chapter: SpellTag[] | undefined, said: string | undefined, final: boolean): Promise<{ bookTitle: string; title: string; text: string; summary: string }> {
    if (this.llm.name === 'mock') return demoChapter(book, n, final);
    const before = (row?.chaptersJson ?? []).map((c) => ({ title: c.title, summary: c.summary }));
    const user = novelUser({ book, n, before, lastText: row?.chaptersJson.at(-1)?.text, chapter, said });
    for (let i = 0; i < 2; i++) {
      try {
        const j = json(await this.llm.chat({ system: novelSystem(), history: [{ role: 'user', text: user }], json: true, temperature: 0.9, maxOutputTokens: 6000 }));
        const text = clip(j.text, 3600).replace(/\r/g, '');
        if (text.length < MIN_CHARS) throw new Error(`short chapter (${text.length})`);
        return { bookTitle: clip(j.title, 12) || row?.title || '', title: clip(j.chapterTitle, 16), text, summary: clip(j.summary, 80) || text.slice(0, 60) };
      } catch (e) {
        if (e instanceof HttpException) throw e;
        this.log.warn(`chapter ${n} try ${i + 1} failed: ${String(e)}`);
      }
    }
    throw apiError(HttpStatus.BAD_GATEWAY, 'NOVEL_FAILED', '羽ペンが、止まってしまった……');
  }
}
