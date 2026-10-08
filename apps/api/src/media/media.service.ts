import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { deleteObject, mediaKey, MediaKind, putObject } from '@obolo/media';
import { MEDIA_POLICY, VOICE_MAX_BYTES, VOICE_MIME_TYPES } from '@obolo/shared';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { AppConfig, CONFIG } from '../config';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { mediaObjects, users } from '../db/schema';
import { probe, squareVideo, transcodePhoto, transcodeVideo, videoPoster } from './transcode';
import { writeFile } from 'node:fs/promises';

/** Spec §5: default per-user storage quota 1 GB across all planets. */
export const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024;

@Injectable()
export class MediaService {
  private readonly log = new Logger('Media');
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly db: Database,
  ) {}

  private get bunny() {
    const c = this.cfg;
    if (!c.BUNNY_STORAGE_ZONE || !c.BUNNY_STORAGE_KEY || !c.BUNNY_CDN_HOST) return null;
    return { zone: c.BUNNY_STORAGE_ZONE, accessKey: c.BUNNY_STORAGE_KEY, endpoint: c.BUNNY_STORAGE_ENDPOINT, cdnHost: c.BUNNY_CDN_HOST };
  }

  async uploadVoice(userId: string, mimeHeader: string | undefined, body: unknown, requestOrigin: string) {
    const mime = (mimeHeader ?? '').split(';')[0].trim().toLowerCase();
    if (!(VOICE_MIME_TYPES as readonly string[]).includes(mime)) {
      throw apiError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_AUDIO', `Unsupported audio type: ${mime || 'none'}`);
    }
    if (!Buffer.isBuffer(body) || body.length === 0) throw apiError(HttpStatus.BAD_REQUEST, 'EMPTY_UPLOAD', 'No audio received');
    if (body.length > VOICE_MAX_BYTES) throw apiError(HttpStatus.PAYLOAD_TOO_LARGE, 'TOO_LARGE', 'Audio file too large');
    return this.store(userId, 'voice', mime, body, requestOrigin);
  }

  /** A photo (Jupiter roots etc.): re-encoded to WebP ≤ 1600 px before it is stored. */
  async uploadPhoto(userId: string, mimeHeader: string | undefined, file: string, requestOrigin: string) {
    const mime = (mimeHeader ?? '').split(';')[0].trim().toLowerCase();
    if (!mime.startsWith('image/')) throw apiError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_IMAGE', `Unsupported image type: ${mime || 'none'}`);
    let out: Awaited<ReturnType<typeof transcodePhoto>>;
    try {
      out = await transcodePhoto(await readFile(file));
    } catch {
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_IMAGE', 'Could not read this image');
    }
    const m = await this.store(userId, 'photo', 'image/webp', out.data, requestOrigin);
    return { ...m, width: out.width, height: out.height };
  }

  /**
   * A video (Jupiter 8 s posts, Mars …): re-encoded to 720p / ~1.5 Mbps MP4 and trimmed to
   * `maxSeconds`, plus a small WebP poster for lists.
   */
  async uploadVideo(userId: string, mimeHeader: string | undefined, file: string, maxSeconds: number, requestOrigin: string) {
    const mime = (mimeHeader ?? '').split(';')[0].trim().toLowerCase();
    if (!mime.startsWith('video/')) throw apiError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_VIDEO', `Unsupported video type: ${mime || 'none'}`);
    const limit = Math.max(1, Math.min(MEDIA_POLICY.video.maxSeconds, Math.floor(maxSeconds) || MEDIA_POLICY.video.maxSeconds));
    const dir = await mkdtemp(join(tmpdir(), 'obolo-v-'));
    try {
      const info = await probe(file).catch(() => null);
      if (!info?.hasVideo) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_VIDEO', 'Could not read this video');
      const outFile = join(dir, 'out.mp4');
      try {
        await transcodeVideo(file, outFile, limit);
      } catch (e) {
        this.log.warn(`transcode failed: ${e instanceof Error ? e.message : String(e)}`);
        throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_VIDEO', 'Could not convert this video');
      }
      const out = await probe(outFile);
      const poster = await videoPoster(outFile, join(dir, 'poster.png'));
      const p = await this.store(userId, 'poster', 'image/webp', poster, requestOrigin);
      const v = await this.store(userId, 'video', 'video/mp4', await readFile(outFile), requestOrigin);
      return { ...v, posterUrl: p.url, seconds: Math.round(out.seconds * 10) / 10, width: out.width, height: out.height };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /** Generated audio (Mercury instrumentals, later vocals / mixes). */
  storeAudio(userId: string, mime: string, data: Buffer, requestOrigin: string) {
    return this.store(userId, 'audio', mime, data, requestOrigin);
  }

  /** Generated images (NEO look, Bati). */
  storeImage(userId: string, kind: MediaKind, mime: string, data: Buffer, requestOrigin: string) {
    return this.store(userId, kind, mime, data, requestOrigin);
  }

  private async store(userId: string, kind: MediaKind, mime: string, data: Buffer, requestOrigin: string) {
    const [u] = await this.db.write.select({ used: users.storageUsageBytes }).from(users).where(eq(users.id, userId));
    if ((u?.used ?? 0) + data.length > STORAGE_QUOTA_BYTES) {
      // Spec §5: reject with a storage add-on offer (add-on purchase = phase 1 billing, P-BILL-1).
      throw apiError(HttpStatus.PAYLOAD_TOO_LARGE, 'STORAGE_QUOTA', 'Storage quota exceeded');
    }
    const id = crypto.randomUUID();
    const key = mediaKey(kind, userId, mime, id);
    const bunny = this.bunny;
    let url: string;
    let storage: 'bunny' | 'db';
    if (bunny) {
      url = await putObject(bunny, key, data, mime);
      storage = 'bunny';
    } else {
      // Dev / preview fallback only (P-MEDIA-1). Production must always use Bunny.
      url = `${(this.cfg.PUBLIC_API_URL ?? requestOrigin).replace(/\/$/, '')}/media/${id}`;
      storage = 'db';
    }
    await this.db.write.transaction(async (tx) => {
      await tx.insert(mediaObjects).values({
        id,
        userId,
        kind,
        mime,
        sizeBytes: data.length,
        storage,
        key,
        url,
        data: storage === 'db' ? data : null,
      });
      await tx
        .update(users)
        .set({ storageUsageBytes: sql`${users.storageUsageBytes} + ${data.length}` })
        .where(eq(users.id, userId));
    });
    return { id, url, mime, sizeBytes: data.length };
  }

  /** Keep a file the server made for the user (an MV, its poster…). */
  storeGenerated(userId: string, kind: MediaKind, mime: string, data: Buffer, requestOrigin: string) {
    return this.store(userId, kind, mime, data, requestOrigin);
  }

  /** The bytes of one of the user's own files, found by its URL (MV materials, a song to put under it). */
  async bytesByUrl(userId: string, url: string): Promise<Buffer | null> {
    const [m] = await this.db.write
      .select({ data: mediaObjects.data, url: mediaObjects.url })
      .from(mediaObjects)
      .where(and(eq(mediaObjects.url, url), eq(mediaObjects.userId, userId), isNull(mediaObjects.deletedAt)));
    if (!m) return null;
    if (m.data) return m.data;
    const res = await fetch(m.url, { signal: AbortSignal.timeout(120_000) });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }

  /** One of the user's files by id (any kind): its URL. */
  async ownedAny(userId: string, id: string) {
    const [m] = await this.db.write
      .select({ id: mediaObjects.id, url: mediaObjects.url, kind: mediaObjects.kind })
      .from(mediaObjects)
      .where(and(eq(mediaObjects.id, id), eq(mediaObjects.userId, userId), isNull(mediaObjects.deletedAt)));
    return m ?? null;
  }

  async getOwned(userId: string, id: string, kind: MediaKind) {
    const [m] = await this.db.write
      .select({ id: mediaObjects.id, url: mediaObjects.url })
      .from(mediaObjects)
      .where(and(eq(mediaObjects.id, id), eq(mediaObjects.userId, userId), eq(mediaObjects.kind, kind), isNull(mediaObjects.deletedAt)));
    return m ?? null;
  }

  async readDbBlob(id: string) {
    const [m] = await this.db.read
      .select({ mime: mediaObjects.mime, data: mediaObjects.data })
      .from(mediaObjects)
      .where(and(eq(mediaObjects.id, id), eq(mediaObjects.storage, 'db'), isNull(mediaObjects.deletedAt)));
    return m?.data ? m : null;
  }

  /** Delete one of the user's files by its URL (an old mix after an edit): Bunny object, row, quota. */
  async removeByUrl(userId: string, url: string): Promise<void> {
    const [m] = await this.db.write
      .update(mediaObjects)
      .set({ deletedAt: new Date(), data: null })
      .where(and(eq(mediaObjects.url, url), eq(mediaObjects.userId, userId), isNull(mediaObjects.deletedAt)))
      .returning({ key: mediaObjects.key, storage: mediaObjects.storage, size: mediaObjects.sizeBytes });
    if (!m) return;
    await this.db.write
      .update(users)
      .set({ storageUsageBytes: sql`GREATEST(${users.storageUsageBytes} - ${m.size}, 0)` })
      .where(eq(users.id, userId));
    const bunny = this.bunny;
    if (m.storage === 'bunny' && bunny) await deleteObject(bunny, m.key).catch(() => undefined);
  }

  /** The bytes of one of the user's own generated audio files, found by its URL (e.g. an instrumental to sing over). */
  async audioByUrl(userId: string, url: string): Promise<Buffer | null> {
    const [m] = await this.db.write
      .select({ data: mediaObjects.data, url: mediaObjects.url })
      .from(mediaObjects)
      .where(and(eq(mediaObjects.url, url), eq(mediaObjects.userId, userId), eq(mediaObjects.kind, 'audio'), isNull(mediaObjects.deletedAt)));
    if (!m) return null;
    if (m.data) return m.data;
    const res = await fetch(m.url, { signal: AbortSignal.timeout(60_000) });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }

  /**
   * A square copy of one of the user's videos (Mars posts are square): centre-cropped, with a
   * poster. The original stays as it is in the 裏スタジオ.
   */
  async squareCopy(userId: string, url: string, maxSeconds: number, requestOrigin: string) {
    const [m] = await this.db.write
      .select({ data: mediaObjects.data, url: mediaObjects.url })
      .from(mediaObjects)
      .where(and(eq(mediaObjects.url, url), eq(mediaObjects.userId, userId), eq(mediaObjects.kind, 'video'), isNull(mediaObjects.deletedAt)));
    if (!m) throw apiError(HttpStatus.NOT_FOUND, 'MEDIA_NOT_FOUND', 'Video not found');
    const bytes = m.data ?? (await fetch(m.url, { signal: AbortSignal.timeout(120_000) }).then(async (r) => (r.ok ? Buffer.from(await r.arrayBuffer()) : null)));
    if (!bytes) throw apiError(HttpStatus.BAD_GATEWAY, 'MEDIA_UNAVAILABLE', 'Could not read the video');
    const dir = await mkdtemp(join(tmpdir(), 'obolo-sq-'));
    try {
      await writeFile(join(dir, 'in'), bytes);
      const out = join(dir, 'square.mp4');
      try {
        await squareVideo(join(dir, 'in'), out, maxSeconds);
      } catch (e) {
        this.log.warn(`square crop failed: ${e instanceof Error ? e.message : String(e)}`);
        throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_VIDEO', 'Could not convert this video');
      }
      const info = await probe(out);
      const poster = await videoPoster(out, join(dir, 'poster.png'));
      const p = await this.store(userId, 'poster', 'image/webp', poster, requestOrigin);
      const v = await this.store(userId, 'video', 'video/mp4', await readFile(out), requestOrigin);
      return { url: v.url, posterUrl: p.url, seconds: Math.round(info.seconds * 10) / 10 };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /** The bytes of one of the user's generated images (to edit it). */
  async imageData(userId: string, id: string, kind: MediaKind): Promise<{ data: Buffer; mime: string } | null> {
    const [m] = await this.db.write
      .select({ mime: mediaObjects.mime, data: mediaObjects.data, url: mediaObjects.url, storage: mediaObjects.storage })
      .from(mediaObjects)
      .where(and(eq(mediaObjects.id, id), eq(mediaObjects.userId, userId), eq(mediaObjects.kind, kind), isNull(mediaObjects.deletedAt)));
    if (!m) return null;
    if (m.data) return { data: m.data, mime: m.mime };
    const res = await fetch(m.url);
    if (!res.ok) return null;
    return { data: Buffer.from(await res.arrayBuffer()), mime: m.mime };
  }
}
