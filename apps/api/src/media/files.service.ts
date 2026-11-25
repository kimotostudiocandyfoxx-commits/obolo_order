import { HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { moderateText, type LlmProvider } from '@obolo/ai';
import { deleteObject, getObject, putObject } from '@obolo/media';
import {
  CLIP_AUDIO_MAX_SECONDS,
  CLIP_BATI_LINES,
  CLIP_CHUNK_BYTES,
  CLIP_MAX_BYTES,
  CLIP_WORD,
  MEDIA_POLICY,
  clipKindOf,
  clipName,
  clipPartBytes,
  clipParts,
  clipType,
  type ClipFile,
  type ClipKind,
  type ClipStartBody,
  type ClipUploadStart,
} from '@obolo/shared';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppConfig, CONFIG } from '../config';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { dachiMessages, follows, mediaObjects, userBlocks, users } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV, LLM } from '../infra/tokens';
import { clipView, docLooksRight, isHeif, metaOf, type ClipMeta } from './clip-view';
import { MediaService } from './media.service';
import { heicToJpeg, probe, probeAudio, transcodeAudio, transcodePhoto, transcodeVideo, videoPoster } from './transcode';

/** an upload in progress (KV, an hour) */
export type ClipSession = { userId: string; name: string; type: string; size: number; kind: ClipKind; parts: number };
type Row = typeof mediaObjects.$inferSelect;
const SESSION_TTL = 3600;

/** what {bati} is asked when a picture is handed over (perceive: the picture + this; JSON back) */
export const CLIP_LOOK_PROMPT =
  'あなたは、相手のそばにいる小さな相棒です。相手が、自分の写真を一枚見せてくれました。' +
  '写真に写っているものを見て、やさしく短く、ひとことで返してください（40字くらいまで、ひらがな多め、です・ます調にしない、友だちに話すように）。' +
  '見えたものを一つ具体的に言い、気持ちを少しそえる。人の顔や見た目を評価しない、名前を当てない、場所を特定しない。' +
  '答えは JSON だけ：{"line":"…"}';

/**
 * Bluena's 📎 (client 2026-11-24): the member's own pictures, films, sounds and documents from their device. Stored like
 * every other upload (Bunny, else Postgres in dev; the 1 GB quota; re-encoded — docs/media.md) but private: the file
 * row is kind 'file', it is never served by the public GET /media/:id, and GET /media/files/:id gives it only to its
 * owner and to the ダチ of a talk it was sent into (while still ダチ). The pieces of an upload wait in Bunny under
 * tmp/ (else a temp folder) until …/done.
 */
@Injectable()
export class FilesService {
  private readonly log = new Logger('Files');
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly db: Database,
    private readonly media: MediaService,
    @Inject(KV) private readonly kv: KvStore,
    @Optional() @Inject(LLM) private readonly llm?: LlmProvider,
  ) {}

  private get bunny() {
    const c = this.cfg;
    if (!c.BUNNY_STORAGE_ZONE || !c.BUNNY_STORAGE_KEY || !c.BUNNY_CDN_HOST) return null;
    return { zone: c.BUNNY_STORAGE_ZONE, accessKey: c.BUNNY_STORAGE_KEY, endpoint: c.BUNNY_STORAGE_ENDPOINT, cdnHost: c.BUNNY_CDN_HOST };
  }

  // ── small lookups (stubbed in tests) ──

  protected async session(id: string): Promise<ClipSession | null> {
    const raw = await this.kv.get(`clip:${id}`);
    return raw ? (JSON.parse(raw) as ClipSession) : null;
  }
  protected async keepSession(id: string, s: ClipSession | null) {
    if (s) await this.kv.set(`clip:${id}`, JSON.stringify(s), SESSION_TTL);
    else await this.kv.del(`clip:${id}`);
  }
  private partKey = (id: string, n: number) => `tmp/clip/${id}/${n}`;
  private partFile = (id: string, n: number) => join(tmpdir(), 'obolo-clip', id, String(n));
  protected async putPart(id: string, n: number, data: Buffer) {
    const b = this.bunny;
    if (b) return void (await putObject(b, this.partKey(id, n), data, 'application/octet-stream'));
    await mkdir(join(tmpdir(), 'obolo-clip', id), { recursive: true });
    await writeFile(this.partFile(id, n), data);
  }
  protected async readPart(id: string, n: number): Promise<Buffer | null> {
    const b = this.bunny;
    if (b) {
      const res = await getObject(b, this.partKey(id, n));
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    }
    return readFile(this.partFile(id, n)).catch(() => null);
  }
  protected async dropParts(id: string, parts: number) {
    const b = this.bunny;
    if (b) await Promise.all(Array.from({ length: parts }, (_, n) => deleteObject(b, this.partKey(id, n)).catch(() => undefined)));
    else await rm(join(tmpdir(), 'obolo-clip', id), { recursive: true, force: true });
  }
  protected async row(id: string): Promise<Row | null> {
    const [m] = await this.db.write
      .select()
      .from(mediaObjects)
      .where(and(eq(mediaObjects.id, id), eq(mediaObjects.kind, 'file'), isNull(mediaObjects.deletedAt)));
    return m ?? null;
  }
  protected async rowsOf(userId: string): Promise<Row[]> {
    return this.db.read
      .select()
      .from(mediaObjects)
      .where(and(eq(mediaObjects.userId, userId), eq(mediaObjects.kind, 'file'), isNull(mediaObjects.deletedAt)))
      .orderBy(desc(mediaObjects.createdAt))
      .limit(200);
  }
  /** who sent this file to `viewer` in a ダチ talk (null: nobody did) */
  protected async sender(fileId: string, viewer: string): Promise<string | null> {
    const [m] = await this.db.write
      .select({ from: dachiMessages.senderId })
      .from(dachiMessages)
      .where(and(eq(dachiMessages.kind, 'file'), eq(dachiMessages.audioMediaId, fileId), eq(dachiMessages.recipientId, viewer), isNull(dachiMessages.deletedAt)))
      .limit(1);
    return m?.from ?? null;
  }
  /** both follow each other, nobody blocked anybody, the sender is still here */
  protected async areDachi(a: string, b: string): Promise<boolean> {
    if (a === b) return false;
    const res = await this.db.write.execute<{ f: string; bl: string; ok: string }>(sql`SELECT
      (SELECT count(*) FROM ${follows} WHERE (follower_id = ${a} AND followee_id = ${b}) OR (follower_id = ${b} AND followee_id = ${a})) AS f,
      (SELECT count(*) FROM ${userBlocks} WHERE (blocker_id = ${a} AND blocked_id = ${b}) OR (blocker_id = ${b} AND blocked_id = ${a})) AS bl,
      (SELECT count(*) FROM ${users} WHERE id = ${b} AND deleted_at IS NULL AND suspended_at IS NULL) AS ok`);
    const r = res.rows[0];
    return Number(r?.f) === 2 && Number(r?.bl) === 0 && Number(r?.ok) === 1;
  }

  // ── upload ──

  /** POST /media/files: what it is and how big; refused here when it is not something Bluena keeps, or too big */
  async start(userId: string, body: ClipStartBody): Promise<ClipUploadStart> {
    const type = clipType(body.type, body.name);
    const kind = clipKindOf(type, body.name);
    if (!kind) throw apiError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_FILE', `Unsupported file type: ${type || 'none'}`);
    if (body.size > CLIP_MAX_BYTES[kind]) throw apiError(HttpStatus.PAYLOAD_TOO_LARGE, 'TOO_LARGE', `${CLIP_WORD[kind]} is too large`);
    const id = randomUUID();
    const parts = clipParts(body.size);
    await this.keepSession(id, { userId, name: clipName(body.name), type, size: body.size, kind, parts });
    return { id, parts, chunkBytes: CLIP_CHUNK_BYTES };
  }

  private async mine(userId: string, id: string) {
    const s = await this.session(id);
    if (!s || s.userId !== userId) throw apiError(HttpStatus.NOT_FOUND, 'UPLOAD_NOT_FOUND', 'Upload not found');
    return s;
  }

  /** POST /media/files/:id/parts/:n — each piece exactly as long as it must be */
  async part(userId: string, id: string, n: number, data: Buffer) {
    const s = await this.mine(userId, id);
    if (!Number.isInteger(n) || n < 0 || n >= s.parts) throw apiError(HttpStatus.BAD_REQUEST, 'BAD_PART', 'No such piece');
    if (data.length !== clipPartBytes(s.size, n)) throw apiError(HttpStatus.BAD_REQUEST, 'BAD_PART', 'This piece has the wrong length');
    await this.putPart(id, n, data);
    return { ok: true, n };
  }

  /** POST /media/files/:id/done — the pieces joined, checked, made lighter and kept */
  async done(userId: string, id: string, origin: string): Promise<ClipFile> {
    const s = await this.mine(userId, id);
    const pieces: Buffer[] = [];
    for (let n = 0; n < s.parts; n++) {
      const p = await this.readPart(id, n);
      if (!p) throw apiError(HttpStatus.CONFLICT, 'UPLOAD_INCOMPLETE', `Piece ${n} is missing`);
      pieces.push(p);
    }
    const data = Buffer.concat(pieces);
    if (data.length !== s.size) throw apiError(HttpStatus.CONFLICT, 'UPLOAD_INCOMPLETE', 'The file is not complete');
    try {
      const view = await this.keep(userId, s, data, origin);
      await this.keepSession(id, null);
      return view;
    } finally {
      await this.dropParts(id, s.parts);
    }
  }

  /** what is kept, by kind (all re-encoded but documents; pictures lose their metadata, GPS included) */
  protected async keep(userId: string, s: ClipSession, data: Buffer, origin: string): Promise<ClipFile> {
    const dir = await mkdtemp(join(tmpdir(), 'obolo-clip-'));
    const id = randomUUID();
    const at = new Date();
    const view = (mime: string, size: number, meta: ClipMeta) => clipView({ id, mime, sizeBytes: size, meta, createdAt: at })!;
    try {
      const input = join(dir, 'in');
      await writeFile(input, data);
      if (s.kind === 'photo') {
        let out: Awaited<ReturnType<typeof transcodePhoto>>;
        try {
          out = await transcodePhoto(data);
        } catch {
          // an iPhone HEIC sharp cannot open: libheif first, then the same re-encode
          if (!isHeif(data)) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_IMAGE', 'Could not read this picture');
          try {
            out = await transcodePhoto(await heicToJpeg(input, join(dir, 'heic.jpg')));
          } catch (e) {
            this.log.warn(`heic failed: ${e instanceof Error ? e.message : String(e)}`);
            throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_IMAGE', 'Could not read this picture');
          }
        }
        const meta: ClipMeta = { sub: 'photo', name: s.name, width: out.width, height: out.height };
        await this.media.storeFile(userId, 'image/webp', out.data, meta, origin, id);
        return view('image/webp', out.data.length, meta);
      }
      if (s.kind === 'video') {
        const info = await probe(input).catch(() => null);
        if (!info?.hasVideo) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_VIDEO', 'Could not read this video');
        const outFile = join(dir, 'out.mp4');
        try {
          await transcodeVideo(input, outFile, MEDIA_POLICY.video.maxSeconds);
        } catch (e) {
          this.log.warn(`clip video failed: ${e instanceof Error ? e.message : String(e)}`);
          throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_VIDEO', 'Could not convert this video');
        }
        const out = await probe(outFile);
        const poster = await videoPoster(outFile, join(dir, 'poster.png'));
        const posterId = randomUUID();
        await this.media.storeFile(userId, 'image/webp', poster, { sub: 'poster', name: `${s.name}.webp`, parent: id }, origin, posterId);
        const mp4 = await readFile(outFile);
        const meta: ClipMeta = { sub: 'video', name: s.name, width: out.width, height: out.height, seconds: Math.round(out.seconds * 10) / 10, posterId };
        await this.media.storeFile(userId, 'video/mp4', mp4, meta, origin, id);
        return view('video/mp4', mp4.length, meta);
      }
      if (s.kind === 'audio') {
        const info = await probeAudio(input).catch(() => null);
        if (!info?.hasAudio) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_AUDIO', 'Could not read this sound');
        const outFile = join(dir, 'out.m4a');
        try {
          await transcodeAudio(input, outFile, CLIP_AUDIO_MAX_SECONDS);
        } catch (e) {
          this.log.warn(`clip audio failed: ${e instanceof Error ? e.message : String(e)}`);
          throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_AUDIO', 'Could not convert this sound');
        }
        const m4a = await readFile(outFile);
        const meta: ClipMeta = { sub: 'audio', name: s.name, seconds: Math.round(Math.min(info.seconds, CLIP_AUDIO_MAX_SECONDS) * 10) / 10 };
        await this.media.storeFile(userId, 'audio/mp4', m4a, meta, origin, id);
        return view('audio/mp4', m4a.length, meta);
      }
      if (!docLooksRight(s.type, data.subarray(0, 65536))) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_FILE', 'This file is not what it says it is');
      const meta: ClipMeta = { sub: 'file', name: s.name };
      await this.media.storeFile(userId, s.type, data, meta, origin, id);
      return view(s.type, data.length, meta);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  // ── reading ──

  /** GET /media/files: your files in Bluena, newest first */
  async list(userId: string): Promise<ClipFile[]> {
    return (await this.rowsOf(userId)).map((r) => clipView(r)).filter((v): v is ClipFile => !!v);
  }

  /**
   * May `viewer` open this file? Its owner; or the ダチ it was sent to in a talk, while you are still ダチ (a film's
   * poster goes with its film). Anybody else gets "not found", the same as a file that does not exist.
   */
  async open(viewer: string, id: string): Promise<Row> {
    const r = await this.row(id);
    const gone = () => apiError(HttpStatus.NOT_FOUND, 'FILE_NOT_FOUND', 'File not found');
    if (!r) throw gone();
    if (r.userId === viewer) return r;
    const m = metaOf(r.meta);
    const via = m?.sub === 'poster' && m.parent ? m.parent : r.id;
    const from = await this.sender(via, viewer);
    if (from !== r.userId || !(await this.areDachi(viewer, r.userId))) throw gone();
    return r;
  }

  /** the bytes of a file allowed by open(): from Postgres, else Bunny Storage (never the public CDN) */
  async bytes(r: Row, range?: string): Promise<{ status: number; body: Buffer | ReadableStream<Uint8Array> | null; length?: number; range?: string }> {
    if (r.data) return { status: 200, body: r.data, length: r.data.length };
    const b = this.bunny;
    if (!b) return { status: 404, body: null };
    const res = await getObject(b, r.key, range);
    if (!res.ok) return { status: res.status === 416 ? 416 : 502, body: null };
    return { status: res.status, body: res.body, length: Number(res.headers.get('content-length')) || undefined, range: res.headers.get('content-range') ?? undefined };
  }

  /** DELETE /media/files/:id — your own (a film's poster goes with it) */
  async remove(userId: string, id: string) {
    const r = await this.row(id);
    if (!r || r.userId !== userId) throw apiError(HttpStatus.NOT_FOUND, 'FILE_NOT_FOUND', 'File not found');
    const poster = metaOf(r.meta)?.posterId;
    if (poster) {
      const p = await this.row(poster);
      if (p?.userId === userId) await this.media.removeByUrl(userId, p.url);
    }
    await this.media.removeByUrl(userId, r.url);
    return { ok: true };
  }

  /** R12 (the Moon's compass): the bytes of one of your own photos (null: not yours, not a photo, or not there) */
  async photo(userId: string, id: string): Promise<{ mime: string; data: Buffer } | null> {
    const r = await this.row(id);
    if (!r || r.userId !== userId || (metaOf(r.meta)?.sub ?? 'file') !== 'photo') return null;
    const got = await this.bytes(r);
    const data = Buffer.isBuffer(got.body) ? got.body : got.body ? Buffer.from(await new Response(got.body).arrayBuffer()) : null;
    return data ? { mime: r.mime, data } : null;
  }

  /**
   * POST /media/files/:id/look — a file handed to {bati}: a picture is looked at (the chat's perceive), and {bati} says
   * one short thing about it; anything else (or no eyes) gets a line by kind. Only your own files.
   */
  async look(userId: string, id: string): Promise<{ line: string; looked: boolean }> {
    const r = await this.row(id);
    if (!r || r.userId !== userId) throw apiError(HttpStatus.NOT_FOUND, 'FILE_NOT_FOUND', 'File not found');
    const kind = (metaOf(r.meta)?.sub ?? 'file') as ClipKind | 'poster';
    const fallback = { line: CLIP_BATI_LINES[kind === 'poster' ? 'photo' : kind], looked: false };
    if (kind !== 'photo' || !this.llm?.perceive) return fallback;
    try {
      const got = await this.bytes(r);
      const data = Buffer.isBuffer(got.body) ? got.body : got.body ? Buffer.from(await new Response(got.body).arrayBuffer()) : null;
      if (!data) return fallback;
      const raw = await this.llm.perceive({ mime: r.mime, data }, CLIP_LOOK_PROMPT);
      const line = lookLine(raw);
      if (!line || (await moderateText(line, this.llm)).flagged) return fallback;
      return { line, looked: true };
    } catch (e) {
      this.log.warn(`look failed: ${e instanceof Error ? e.message : String(e)}`);
      return fallback;
    }
  }
}

/** {bati}'s words out of the answer (JSON {"line"}; a bare sentence is taken too), short */
export function lookLine(raw: string): string | null {
  let t = raw.trim();
  try {
    const j = JSON.parse(t.match(/\{[\s\S]*\}/)?.[0] ?? 'null') as { line?: unknown } | null;
    if (j && typeof j.line === 'string') t = j.line;
  } catch {
    /* a bare sentence */
  }
  t = t.replace(/^["「]|["」]$/g, '').replace(/\s+/g, ' ').trim();
  if (!t || t.startsWith('{')) return null;
  return t.length > 80 ? `${t.slice(0, 79)}…` : t;
}
