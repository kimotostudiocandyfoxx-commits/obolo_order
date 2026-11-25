import type { MediaBackend } from '@obolo/media';

/**
 * The copy of the Bunny files to Cloudflare R2 (client decision 2026-11-25; docs/media.md "Bunny から R2 へ").
 *
 *  1. copy — small batches of live `media_objects` rows with storage 'bunny': read from Bunny Storage (with the zone key,
 *     not through the CDN), check the length against the row, put to R2 under the same key, HEAD it back and compare,
 *     then mark the row move_state 'copied'. The row keeps its Bunny URL and stays readable all along. A row whose
 *     object is already in R2 with the right size is only marked (a stopped run resumes without copying twice); a
 *     Bunny 404 is 'missing'; anything else is 'failed' and tried again up to MAX_TRIES times.
 *  2. switch — when nothing waits and nothing failed: in one transaction every copied row becomes storage 'r2' with its
 *     R2 URL, and every text / JSON column of every other table has the Bunny URL prefix rewritten to the R2 one (the
 *     key is the same on both, so the rewrite is the whole change).
 *  3. ready — no live row on Bunny and no column still holding a Bunny URL: Bunny can be cancelled.
 * Everything is idempotent: run it again and it only does what is left.
 */

export const MAX_TRIES = 5;

export interface MoveRow {
  id: string;
  key: string;
  mime: string;
  sizeBytes: number;
}

export interface MoveCounts {
  /** live files that were on Bunny when the move began (still there, copied, or switched) */
  total: number;
  /** still to copy (incl. failed ones with tries left) */
  waiting: number;
  /** copied to R2, the row not yet switched */
  copied: number;
  /** switched: the row is on R2 now */
  switched: number;
  /** failed MAX_TRIES times (POST /admin/media/r2/retry tries them again) */
  failed: number;
  /** not on Bunny any more, not yet switched (nothing to copy; switched with the others, their URL stays dead) */
  missing: number;
  /** of the switched rows, those that were missing on Bunny */
  switchedMissing: number;
  bytesTotal: number;
  /** bytes in R2 (copied + switched) */
  bytesMoved: number;
  /** Bunny rows whose URL does not start with https://<BUNNY_CDN_HOST>/ (the switch sets their URL from the key) */
  otherUrls: number;
}

export interface ColumnCount {
  table: string;
  column: string;
  rows: number;
}

export interface MoveStore {
  nextBatch(limit: number, maxTries: number): Promise<MoveRow[]>;
  /** false: the row was deleted (or switched) meanwhile */
  markCopied(id: string): Promise<boolean>;
  markMissing(id: string, error: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  counts(maxTries: number, fromPrefix: string): Promise<MoveCounts>;
  /** step 2 in one transaction; the columns rewritten and how many rows */
  switchAll(p: { from: string; to: string }): Promise<{ rows: number; columns: ColumnCount[] }>;
  /** the columns of other tables that still hold the Bunny prefix */
  bunnyRefs(from: string): Promise<ColumnCount[]>;
  retryFailed(): Promise<number>;
}

export interface BatchResult {
  tried: number;
  copied: number;
  resumed: number;
  missing: number;
  failed: number;
  bytes: number;
  errors: string[];
}

export class R2Mover {
  constructor(
    private readonly store: MoveStore,
    private readonly bunny: MediaBackend,
    private readonly r2: MediaBackend,
    private readonly prefixes: { from: string; to: string },
    private readonly parallel = 4,
  ) {}

  /** copy up to `limit` files */
  async batch(limit: number): Promise<BatchResult> {
    const rows = await this.store.nextBatch(limit, MAX_TRIES);
    const out: BatchResult = { tried: rows.length, copied: 0, resumed: 0, missing: 0, failed: 0, bytes: 0, errors: [] };
    let i = 0;
    const worker = async () => {
      while (i < rows.length) {
        const r = rows[i++];
        const res = await this.one(r).catch((e: unknown) => ({ kind: 'failed' as const, error: e instanceof Error ? e.message : String(e) }));
        if (res.kind === 'failed') {
          out.failed++;
          out.errors.push(`${r.id}: ${res.error}`);
          await this.store.markFailed(r.id, res.error.slice(0, 500));
        } else if (res.kind === 'missing') {
          out.missing++;
          await this.store.markMissing(r.id, res.error);
        } else {
          out[res.kind === 'resumed' ? 'resumed' : 'copied']++;
          out.bytes += r.sizeBytes;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.parallel, rows.length) }, worker));
    return out;
  }

  private async one(r: MoveRow): Promise<{ kind: 'copied' | 'resumed' } | { kind: 'missing' | 'failed'; error: string }> {
    const there = await this.r2.head!(r.key);
    if (there && there.size === r.sizeBytes) {
      if (!(await this.store.markCopied(r.id))) await this.r2.delete(r.key).catch(() => undefined);
      return { kind: 'resumed' };
    }
    const res = await this.bunny.get(r.key);
    if (res.status === 404) return { kind: 'missing', error: 'not on Bunny (404)' };
    if (!res.ok) return { kind: 'failed', error: `Bunny read ${res.status}` };
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length !== r.sizeBytes) return { kind: 'failed', error: `size differs: Bunny ${bytes.length}, row ${r.sizeBytes}` };
    await this.r2.put(r.key, bytes, r.mime);
    const head = await this.r2.head!(r.key);
    if (!head || head.size !== bytes.length) return { kind: 'failed', error: `R2 check: ${head ? head.size : 'not there'} after put of ${bytes.length}` };
    // deleted while it was being copied: the copy goes too
    if (!(await this.store.markCopied(r.id))) await this.r2.delete(r.key).catch(() => undefined);
    return { kind: 'copied' };
  }

  /** the failed files back into the queue */
  retry(): Promise<number> {
    return this.store.retryFailed();
  }

  status(): Promise<MoveCounts> {
    return this.store.counts(MAX_TRIES, this.prefixes.from);
  }

  /**
   * One step of the background job: copy a batch; or, when nothing waits and nothing failed, switch (the rows copied
   * since, and the other tables' URLs — once per process even with no row left, as a later write may hold an old URL);
   * else nothing.
   */
  async tick(limit: number): Promise<{ step: 'copy'; result: BatchResult } | { step: 'switch'; rows: number; columns: ColumnCount[] } | { step: 'idle'; counts: MoveCounts }> {
    const c = await this.status();
    if (c.waiting > 0) return { step: 'copy', result: await this.batch(limit) };
    if (c.failed === 0 && (c.copied > 0 || c.missing > 0 || !this.swept)) {
      const r = await this.store.switchAll(this.prefixes);
      this.swept = true;
      return { step: 'switch', ...r };
    }
    return { step: 'idle', counts: c };
  }
  private swept = false;

  /** Bunny can be cancelled when no live file is on Bunny and no column holds a Bunny URL */
  async readiness(): Promise<{ ready: boolean; reasons: string[]; counts: MoveCounts; refs: ColumnCount[] }> {
    const counts = await this.status();
    const refs = (await this.store.bunnyRefs(this.prefixes.from)).filter((r) => r.rows > 0);
    const reasons: string[] = [];
    const onBunny = counts.waiting + counts.copied + counts.failed + counts.missing;
    if (onBunny) reasons.push(`${onBunny} file rows still on Bunny (waiting ${counts.waiting}, copied but not switched ${counts.copied}, failed ${counts.failed}, missing ${counts.missing})`);
    for (const r of refs) reasons.push(`${r.table}.${r.column}: ${r.rows} rows still hold ${this.prefixes.from}`);
    return { ready: reasons.length === 0, reasons, counts, refs };
  }
}
