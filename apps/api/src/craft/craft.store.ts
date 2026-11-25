import { HttpStatus } from '@nestjs/common';
import { bookTags, gameTags, goodsTags, isGoodsKind, type BluenaPlanet, type BookView, type GameView, type GoodsKind, type GoodsView, type SpellTag } from '@obolo/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { apiError } from '../common/errors';
import type { Database } from '../db/db';
import { books, dachiMessages, games, goods, jupiterRoots } from '../db/schema';

export type BookRow = typeof books.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type GoodsRow = typeof goods.$inferSelect;
export type ArtRow = typeof jupiterRoots.$inferSelect;

/** 05 Pluto: what a book is tagged with (its spell, how much is written) and checked by (its title and chapter titles) */
export const bookFacts = (r: Pick<BookRow, 'userId' | 'title' | 'spellJson' | 'chaptersJson'>) => ({
  userId: r.userId,
  planet: 'pluto' as const,
  tags: bookTags(r.spellJson, r.chaptersJson.reduce((n, c) => n + (c.text?.length ?? 0), 0)),
  words: [r.title, ...r.chaptersJson.map((c) => c.title)].join(' '),
});
/** 05 Neptune: what a game is tagged with (the spell of the version on its face) and checked by (its title, how to play) */
export const gameFacts = (r: Pick<GameRow, 'userId' | 'title' | 'versionsJson' | 'active'>) => {
  const v = r.versionsJson[r.active] ?? r.versionsJson.at(-1);
  return { userId: r.userId, planet: 'neptune' as const, tags: gameTags(v?.tags ?? [], v?.title ?? r.title), words: `${v?.title ?? r.title} ${v?.howTo ?? ''}` };
};

export function bookView(r: BookRow): BookView {
  return { id: r.id, title: r.title, tags: r.spellJson, cover: r.coverUrl, chapters: r.chaptersJson.map(({ summary: _s, ...c }) => c), done: r.done, home: r.homePlanet as BluenaPlanet, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
}

export function gameView(r: GameRow): GameView {
  const v = r.versionsJson[r.active] ?? r.versionsJson.at(-1)!;
  return { id: r.id, title: v?.title ?? r.title, howTo: v?.howTo ?? '', tags: v?.tags ?? [], version: r.active, code: v?.code ?? '', home: r.homePlanet as BluenaPlanet, cover: r.coverUrl ?? null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
}

/**
 * Who may open a book / play a game: its maker, or a ダチ it was sent to (a work card in their thread with its id). The
 * receiver plays it in the same sandbox.
 */
export async function sentTo(db: Database, ownerId: string, viewerId: string, id: string): Promise<boolean> {
  const [hit] = await db.read
    .select({ id: dachiMessages.id })
    .from(dachiMessages)
    .where(and(eq(dachiMessages.senderId, ownerId), eq(dachiMessages.recipientId, viewerId), eq(dachiMessages.kind, 'work'), isNull(dachiMessages.deletedAt), sql`${dachiMessages.workJson}->>'refId' = ${id}`))
    .limit(1);
  return !!hit;
}

/** 05 Uranus: what a goods item is tagged with (its kind, its art's style and moods) and checked by (its title) */
export const goodsFacts = (r: Pick<GoodsRow, 'userId' | 'kind' | 'title'>, artSpell?: SpellTag[] | null) => ({ userId: r.userId, planet: 'uranus' as const, tags: goodsTags(r.kind, artSpell ?? null), words: r.title });

export function goodsView(r: GoodsRow): GoodsView {
  return { id: r.id, kind: (isGoodsKind(r.kind) ? r.kind : 'トート') as GoodsKind, rootId: r.rootId, artUrl: r.artUrl, title: r.title, flownAt: r.flownAt?.toISOString() ?? null, home: 'uranus', createdAt: r.createdAt.toISOString() };
}

/** one of the member's own arts: a picture in their Jupiter roots (not a video, not thrown away) */
export async function ownArt(db: Database, userId: string, rootId: string): Promise<ArtRow | null> {
  const [r] = await db.read
    .select()
    .from(jupiterRoots)
    .where(and(eq(jupiterRoots.id, rootId), eq(jupiterRoots.userId, userId), eq(jupiterRoots.kind, 'photo'), isNull(jupiterRoots.deletedAt)))
    .limit(1);
  return r ?? null;
}

export const notFound = (what: string) => apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${what} not found`);
