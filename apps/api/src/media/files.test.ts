import { CLIP_CHUNK_BYTES, CLIP_MAX_BYTES, type ClipFile } from '@obolo/shared';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { clipView, disposition, docLooksRight, isHeif } from './clip-view';
import { FilesService, lookLine, type ClipSession } from './files.service';

/** the API error's code ({ error: { code } }) */
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { getResponse?: () => { error?: { code?: string } } }).getResponse?.().error?.code ?? String(e);
  }
};

const A = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000002';
const C = 'c0000000-0000-4000-8000-000000000003';
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

type Row = { id: string; userId: string; kind: string; mime: string; sizeBytes: number; storage: string; key: string; url: string; data: Buffer | null; meta: unknown; createdAt: Date };

/** the service with its storage, KV and database lookups replaced by a little world in memory */
function world(o: { llm?: unknown } = {}) {
  const sessions = new Map<string, ClipSession>();
  const parts = new Map<string, Buffer>();
  const rows: Row[] = [];
  const sent: { fileId: string; from: string; to: string }[] = [];
  const dachi = new Set<string>();
  const removed: string[] = [];
  const media = {
    storeFile: async (userId: string, mime: string, data: Buffer, meta: unknown, _o: string, id: string) => {
      rows.push({ id, userId, kind: 'file', mime, sizeBytes: data.length, storage: 'db', key: `file/${id}`, url: `x/${id}`, data, meta, createdAt: new Date() });
      return { id, url: `x/${id}`, mime, sizeBytes: data.length };
    },
    removeByUrl: async (_u: string, url: string) => void removed.push(url),
  };
  const s = new FilesService({} as never, {} as never, media as never, {} as never, o.llm as never);
  const x = s as unknown as Record<string, unknown>;
  x.session = async (id: string) => sessions.get(id) ?? null;
  x.keepSession = async (id: string, v: ClipSession | null) => void (v ? sessions.set(id, v) : sessions.delete(id));
  x.putPart = async (id: string, n: number, d: Buffer) => void parts.set(`${id}/${n}`, d);
  x.readPart = async (id: string, n: number) => parts.get(`${id}/${n}`) ?? null;
  x.dropParts = async (id: string) => {
    for (const k of [...parts.keys()]) if (k.startsWith(`${id}/`)) parts.delete(k);
  };
  x.row = async (id: string) => rows.find((r) => r.id === id) ?? null;
  x.rowsOf = async (u: string) => rows.filter((r) => r.userId === u).reverse();
  x.sender = async (fileId: string, viewer: string) => sent.find((m) => m.fileId === fileId && m.to === viewer)?.from ?? null;
  x.areDachi = async (a: string, b: string) => dachi.has([a, b].sort().join('|'));
  const befriend = (a: string, b: string) => dachi.add([a, b].sort().join('|'));
  /** the whole upload, as the web does it: start, the pieces, done */
  const upload = async (userId: string, name: string, type: string, data: Buffer) => {
    const st = await s.start(userId, { name, type, size: data.length });
    for (let n = 0; n < st.parts; n++) await s.part(userId, st.id, n, data.subarray(n * st.chunkBytes, (n + 1) * st.chunkBytes));
    return s.done(userId, st.id, 'http://api');
  };
  return { s, sessions, parts, rows, sent, befriend, removed, upload };
}

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

describe('Bluena 📎: what may be uploaded', () => {
  it('refuses a type Bluena does not keep, and a file over its kind’s limit', async () => {
    const w = world();
    expect(await code(w.s.start(A, { name: 'setup.exe', type: 'application/x-msdownload', size: 10 }))).toBe('UNSUPPORTED_FILE');
    expect(await code(w.s.start(A, { name: 'page.html', type: 'text/html', size: 10 }))).toBe('UNSUPPORTED_FILE');
    expect(await code(w.s.start(A, { name: 'big.mov', type: 'video/quicktime', size: CLIP_MAX_BYTES.video + 1 }))).toBe('TOO_LARGE');
    expect(await code(w.s.start(A, { name: 'big.pdf', type: 'application/pdf', size: CLIP_MAX_BYTES.file + 1 }))).toBe('TOO_LARGE');
    const ok = await w.s.start(A, { name: 'IMG_0001.HEIC', type: '', size: 3_000_000 });
    expect(ok).toMatchObject({ parts: 1, chunkBytes: CLIP_CHUNK_BYTES });
    expect(w.sessions.get(ok.id)).toMatchObject({ userId: A, kind: 'photo', type: 'image/heic' });
  });

  it('takes the pieces only from the one who started, each exactly as long as it must be', async () => {
    const w = world();
    const st = await w.s.start(A, { name: 'film.mp4', type: 'video/mp4', size: CLIP_CHUNK_BYTES + 10 });
    expect(st.parts).toBe(2);
    expect(await code(w.s.part(B, st.id, 0, Buffer.alloc(CLIP_CHUNK_BYTES)))).toBe('UPLOAD_NOT_FOUND');
    expect(await code(w.s.part(A, st.id, 0, Buffer.alloc(10)))).toBe('BAD_PART');
    expect(await code(w.s.part(A, st.id, 2, Buffer.alloc(10)))).toBe('BAD_PART');
    expect(await code(w.s.part(A, st.id, 1, Buffer.alloc(10)))).toBeNull();
    // a piece missing: not finished, nothing kept
    expect(await code(w.s.done(A, st.id, 'http://api'))).toBe('UPLOAD_INCOMPLETE');
    expect(w.rows).toHaveLength(0);
  });

  it('a document must be what it says it is; a real one is kept as it is', async () => {
    const w = world();
    expect(await code(w.upload(A, 'fake.pdf', 'application/pdf', Buffer.from('MZ\x90\x00 not a pdf')))).toBe('BAD_FILE');
    const f = await w.upload(A, 'レシピ.pdf', 'application/pdf', PDF);
    expect(f).toMatchObject({ kind: 'file', name: 'レシピ.pdf', mime: 'application/pdf', sizeBytes: PDF.length });
    expect(w.rows[0].data?.equals(PDF)).toBe(true);
    // the pieces are gone once it is kept
    expect(w.parts.size).toBe(0);
    expect(await w.s.list(A)).toMatchObject([{ id: f.id, kind: 'file', name: 'レシピ.pdf' }]);
    expect(await w.s.list(B)).toEqual([]);
  });

  it('a picture is made into WebP with its metadata (GPS) dropped', async () => {
    const w = world();
    const jpeg = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#88aaff' } })
      .jpeg()
      .withExif({ IFD0: { Make: 'TestPhone', Model: 'GPS' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '35/1 41/1 0/1' } })
      .toBuffer();
    expect((await sharp(jpeg).metadata()).exif).toBeTruthy();
    const f = await w.upload(A, 'IMG_0002.JPG', 'image/jpeg', jpeg);
    expect(f).toMatchObject({ kind: 'photo', mime: 'image/webp', width: 1600, height: 800 });
    const meta = await sharp(w.rows[0].data!).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
    // not a picture at all
    expect(await code(w.upload(A, 'x.png', 'image/png', Buffer.from('hello')))).toBe('BAD_IMAGE');
  });

  it.runIf(hasFfmpeg)('a sound is made into AAC with its length', async () => {
    const w = world();
    const wav = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-f', 'wav', 'pipe:1']);
    const f = await w.upload(A, 'memo.wav', 'audio/wav', wav);
    expect(f).toMatchObject({ kind: 'audio', mime: 'audio/mp4' });
    expect(f.seconds).toBeGreaterThan(1.5);
    expect(await code(w.upload(A, 'noise.mp3', 'audio/mpeg', Buffer.from('not a sound at all')))).toBe('BAD_AUDIO');
  }, 30_000);
});

describe('Bluena 📎: who may open a file', () => {
  it('its owner; the ダチ it was sent to, while ダチ; nobody else', async () => {
    const w = world();
    const f = await w.upload(A, 'plan.pdf', 'application/pdf', PDF);
    expect((await w.s.open(A, f.id)).id).toBe(f.id);
    // not sent to anybody: B cannot open it, even as ダチ
    w.befriend(A, B);
    expect(await code(w.s.open(B, f.id))).toBe('FILE_NOT_FOUND');
    w.sent.push({ fileId: f.id, from: A, to: B });
    expect((await w.s.open(B, f.id)).id).toBe(f.id);
    // a stranger, even knowing the id
    expect(await code(w.s.open(C, f.id))).toBe('FILE_NOT_FOUND');
    // no longer ダチ (a block, an unfollow): closed again
    w.befriend(A, B);
    const x = w.s as unknown as Record<string, unknown>;
    x.areDachi = async () => false;
    expect(await code(w.s.open(B, f.id))).toBe('FILE_NOT_FOUND');
  });

  it("a film's poster goes with its film", async () => {
    const w = world();
    w.rows.push({ id: 'v1', userId: A, kind: 'file', mime: 'video/mp4', sizeBytes: 5, storage: 'db', key: 'k', url: 'x/v1', data: Buffer.alloc(5), meta: { sub: 'video', name: 'a.mov', posterId: 'p1' }, createdAt: new Date() });
    w.rows.push({ id: 'p1', userId: A, kind: 'file', mime: 'image/webp', sizeBytes: 5, storage: 'db', key: 'k', url: 'x/p1', data: Buffer.alloc(5), meta: { sub: 'poster', name: 'a.webp', parent: 'v1' }, createdAt: new Date() });
    w.befriend(A, B);
    expect(await code(w.s.open(B, 'p1'))).toBe('FILE_NOT_FOUND');
    w.sent.push({ fileId: 'v1', from: A, to: B });
    expect((await w.s.open(B, 'p1')).id).toBe('p1');
    // the poster is not a Bluena item of its own
    expect((await w.s.list(A)).map((v) => v.id)).toEqual(['v1']);
    // removing the film takes its poster with it; only the owner can
    expect(await code(w.s.remove(B, 'v1'))).toBe('FILE_NOT_FOUND');
    await w.s.remove(A, 'v1');
    expect(w.removed).toEqual(['x/p1', 'x/v1']);
  });
});

describe('Bluena 📎: handed to {bati}', () => {
  const pic = async (w: ReturnType<typeof world>) => w.upload(A, 'sea.png', 'image/png', await sharp({ create: { width: 40, height: 40, channels: 3, background: '#0af' } }).png().toBuffer());

  it('a picture is looked at, and {bati} says one short thing', async () => {
    const seen: string[] = [];
    const llm = { name: 't', chat: async () => '{"flagged":false}', perceive: async (i: { mime: string }) => (seen.push(i.mime), '{"line":"青い空みたい。きれいだね"}') };
    const w = world({ llm });
    const f = await pic(w);
    expect(await w.s.look(A, f.id)).toEqual({ line: '青い空みたい。きれいだね', looked: true });
    expect(seen).toEqual(['image/webp']);
    // someone else's file: not theirs to hand over
    expect(await code(w.s.look(B, f.id))).toBe('FILE_NOT_FOUND');
  });

  it('no eyes, a failure, or not a picture: a line by kind', async () => {
    const w = world();
    const f = await pic(w);
    expect(await w.s.look(A, f.id)).toMatchObject({ looked: false, line: expect.stringContaining('写真') });
    const broken = world({ llm: { name: 't', chat: async () => '', perceive: async () => Promise.reject(new Error('down')) } });
    const g = await pic(broken);
    expect((await broken.s.look(A, g.id)).looked).toBe(false);
    const doc = await w.upload(A, 'a.pdf', 'application/pdf', PDF);
    expect(await w.s.look(A, doc.id)).toMatchObject({ looked: false, line: expect.stringContaining('ファイル') });
  });

  it('reads the words out of the answer', () => {
    expect(lookLine('{"line":"ねこだ！ ふわふわ"}')).toBe('ねこだ！ ふわふわ');
    expect(lookLine('```json\n{"line": "「海の色」"}\n```')).toBe('海の色');
    expect(lookLine('きれいな夕焼けだね')).toBe('きれいな夕焼けだね');
    expect(lookLine('{"nope":1}')).toBeNull();
    expect(lookLine('あ'.repeat(120))!.length).toBe(80);
  });
});

describe('Bluena 📎: small helpers', () => {
  it('checks a document by its first bytes', () => {
    expect(docLooksRight('application/pdf', PDF)).toBe(true);
    expect(docLooksRight('application/pdf', Buffer.from('PK\x03\x04'))).toBe(false);
    expect(docLooksRight('application/vnd.openxmlformats-officedocument.wordprocessingml.document', Buffer.from([0x50, 0x4b, 0x03, 0x04, 1]))).toBe(true);
    expect(docLooksRight('text/plain', Buffer.from('こんにちは\nhello'))).toBe(true);
    expect(docLooksRight('text/plain', Buffer.from([0x41, 0x00, 0x42]))).toBe(false);
    expect(docLooksRight('application/x-sh', Buffer.from('#!/bin/sh'))).toBe(false);
  });

  it('knows an iPhone HEIC by its ftyp box', () => {
    const box = (brand: string) => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from(`ftyp${brand}`), Buffer.alloc(12)]);
    expect(isHeif(box('heic'))).toBe(true);
    expect(isHeif(box('mif1'))).toBe(true);
    expect(isHeif(box('isom'))).toBe(false);
  });

  it('names the file for the browser, a document as an attachment', () => {
    expect(disposition('file', 'レシピ.pdf')).toBe(`attachment; filename="___.pdf"; filename*=UTF-8''${encodeURIComponent('レシピ.pdf')}`);
    expect(disposition('photo', 'a"b.jpg')).toMatch(/^inline; filename="a_b.jpg"/);
  });

  it('a row is a Bluena file only with its meta (a poster is not one)', () => {
    const at = new Date('2026-11-24T00:00:00Z');
    const v: ClipFile | null = clipView({ id: 'f', mime: 'audio/mp4', sizeBytes: 9, meta: { sub: 'audio', name: 'a.m4a', seconds: 3 }, createdAt: at });
    expect(v).toMatchObject({ kind: 'audio', seconds: 3, createdAt: at.toISOString() });
    expect(clipView({ id: 'p', mime: 'image/webp', sizeBytes: 9, meta: { sub: 'poster', name: 'p' }, createdAt: at })).toBeNull();
    expect(clipView({ id: 'x', mime: 'image/webp', sizeBytes: 9, meta: null, createdAt: at })).toBeNull();
  });
});
