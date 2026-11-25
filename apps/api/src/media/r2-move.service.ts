import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { urlPrefixes } from '@obolo/media';
import { sql } from 'drizzle-orm';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { mediaBackends } from './backends';
import { R2Mover, type ColumnCount, type MoveCounts, type MoveRow, type MoveStore } from './r2-move';

const LOCK = 'r2move:lock';
const LOCK_TTL = 900;
const n = (v: unknown) => Number(v) || 0;

/** the text / JSON columns of every table but media_objects (where a full media URL may be kept) */
async function urlColumns(db: Database): Promise<{ table: string; column: string; type: string }[]> {
  const r = await db.write.execute<{ table: string; column: string; type: string }>(sql`
    SELECT c.table_name AS "table", c.column_name AS "column", c.data_type AS "type"
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.table_name <> 'media_objects'
      AND c.data_type IN ('text', 'character varying', 'jsonb', 'json')
    ORDER BY c.table_name, c.column_name`);
  return r.rows;
}

/** a column as text, and the expression that writes a text back into it */
function asText(column: string, type: string) {
  const col = sql.identifier(column);
  const text = type === 'jsonb' || type === 'json' ? sql`${col}::text` : sql`${col}`;
  const back = (expr: ReturnType<typeof sql>) => (type === 'jsonb' ? sql`(${expr})::jsonb` : type === 'json' ? sql`(${expr})::json` : expr);
  return { col, text, back };
}

/** MoveStore on Postgres (media_objects.move_*; the switch in one transaction) */
export class PgMoveStore implements MoveStore {
  constructor(private readonly db: Database) {}

  async nextBatch(limit: number, maxTries: number): Promise<MoveRow[]> {
    const r = await this.db.write.execute<{ id: string; key: string; mime: string; size: number }>(sql`
      SELECT id, key, mime, size_bytes AS size FROM media_objects
      WHERE deleted_at IS NULL AND storage = 'bunny' AND (move_state IS NULL OR (move_state = 'failed' AND move_tries < ${maxTries}))
      ORDER BY move_tries, id LIMIT ${limit}`);
    return r.rows.map((x) => ({ id: x.id, key: x.key, mime: x.mime, sizeBytes: n(x.size) }));
  }

  async markCopied(id: string): Promise<boolean> {
    const r = await this.db.write.execute(sql`
      UPDATE media_objects SET move_state = 'copied', move_error = NULL, moved_at = now(), move_tries = move_tries + 1
      WHERE id = ${id} AND deleted_at IS NULL AND storage = 'bunny' RETURNING id`);
    return r.rows.length > 0;
  }

  async markMissing(id: string, error: string) {
    await this.db.write.execute(sql`
      UPDATE media_objects SET move_state = 'missing', move_error = ${error}, move_tries = move_tries + 1
      WHERE id = ${id} AND storage = 'bunny'`);
  }

  async markFailed(id: string, error: string) {
    await this.db.write.execute(sql`
      UPDATE media_objects SET move_state = 'failed', move_error = ${error}, move_tries = move_tries + 1
      WHERE id = ${id} AND storage = 'bunny'`);
  }

  async counts(maxTries: number, from: string): Promise<MoveCounts> {
    const r = await this.db.write.execute<Record<string, string>>(sql`
      SELECT
        count(*) FILTER (WHERE storage = 'bunny' OR move_state IS NOT NULL) AS total,
        count(*) FILTER (WHERE storage = 'bunny' AND (move_state IS NULL OR (move_state = 'failed' AND move_tries < ${maxTries}))) AS waiting,
        count(*) FILTER (WHERE storage = 'bunny' AND move_state = 'copied') AS copied,
        count(*) FILTER (WHERE storage = 'r2' AND move_state IS NOT NULL) AS switched,
        count(*) FILTER (WHERE storage = 'bunny' AND move_state = 'failed' AND move_tries >= ${maxTries}) AS failed,
        count(*) FILTER (WHERE storage = 'bunny' AND move_state = 'missing') AS missing,
        count(*) FILTER (WHERE storage = 'r2' AND move_state = 'missing') AS switched_missing,
        COALESCE(sum(size_bytes) FILTER (WHERE storage = 'bunny' OR move_state IS NOT NULL), 0) AS bytes_total,
        COALESCE(sum(size_bytes) FILTER (WHERE move_state = 'copied'), 0) AS bytes_moved,
        count(*) FILTER (WHERE storage = 'bunny' AND strpos(url, ${from}) <> 1) AS other_urls
      FROM media_objects WHERE deleted_at IS NULL AND storage IN ('bunny', 'r2')`);
    const x = r.rows[0] ?? {};
    return {
      total: n(x.total),
      waiting: n(x.waiting),
      copied: n(x.copied),
      switched: n(x.switched),
      failed: n(x.failed),
      missing: n(x.missing),
      switchedMissing: n(x.switched_missing),
      bytesTotal: n(x.bytes_total),
      bytesMoved: n(x.bytes_moved),
      otherUrls: n(x.other_urls),
    };
  }

  async switchAll(p: { from: string; to: string }): Promise<{ rows: number; columns: ColumnCount[] }> {
    const cols = await urlColumns(this.db);
    return this.db.write.transaction(async (tx) => {
      const moved = await tx.execute(sql`
        UPDATE media_objects SET storage = 'r2', url = ${p.to} || key, updated_at = now()
        WHERE deleted_at IS NULL AND storage = 'bunny' AND move_state IN ('copied', 'missing') RETURNING id`);
      const columns: ColumnCount[] = [];
      for (const c of cols) {
        const { col, text, back } = asText(c.column, c.type);
        const r = await tx.execute(sql`
          UPDATE ${sql.identifier(c.table)} SET ${col} = ${back(sql`replace(${text}, ${p.from}, ${p.to})`)}
          WHERE strpos(${text}, ${p.from}) > 0`);
        if (r.rowCount) columns.push({ table: c.table, column: c.column, rows: r.rowCount });
      }
      return { rows: moved.rows.length, columns };
    });
  }

  async bunnyRefs(from: string): Promise<ColumnCount[]> {
    const out: ColumnCount[] = [];
    for (const c of await urlColumns(this.db)) {
      const { text } = asText(c.column, c.type);
      const r = await this.db.write.execute<{ n: string }>(sql`SELECT count(*) AS n FROM ${sql.identifier(c.table)} WHERE strpos(${text}, ${from}) > 0`);
      out.push({ table: c.table, column: c.column, rows: n(r.rows[0]?.n) });
    }
    return out;
  }

  async retryFailed(): Promise<number> {
    const r = await this.db.write.execute(sql`
      UPDATE media_objects SET move_state = NULL, move_tries = 0 WHERE storage = 'bunny' AND move_state = 'failed' AND deleted_at IS NULL RETURNING id`);
    return r.rows.length;
  }
}

/**
 * Runs the Bunny → R2 copy (r2-move.ts) in the API: every R2_MIGRATE_EVERY_SEC a batch of R2_MIGRATE_BATCH files when
 * R2_MIGRATE=1, and on demand from POST /admin/media/r2/move. One instance at a time (a lock in Redis); safe to stop
 * and start. Needs both Bunny and R2 configured.
 */
@Injectable()
export class R2MoveService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('R2Move');
  private timer: ReturnType<typeof setInterval> | null = null;
  private cached: R2Mover | null | undefined;

  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly db: Database,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  /** null: R2 or Bunny is not configured (nothing to move, or nowhere to move it) */
  get mover(): R2Mover | null {
    if (this.cached !== undefined) return this.cached;
    const b = mediaBackends(this.cfg);
    if (!b.r2 || !b.bunny || !this.cfg.BUNNY_CDN_HOST || !this.cfg.R2_PUBLIC_BASE) return (this.cached = null);
    return (this.cached = new R2Mover(new PgMoveStore(this.db), b.bunny, b.r2, urlPrefixes({ cdnHost: this.cfg.BUNNY_CDN_HOST }, { publicBase: this.cfg.R2_PUBLIC_BASE })));
  }

  onModuleInit() {
    const b = mediaBackends(this.cfg);
    this.log.log(`media storage: new files → ${b.r2 ? 'R2' : b.bunny ? 'Bunny' : 'Postgres (dev)'}${b.r2 && b.bunny ? ' (Bunny kept for the files from before)' : ''}`);
    if (process.env.NODE_ENV === 'test' || !this.cfg.R2_MIGRATE) return;
    if (!this.mover) return void this.log.warn('R2_MIGRATE is on but R2 or Bunny is not configured: nothing to do');
    this.timer = setInterval(() => void this.tick().catch(() => undefined), this.cfg.R2_MIGRATE_EVERY_SEC * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** one step under the lock; null when another instance holds it */
  async tick(limit = this.cfg.R2_MIGRATE_BATCH) {
    const m = this.mover;
    if (!m) return null;
    if ((await this.kv.incr(LOCK, LOCK_TTL)) !== 1) return null;
    try {
      const r = await m.tick(limit);
      if (r.step !== 'idle') {
        const c = await m.status();
        this.log.log(
          `r2 move ${r.step}: ${r.step === 'copy' ? `${r.result.copied} copied, ${r.result.resumed} already there, ${r.result.missing} missing, ${r.result.failed} failed; ` : `${r.rows} rows switched, columns ${r.columns.map((x) => `${x.table}.${x.column}=${x.rows}`).join(' ') || 'none'}; `}` +
            line(c),
        );
        if (r.step === 'copy') for (const e of r.result.errors.slice(0, 5)) this.log.warn(`r2 move failed: ${e}`);
      }
      return r;
    } catch (e) {
      this.log.error(`r2 move: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    } finally {
      await this.kv.del(LOCK);
    }
  }
}

/** total / migrated / failed / bytes, for the log */
export function line(c: MoveCounts): string {
  const gb = (b: number) => (b / 1e9).toFixed(2);
  return `total ${c.total} / migrated ${c.copied + c.switched - c.switchedMissing} (switched ${c.switched - c.switchedMissing}) / waiting ${c.waiting} / failed ${c.failed} / missing ${c.missing + c.switchedMissing} / ${gb(c.bytesMoved)} of ${gb(c.bytesTotal)} GB`;
}
