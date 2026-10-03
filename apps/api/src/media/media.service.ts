import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { mediaKey, MediaKind, putObject } from '@obolo/media';
import { VOICE_MAX_BYTES, VOICE_MIME_TYPES } from '@obolo/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { AppConfig, CONFIG } from '../config';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { mediaObjects, users } from '../db/schema';

/** Spec §5: default per-user storage quota 1 GB across all planets. */
export const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024;

@Injectable()
export class MediaService {
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
}
