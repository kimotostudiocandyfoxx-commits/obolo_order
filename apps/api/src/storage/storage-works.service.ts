import { HttpStatus, Injectable } from '@nestjs/common';
import { isRemovableWorkKind, type RemovableWorkKind, type RemoveWorkResult } from '@obolo/shared';
import { sql } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { MediaService } from '../media/media.service';
import { StorageService } from './storage.service';

/** the table of each kind Bluena lists (FoundWork.kind) */
export const WORK_TABLES: Record<RemovableWorkKind, string> = {
  song: 'songs',
  saturn_post: 'saturn_posts',
  jupiter_root: 'jupiter_roots',
  mars_backstage: 'mars_backstage',
  radio_show: 'radio_shows',
  book: 'books',
  game: 'games',
  goods: 'goods',
};

/** the member's own rows that may still point at a file (a file one of them uses is kept) */
export const REF_TABLES = ['songs', 'saturn_posts', 'jupiter_roots', 'jupiter_posts', 'mars_backstage', 'radio_shows', 'planet_posts', 'mv_projects', 'books', 'games', 'goods', 'moon_works'] as const;

/** every http(s) URL in a row's text (the files its columns and JSON point at) */
export function urlsIn(text: string): string[] {
  return [...new Set([...text.matchAll(/https?:\/\/[^\s"'\\<>]+/g)].map((m) => m[0]))];
}

/** the other tries of a Moon work (its versions' refs that Bluena can throw away), the face excluded */
export function triesOf(versions: { ref?: { kind: string; id: string } | null }[], face: { kind: string; id: string }): { kind: RemovableWorkKind; id: string }[] {
  const seen = new Set<string>([`${face.kind}:${face.id}`]);
  const out: { kind: RemovableWorkKind; id: string }[] = [];
  for (const v of versions) {
    const r = v.ref;
    if (!r || !isRemovableWorkKind(r.kind) || seen.has(`${r.kind}:${r.id}`)) continue;
    seen.add(`${r.kind}:${r.id}`);
    out.push({ kind: r.kind, id: r.id });
  }
  return out;
}

/**
 * R18 (client 2026-11-25): a work thrown away from Bluena's viewer (〔消す〕, with a confirmation) frees its room — the
 * work, every try inside its Moon work (versions), its copies on the planets, and every file they stored (the song's
 * mix, original and stems, its voice version, phrases; a video's MP4, poster and scenes; a book's cover …). A file
 * another of the member's works still uses is kept. Nothing is ever deleted without the member's word.
 */
@Injectable()
export class StorageWorksService {
  constructor(
    private readonly db: Database,
    private readonly media: MediaService,
    private readonly storage: StorageService,
  ) {}

  async remove(userId: string, kind: string, id: string): Promise<RemoveWorkResult> {
    if (!isRemovableWorkKind(kind) || !/^[0-9a-f-]{36}$/i.test(id)) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Not a work');
    const texts: string[] = [];
    let textBytes = 0;
    const first = await this.drop(userId, kind, id);
    if (!first) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Work not found');
    texts.push(first);
    if (kind === 'book' || kind === 'game') textBytes += Buffer.byteLength(first);
    let removed = 1;
    // the Moon work it is the face of (or a try in): every try goes with it
    const works = await this.db.write.execute<{ id: string; j: string; versions: { ref?: { kind: string; id: string } | null }[] }>(sql`
      SELECT id, row_to_json(m)::text AS j, versions_json AS versions FROM moon_works m
      WHERE user_id = ${userId} AND deleted_at IS NULL AND versions_json @> ${JSON.stringify([{ ref: { kind, id } }])}::jsonb`);
    for (const w of works.rows) {
      texts.push(w.j);
      for (const t of triesOf(w.versions ?? [], { kind, id })) {
        const j = await this.drop(userId, t.kind, t.id);
        if (j) {
          texts.push(j);
          removed++;
          if (t.kind === 'book' || t.kind === 'game') textBytes += Buffer.byteLength(j);
        }
      }
      await this.db.write.execute(sql`UPDATE moon_works SET deleted_at = now(), updated_at = now() WHERE id = ${w.id}`);
    }
    const freedBytes = textBytes + (await this.freeFiles(userId, texts));
    return { removed, freedBytes, view: await this.storage.status(userId) };
  }

  /** soft-deletes one of the member's works (and what hangs on it); its row as text (null: not theirs / gone) */
  protected async drop(userId: string, kind: RemovableWorkKind, id: string): Promise<string | null> {
    const table = sql.identifier(WORK_TABLES[kind]);
    const r = await this.db.write.execute<{ j: string }>(sql`
      UPDATE ${table} t SET deleted_at = now(), updated_at = now()
      WHERE t.id = ${id} AND t.user_id = ${userId} AND t.deleted_at IS NULL
      RETURNING row_to_json(t)::text AS j`);
    const j = r.rows[0]?.j;
    if (!j) return null;
    const extra: string[] = [];
    // its copies on the planets (a song / a video flown) and a video's MV project
    const posts = await this.db.write.execute<{ j: string }>(sql`
      UPDATE planet_posts p SET deleted_at = now(), updated_at = now()
      WHERE p.source_id::text = ${id} AND p.user_id = ${userId} AND p.deleted_at IS NULL RETURNING row_to_json(p)::text AS j`);
    extra.push(...posts.rows.map((x) => x.j));
    if (kind === 'mars_backstage') {
      const mv = await this.db.write.execute<{ j: string }>(sql`
        UPDATE mv_projects m SET deleted_at = now(), updated_at = now()
        WHERE m.backstage_id = ${id} AND m.user_id = ${userId} AND m.deleted_at IS NULL RETURNING row_to_json(m)::text AS j`);
      extra.push(...mv.rows.map((x) => x.j));
    }
    return [j, ...extra].join('\n');
  }

  /** the member's files the thrown-away rows pointed at and nothing of theirs still uses: removed (Bunny, row, room) */
  protected async freeFiles(userId: string, texts: string[]): Promise<number> {
    const urls = urlsIn(texts.join('\n'));
    if (!urls.length) return 0;
    const files = await this.db.write.execute<{ url: string; size: number }>(sql`
      SELECT url, size_bytes AS size FROM media_objects
      WHERE user_id = ${userId} AND deleted_at IS NULL AND url IN (${sql.join(urls.map((u) => sql`${u}`), sql`, `)})`);
    let freed = 0;
    for (const f of files.rows) {
      if (await this.stillUsed(userId, f.url)) continue;
      await this.media.removeByUrl(userId, f.url);
      freed += Number(f.size) || 0;
    }
    return freed;
  }

  /** one of the member's live rows (or their profile) still points at the file */
  protected async stillUsed(userId: string, url: string): Promise<boolean> {
    const parts = REF_TABLES.map((t) => sql`SELECT 1 FROM ${sql.identifier(t)} t WHERE t.user_id = ${userId} AND t.deleted_at IS NULL AND strpos(t::text, ${url}) > 0`);
    parts.push(sql`SELECT 1 FROM users t WHERE t.id = ${userId} AND strpos(t::text, ${url}) > 0`);
    const r = await this.db.write.execute(sql`SELECT EXISTS (${sql.join(parts, sql` UNION ALL `)}) AS used`);
    return !!(r.rows[0] as { used?: boolean } | undefined)?.used;
  }
}
