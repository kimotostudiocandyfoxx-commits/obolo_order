import { rewriteUrl, type MediaBackend } from '@obolo/media';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../config';
import { mediaBackends } from './backends';
import { holdersOf } from './media.service';
import { MAX_TRIES, R2Mover, type ColumnCount, type MoveCounts, type MoveRow, type MoveStore } from './r2-move';
import { line } from './r2-move.service';

const P = { from: 'https://obolo.b-cdn.net/', to: 'https://media.obolo.life/' };

/** a bucket in memory; `fail` makes a key's put throw, `short` stores one byte fewer (a broken upload) */
function bucket(name: 'bunny' | 'r2', base: string) {
  const objects = new Map<string, Uint8Array>();
  const fail = new Set<string>();
  const short = new Set<string>();
  const ops: string[] = [];
  const b: MediaBackend = {
    name,
    url: (k) => `${base}${k}`,
    async put(k, body) {
      ops.push(`put ${k}`);
      if (fail.has(k)) throw new Error('boom');
      objects.set(k, short.has(k) ? body.slice(1) : body);
      return `${base}${k}`;
    },
    async get(k) {
      ops.push(`get ${k}`);
      const o = objects.get(k);
      return o ? new Response(o) : new Response(null, { status: 404 });
    },
    async delete(k) {
      ops.push(`delete ${k}`);
      objects.delete(k);
    },
    head: async (k) => {
      const o = objects.get(k);
      return o ? { size: o.length, contentType: null } : null;
    },
  };
  return { b, objects, fail, short, ops };
}

type Row = MoveRow & { url: string; storage: string; moveState: string | null; moveTries: number; moveError: string | null; deleted: boolean };

/** media_objects and the other tables' URL cells, in memory, behaving like PgMoveStore */
function world() {
  const rows: Row[] = [];
  /** table.column → cell texts */
  const cells = new Map<string, string[]>();
  const store: MoveStore = {
    async nextBatch(limit, maxTries) {
      return rows
        .filter((r) => !r.deleted && r.storage === 'bunny' && (r.moveState === null || (r.moveState === 'failed' && r.moveTries < maxTries)))
        .sort((a, b) => a.moveTries - b.moveTries || a.id.localeCompare(b.id))
        .slice(0, limit)
        .map(({ id, key, mime, sizeBytes }) => ({ id, key, mime, sizeBytes }));
    },
    async markCopied(id) {
      const r = rows.find((x) => x.id === id && !x.deleted && x.storage === 'bunny');
      if (!r) return false;
      Object.assign(r, { moveState: 'copied', moveError: null, moveTries: r.moveTries + 1 });
      return true;
    },
    async markMissing(id, error) {
      const r = rows.find((x) => x.id === id && x.storage === 'bunny')!;
      Object.assign(r, { moveState: 'missing', moveError: error, moveTries: r.moveTries + 1 });
    },
    async markFailed(id, error) {
      const r = rows.find((x) => x.id === id && x.storage === 'bunny')!;
      Object.assign(r, { moveState: 'failed', moveError: error, moveTries: r.moveTries + 1 });
    },
    async counts(maxTries, from): Promise<MoveCounts> {
      const live = rows.filter((r) => !r.deleted && (r.storage === 'bunny' || r.storage === 'r2'));
      const c = (f: (r: Row) => boolean) => live.filter(f).length;
      const sum = (f: (r: Row) => boolean) => live.filter(f).reduce((a, r) => a + r.sizeBytes, 0);
      const was = (r: Row) => r.storage === 'bunny' || r.moveState !== null;
      return {
        total: c(was),
        waiting: c((r) => r.storage === 'bunny' && (r.moveState === null || (r.moveState === 'failed' && r.moveTries < maxTries))),
        copied: c((r) => r.storage === 'bunny' && r.moveState === 'copied'),
        switched: c((r) => r.storage === 'r2' && r.moveState !== null),
        failed: c((r) => r.storage === 'bunny' && r.moveState === 'failed' && r.moveTries >= maxTries),
        missing: c((r) => r.storage === 'bunny' && r.moveState === 'missing'),
        switchedMissing: c((r) => r.storage === 'r2' && r.moveState === 'missing'),
        bytesTotal: sum(was),
        bytesMoved: sum((r) => r.moveState === 'copied'),
        otherUrls: c((r) => r.storage === 'bunny' && !r.url.startsWith(from)),
      };
    },
    async switchAll(p) {
      let n = 0;
      for (const r of rows)
        if (!r.deleted && r.storage === 'bunny' && (r.moveState === 'copied' || r.moveState === 'missing')) {
          Object.assign(r, { storage: 'r2', url: p.to + r.key });
          n++;
        }
      const columns: ColumnCount[] = [];
      for (const [k, v] of cells) {
        const hits = v.filter((t) => t.includes(p.from)).length;
        if (!hits) continue;
        cells.set(
          k,
          v.map((t) => rewriteUrl(t, p)),
        );
        const [table, column] = k.split('.');
        columns.push({ table, column, rows: hits });
      }
      return { rows: n, columns };
    },
    async bunnyRefs(from) {
      return [...cells].map(([k, v]) => ({ table: k.split('.')[0], column: k.split('.')[1], rows: v.filter((t) => t.includes(from)).length }));
    },
    async retryFailed() {
      const f = rows.filter((r) => r.storage === 'bunny' && r.moveState === 'failed' && !r.deleted);
      for (const r of f) Object.assign(r, { moveState: null, moveTries: 0 });
      return f.length;
    },
  };
  const bunny = bucket('bunny', P.from);
  const r2 = bucket('r2', P.to);
  /** a file on Bunny with its row */
  const file = (i: number, bytes = 3 + i) => {
    const key = `photo/aa/u1/${String(i).padStart(4, '0')}.webp`;
    bunny.objects.set(key, new Uint8Array(bytes).fill(i));
    rows.push({ id: `id-${String(i).padStart(4, '0')}`, key, mime: 'image/webp', sizeBytes: bytes, url: P.from + key, storage: 'bunny', moveState: null, moveTries: 0, moveError: null, deleted: false });
    return key;
  };
  const mover = new R2Mover(store, bunny.b, r2.b, P, 2);
  return { rows, cells, store, bunny, r2, file, mover };
}

describe('Bunny → R2 copy', () => {
  it('copies in small batches, verifies the size, keeps the rows on their Bunny URLs until the switch', async () => {
    const w = world();
    for (let i = 0; i < 5; i++) w.file(i);
    const a = await w.mover.batch(2);
    expect(a).toMatchObject({ tried: 2, copied: 2, failed: 0, bytes: 3 + 4 });
    expect([...w.r2.objects.keys()]).toEqual([w.rows[0].key, w.rows[1].key]);
    expect(w.rows[0]).toMatchObject({ storage: 'bunny', moveState: 'copied', url: P.from + w.rows[0].key });
    expect(w.r2.objects.get(w.rows[1].key)).toEqual(w.bunny.objects.get(w.rows[1].key));
    expect(await w.mover.status()).toMatchObject({ total: 5, waiting: 3, copied: 2, switched: 0, bytesMoved: 7, bytesTotal: 3 + 4 + 5 + 6 + 7 });
    await w.mover.batch(10);
    expect((await w.mover.status()).waiting).toBe(0);
  });

  it('is idempotent and resumes: an object already in R2 with the right size is only marked, never copied twice', async () => {
    const w = world();
    const k = w.file(1);
    w.r2.objects.set(k, w.bunny.objects.get(k)!); // a run that stopped after the put
    const r = await w.mover.batch(5);
    expect(r).toMatchObject({ copied: 0, resumed: 1 });
    expect(w.bunny.ops).toEqual([]);
    expect(w.r2.ops).toEqual([]);
    expect(await w.mover.batch(5)).toMatchObject({ tried: 0 });
  });

  it('a half object in R2 is copied again; a broken put or a size that differs is failed and tried again up to MAX_TRIES', async () => {
    const w = world();
    const k1 = w.file(1);
    const k2 = w.file(2);
    const k3 = w.file(3);
    w.r2.objects.set(k1, new Uint8Array(1));
    w.r2.fail.add(k2);
    w.r2.short.add(k3);
    const r = await w.mover.batch(5);
    expect(r).toMatchObject({ copied: 1, failed: 2 });
    expect(r.errors.join('\n')).toMatch(/boom/);
    expect(w.rows[2].moveError).toMatch(/R2 check/);
    for (let i = 1; i < MAX_TRIES; i++) await w.mover.batch(5);
    expect(w.rows[1]).toMatchObject({ moveState: 'failed', moveTries: MAX_TRIES });
    expect(await w.mover.batch(5)).toMatchObject({ tried: 0 });
    const c = await w.mover.status();
    expect(c).toMatchObject({ waiting: 0, failed: 2, copied: 1 });
    // failures block the switch
    expect((await w.mover.tick(5)).step).toBe('idle');
    w.r2.fail.clear();
    w.r2.short.clear();
    expect(await w.mover.retry()).toBe(2);
    expect(await w.mover.batch(5)).toMatchObject({ copied: 2, failed: 0 });
  });

  it('a file gone from Bunny is missing (not failed); a row with a wrong length on Bunny fails', async () => {
    const w = world();
    const k = w.file(1);
    w.bunny.objects.delete(k);
    const k2 = w.file(2);
    w.bunny.objects.set(k2, new Uint8Array(99));
    const r = await w.mover.batch(5);
    expect(r).toMatchObject({ missing: 1, failed: 1 });
    expect(w.rows[0].moveState).toBe('missing');
    expect(w.rows[1].moveError).toMatch(/size differs: Bunny 99, row 5/);
    expect(w.r2.objects.has(k2)).toBe(false);
  });

  it('a row deleted while it was copied: the R2 copy is removed too', async () => {
    const w = world();
    const k = w.file(1);
    const realPut = w.r2.b.put;
    w.r2.b.put = async (key, body, type) => {
      w.rows[0].deleted = true;
      return realPut(key, body, type);
    };
    await w.mover.batch(5);
    expect(w.r2.objects.has(k)).toBe(false);
    expect(w.rows[0].moveState).toBeNull();
  });

  it('switches when all is copied: rows to R2 with the same key, every other URL rewritten; then Bunny can be cancelled', async () => {
    const w = world();
    const k0 = w.file(0);
    const k1 = w.file(1);
    w.cells.set('songs.mix_url', [P.from + k0, 'https://elsewhere.example/x.mp3']);
    w.cells.set('moon_works.versions_json', [JSON.stringify([{ url: P.from + k0 }, { url: P.from + k1, poster: P.from + k1 }])]);
    w.cells.set('users.handle', ['kimi']);
    const before = await w.mover.readiness();
    expect(before.ready).toBe(false);
    expect(before.reasons.join('\n')).toMatch(/2 file rows still on Bunny/);
    expect((await w.mover.tick(10)).step).toBe('copy');
    const sw = await w.mover.tick(10);
    expect(sw).toEqual({
      step: 'switch',
      rows: 2,
      columns: [
        { table: 'songs', column: 'mix_url', rows: 1 },
        { table: 'moon_works', column: 'versions_json', rows: 1 },
      ],
    });
    expect(w.rows.map((r) => [r.storage, r.url])).toEqual([
      ['r2', P.to + k0],
      ['r2', P.to + k1],
    ]);
    expect(w.cells.get('songs.mix_url')).toEqual([P.to + k0, 'https://elsewhere.example/x.mp3']);
    expect(JSON.parse(w.cells.get('moon_works.versions_json')![0])).toEqual([{ url: P.to + k0 }, { url: P.to + k1, poster: P.to + k1 }]);
    const c = await w.mover.status();
    expect(c).toMatchObject({ total: 2, switched: 2, waiting: 0, copied: 0 });
    expect(line(c)).toMatch(/^total 2 \/ migrated 2 \(switched 2\) \/ waiting 0 \/ failed 0 \/ missing 0/);
    expect(await w.mover.readiness()).toMatchObject({ ready: true, reasons: [] });
    // again: nothing left (one more sweep of the columns in this process, then idle)
    expect((await w.mover.tick(10)).step).toBe('idle');
    // the Bunny objects were never deleted by the move (Bunny is cancelled by hand)
    expect(w.bunny.objects.size).toBe(2);
  });

  it('a Bunny URL written after the switch is caught by the readiness check', async () => {
    const w = world();
    w.file(0);
    await w.mover.tick(10);
    await w.mover.tick(10);
    w.cells.set('users.avatar_url', [`${P.from}late.webp`]);
    const r = await w.mover.readiness();
    expect(r.ready).toBe(false);
    expect(r.reasons).toEqual([`users.avatar_url: 1 rows still hold ${P.from}`]);
  });
});

describe('which backend in the API', () => {
  const base = { BUNNY_STORAGE_ENDPOINT: 'sg.storage.bunnycdn.com' } as AppConfig;
  const bunny = { BUNNY_STORAGE_ZONE: 'z', BUNNY_STORAGE_KEY: 'k', BUNNY_CDN_HOST: 'obolo.b-cdn.net' };
  const r2 = { R2_ACCOUNT_ID: 'acc', R2_BUCKET: 'obolo-media', R2_ACCESS_KEY_ID: 'a', R2_SECRET_ACCESS_KEY: 's', R2_PUBLIC_BASE: 'https://media.obolo.life' };
  it('R2 when all of R2_* are set (Bunny kept for reading the old files), Bunny without them, none in dev', () => {
    const both = mediaBackends({ ...base, ...bunny, ...r2 });
    expect([both.r2?.name, both.bunny?.name]).toEqual(['r2', 'bunny']);
    expect(both.r2!.url('photo/aa/u/x.webp')).toBe('https://media.obolo.life/photo/aa/u/x.webp');
    expect(mediaBackends({ ...base, ...bunny, ...r2, R2_SECRET_ACCESS_KEY: undefined }).r2).toBeNull();
    expect(mediaBackends({ ...base, ...bunny }).bunny!.url('a/b')).toBe('https://obolo.b-cdn.net/a/b');
    expect(mediaBackends(base)).toEqual({ r2: null, bunny: null });
  });
  it('a delete reaches every copy', () => {
    const b = mediaBackends({ ...base, ...bunny, ...r2 });
    const names = (s: string, m: string | null) => holdersOf(b, s, m).map((x) => x.name);
    expect(names('r2', null)).toEqual(['r2']);
    expect(names('r2', 'copied')).toEqual(['r2', 'bunny']);
    expect(names('bunny', null)).toEqual(['r2', 'bunny']);
    expect(names('db', null)).toEqual([]);
    expect(holdersOf(mediaBackends({ ...base, ...bunny }), 'bunny', null).map((x) => x.name)).toEqual(['bunny']);
  });
});
