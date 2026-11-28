import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { KIND_HOME_PLANET, spellFrom, STORY_FIRST_DAY, type StoryFirstBookBody, type StoryFirstBookView, type StoryFirstGameBody, type StoryFirstGameView, type StoryFirstKind } from '@obolo/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { StoryService } from '../buddy/story.service';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { books, games, storyFirstWorks, users } from '../db/schema';
import { PlanetWorksService } from '../planets/planet-works.service';
import { costScope } from '../wallet/cost-scope';
import { bookFacts, bookView, gameView, type BookRow } from './craft.store';
import { GameService } from './game.service';

/** a claim left by a making that never finished (the server stopped): taken again after this long */
const STALE_CLAIM_MS = 10 * 60_000;

/**
 * Client 2026-11-28 (@obolo/shared storyFirst.ts, docs/planets.md 09): the first journey's own book (day 8) and game
 * (day 9) become REAL works — a `books` / `games` row of the member, which the story then flies from the Moon to Pluto /
 * Neptune with the Moon's own calls (POST /moon/books|games/:id/fly: one work = one post, 88 hours, the homecoming report).
 *
 *  - free for the member: no yes, no ledger charge, no small cost — everything the making costs (the short story's
 *    writing, the catch game's values, their words checks) is recorded under 'storyFirst' (ABSORBED_FEATURES);
 *  - once per member and kind (story_first_works, one row each: a claim while it is made, the work once done). Asked
 *    again it gives the same work back (`again`) — a replay of the day makes nothing new; a work the member threw away
 *    is not made a second time (STORY_FIRST_USED);
 *  - only on its own day of the first journey (users.journey_day = 8 / 9; NOT_STORY_DAY otherwise — the accounts of the
 *    eight-day journey make theirs on the days after joining the paid way, as before).
 */
@Injectable()
export class StoryFirstService {
  constructor(
    private readonly db: Database,
    private readonly story: StoryService,
    private readonly games: GameService,
    @Optional() private readonly works?: PlanetWorksService,
  ) {}

  /** the work made on an earlier play (null: none yet) — STORY_FIRST_USED when it was made and is gone */
  protected async made(userId: string, kind: StoryFirstKind): Promise<{ workId: string | null; createdAt: Date } | null> {
    const [row] = await this.db.write
      .select({ workId: storyFirstWorks.workId, createdAt: storyFirstWorks.createdAt })
      .from(storyFirstWorks)
      .where(and(eq(storyFirstWorks.userId, userId), eq(storyFirstWorks.kind, kind)))
      .limit(1);
    return row ?? null;
  }

  protected async onItsDay(userId: string, kind: StoryFirstKind): Promise<void> {
    const [u] = await this.db.write.select({ day: users.journeyDay }).from(users).where(eq(users.id, userId)).limit(1);
    if (u?.day !== STORY_FIRST_DAY[kind]) throw apiError(HttpStatus.CONFLICT, 'NOT_STORY_DAY', 'これは、物語のその日だけ');
  }

  /**
   * the free path, once: the work already made (returned as it is), or a new one made by `make` in the absorbed scope.
   * The claim row is taken first (so two calls at once make one), filled with the work, and let go when the making fails
   * (the member may try again on the day).
   */
  protected async once<T>(userId: string, kind: StoryFirstKind, existing: (workId: string) => Promise<T | null>, make: () => Promise<{ id: string; out: T }>): Promise<{ out: T; again: boolean }> {
    for (let round = 0; round < 2; round++) {
      const prev = await this.made(userId, kind);
      if (prev?.workId) {
        const out = await existing(prev.workId);
        if (!out) throw apiError(HttpStatus.CONFLICT, 'STORY_FIRST_USED', 'これは、もう作ったよ');
        return { out, again: true };
      }
      if (prev && Date.now() - prev.createdAt.getTime() < STALE_CLAIM_MS) throw apiError(HttpStatus.CONFLICT, 'STORY_FIRST_BUSY', 'いま、作っているところ');
      if (prev) await this.db.write.delete(storyFirstWorks).where(and(eq(storyFirstWorks.userId, userId), eq(storyFirstWorks.kind, kind), isNull(storyFirstWorks.workId)));
      await this.onItsDay(userId, kind);
      const [claim] = await this.db.write.insert(storyFirstWorks).values({ userId, kind }).onConflictDoNothing().returning();
      if (!claim) continue;
      try {
        const made = await costScope.run({ feature: 'storyFirst', userId }, make);
        await this.db.write.update(storyFirstWorks).set({ workId: made.id }).where(and(eq(storyFirstWorks.userId, userId), eq(storyFirstWorks.kind, kind)));
        return { out: made.out, again: false };
      } catch (e) {
        await this.db.write.delete(storyFirstWorks).where(and(eq(storyFirstWorks.userId, userId), eq(storyFirstWorks.kind, kind), isNull(storyFirstWorks.workId)));
        throw e;
      }
    }
    throw apiError(HttpStatus.CONFLICT, 'STORY_FIRST_BUSY', 'いま、作っているところ');
  }

  /** day 8: the short story from the story's cards (StoryService's writer, unpaid), kept as a book of one chapter */
  async book(userId: string, b: StoryFirstBookBody): Promise<StoryFirstBookView> {
    const asView = (row: BookRow) => ({ book: bookView(row), pages: pagesOf(row) });
    const { out, again } = await this.once(
      userId,
      'book',
      async (id) => {
        const [row] = await this.db.write.select().from(books).where(and(eq(books.id, id), eq(books.userId, userId), isNull(books.deletedAt))).limit(1);
        return row ? asView(row) : null;
      },
      async () => {
        const story = await this.story.write(userId, b.cards, true);
        const spell = spellFrom('novel', [b.cards.join('、'), b.said ?? ''].join('、'));
        const at = new Date().toISOString();
        const text = story.pages.map((p) => p.text).join('\n\n');
        const ch = { n: 1, title: story.title, text, tags: spell, at, summary: story.pages[0]?.text.slice(0, 80) ?? '', scenes: story.pages.map((p) => p.scene) };
        const [row] = await this.db.write.insert(books).values({ userId, title: story.title, spellJson: spell, chaptersJson: [ch], homePlanet: KIND_HOME_PLANET.novel }).returning();
        await this.works?.tag('book', row.id, bookFacts(row));
        return { id: row.id, out: { book: bookView(row), pages: story.pages } };
      },
    );
    return { ...out, again };
  }

  /** day 9: the story's catch game as a real game (the catch template, the trial chain's values, the story's title) */
  async game(userId: string, b: StoryFirstGameBody): Promise<StoryFirstGameView> {
    const { out, again } = await this.once(
      userId,
      'game',
      async (id) => {
        const [row] = await this.db.write.select().from(games).where(and(eq(games.id, id), eq(games.userId, userId), isNull(games.deletedAt))).limit(1);
        return row ? gameView(row) : null;
      },
      async () => {
        const row = await this.games.makeStoryFirst(userId, spellFrom('game', [b.cards.join('、'), b.said ?? ''].join('、')), b.said, b.title);
        return { id: row.id, out: gameView(row) };
      },
    );
    return { game: out, again };
  }
}

/** the story's pages of a book it made (its one chapter, a paragraph a page) */
export function pagesOf(row: Pick<BookRow, 'chaptersJson'>): { text: string; scene: string }[] {
  const ch = row.chaptersJson[0] as (BookRow['chaptersJson'][number] & { scenes?: string[] }) | undefined;
  if (!ch) return [];
  return ch.text
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ text, scene: ch.scenes?.[i] ?? '' }));
}
