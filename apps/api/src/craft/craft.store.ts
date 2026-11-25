import { HttpStatus } from '@nestjs/common';
import type { BluenaPlanet, BookView, GameView } from '@obolo/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { apiError } from '../common/errors';
import type { Database } from '../db/db';
import { books, dachiMessages, games } from '../db/schema';

export type BookRow = typeof books.$inferSelect;
export type GameRow = typeof games.$inferSelect;

export function bookView(r: BookRow): BookView {
  return { id: r.id, title: r.title, tags: r.spellJson, cover: r.coverUrl, chapters: r.chaptersJson.map(({ summary: _s, ...c }) => c), done: r.done, home: r.homePlanet as BluenaPlanet, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
}

export function gameView(r: GameRow): GameView {
  const v = r.versionsJson[r.active] ?? r.versionsJson.at(-1)!;
  return { id: r.id, title: v?.title ?? r.title, howTo: v?.howTo ?? '', tags: v?.tags ?? [], version: r.active, code: v?.code ?? '', home: r.homePlanet as BluenaPlanet, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
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

export const notFound = (what: string) => apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${what} not found`);
