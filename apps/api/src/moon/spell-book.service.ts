import { HttpStatus, Injectable } from '@nestjs/common';
import { SPELL_BOOK_MAX, songSpellKey, spellBookName, spellKey, spellNameClean, spellNameUnique, spellNormalize, type RenameSpellBody, type SaveSpellBody, type SaveSpellResult, type SavedSpell, type SpellBookKind } from '@obolo/shared';
import { and, desc, eq } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { spellBook } from '../db/schema';

type Row = typeof spellBook.$inferSelect;
type NewRow = typeof spellBook.$inferInsert;

export const view = (r: Row): SavedSpell => ({ id: r.id, kind: r.kind as SpellBookKind, name: r.name, tags: r.tagsJson, ...(r.lyricsJson ? { lyrics: r.lyricsJson } : {}), createdAt: r.createdAt.toISOString(), usedAt: r.usedAt?.toISOString() ?? null });

/**
 * R12 (client 2026-11-25): {bati}'s スペルブック — the spells a member keeps, on the server (spell_book), only their own.
 * At most SPELL_BOOK_MAX; the same tag set is kept once (the one kept is returned, `already`); a name from what the spell
 * is about (spellBookName), another spell's name gets a number; 「名前を〇〇にして」 renames; 「〇〇は捨てて」 deletes.
 * The talismans are the dictionary's own labels again (spellNormalize: a saved spell never carries a stray English).
 * The DB calls are their own methods (the tests stand in for them).
 */
@Injectable()
export class SpellBookService {
  constructor(private readonly db: Database) {}

  async list(userId: string): Promise<SavedSpell[]> {
    return (await this.rows(userId)).map(view);
  }

  async save(userId: string, b: SaveSpellBody): Promise<SaveSpellResult> {
    const tags = spellNormalize(b.kind, b.tags);
    if (!tags.length) throw apiError(HttpStatus.BAD_REQUEST, 'NO_SPELL', 'No spell to keep');
    // R13: a song spell keeps both parts (style talismans + lyrics with metatags); the same pair is kept once
    const lyrics = b.kind === 'song' ? b.lyrics : undefined;
    const key = lyrics ? songSpellKey(tags, lyrics)! : spellKey(b.kind, tags);
    const rows = await this.rows(userId);
    const same = rows.find((r) => r.spellKey === key);
    if (same) return { ...view(same), already: true };
    if (rows.length >= SPELL_BOOK_MAX) throw apiError(HttpStatus.CONFLICT, 'SPELL_BOOK_FULL', 'The spell book is full');
    const name = spellNameUnique(b.name ? spellNameClean(b.name) || spellBookName(b.kind, tags) : spellBookName(b.kind, tags), rows.map((r) => r.name));
    return view(await this.insert({ userId, kind: b.kind, name, tagsJson: tags, lyricsJson: lyrics ?? null, spellKey: key }));
  }

  async rename(userId: string, id: string, b: RenameSpellBody): Promise<SavedSpell> {
    const rows = await this.rows(userId);
    const row = rows.find((r) => r.id === id);
    if (!row) throw apiError(HttpStatus.NOT_FOUND, 'SPELL_NOT_FOUND', 'Spell not found');
    const clean = spellNameClean(b.name);
    if (!clean) throw apiError(HttpStatus.BAD_REQUEST, 'NO_NAME', 'No name');
    const name = spellNameUnique(clean, rows.filter((r) => r.id !== id).map((r) => r.name));
    return view(await this.update(userId, id, { name }));
  }

  /** brought back as the spell (the book lists the ones used lately first among equals) */
  async used(userId: string, id: string): Promise<SavedSpell> {
    const row = (await this.rows(userId)).find((r) => r.id === id);
    if (!row) throw apiError(HttpStatus.NOT_FOUND, 'SPELL_NOT_FOUND', 'Spell not found');
    return view(await this.update(userId, id, { usedAt: new Date() }));
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    if (!(await this.delete(userId, id))) throw apiError(HttpStatus.NOT_FOUND, 'SPELL_NOT_FOUND', 'Spell not found');
    return { ok: true };
  }

  // --- the table (only the member's own rows, always by user id) --------------------------------------------------

  protected async rows(userId: string): Promise<Row[]> {
    return this.db.write.select().from(spellBook).where(eq(spellBook.userId, userId)).orderBy(desc(spellBook.createdAt)).limit(SPELL_BOOK_MAX + 10);
  }
  protected async insert(v: NewRow): Promise<Row> {
    const [row] = await this.db.write.insert(spellBook).values(v).returning();
    return row;
  }
  protected async update(userId: string, id: string, set: Partial<NewRow>): Promise<Row> {
    const [row] = await this.db.write
      .update(spellBook)
      .set({ ...set, updatedAt: new Date() })
      .where(and(eq(spellBook.id, id), eq(spellBook.userId, userId)))
      .returning();
    if (!row) throw apiError(HttpStatus.NOT_FOUND, 'SPELL_NOT_FOUND', 'Spell not found');
    return row;
  }
  protected async delete(userId: string, id: string): Promise<boolean> {
    const gone = await this.db.write
      .delete(spellBook)
      .where(and(eq(spellBook.id, id), eq(spellBook.userId, userId)))
      .returning({ id: spellBook.id });
    return gone.length > 0;
  }
}
