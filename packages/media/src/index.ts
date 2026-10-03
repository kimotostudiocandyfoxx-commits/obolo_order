/**
 * @obolo/media — Bunny helpers (spec §7.1). ALL user media lives on Bunny (Storage + CDN / Stream).
 * Credentials are PLACEHOLDERS (P-MEDIA-1) supplied via env vars.
 */
import { createHash, randomUUID } from 'node:crypto';

export interface BunnyStorageConfig {
  /** Storage zone name, e.g. "obolo-media" */
  zone: string;
  /** Storage zone password (AccessKey) */
  accessKey: string;
  /** Regional endpoint, e.g. "storage.bunnycdn.com" (Falkenstein) or "sg.storage.bunnycdn.com" */
  endpoint: string;
  /** Pull zone hostname that fronts the storage zone, e.g. "obolo.b-cdn.net" */
  cdnHost: string;
}

export type MediaKind = 'voice' | 'image' | 'audio' | 'video-thumb';

const EXT_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function extForMime(mime: string): string {
  return EXT_BY_MIME[mime.split(';')[0].trim()] ?? 'bin';
}

/**
 * Object key layout. A 2-char hash prefix spreads objects across directories so listing /
 * purge operations stay fast at hundreds of millions of objects.
 *   voice/ab/<userId>/<uuid>.m4a
 */
export function mediaKey(kind: MediaKind, userId: string, mime: string, id: string = randomUUID()): string {
  const shard = createHash('sha1').update(userId).digest('hex').slice(0, 2);
  return `${kind}/${shard}/${userId}/${id}.${extForMime(mime)}`;
}

export function cdnUrl(cfg: Pick<BunnyStorageConfig, 'cdnHost'>, key: string): string {
  return `https://${cfg.cdnHost}/${key}`;
}

/** Server-side upload to Bunny Storage (Bunny Storage has no presigned URLs, so the API proxies small files). */
export async function putObject(cfg: BunnyStorageConfig, key: string, body: Uint8Array, contentType: string): Promise<string> {
  const res = await fetch(`https://${cfg.endpoint}/${cfg.zone}/${key}`, {
    method: 'PUT',
    headers: { AccessKey: cfg.accessKey, 'content-type': contentType },
    body,
  });
  if (!res.ok) throw new Error(`Bunny Storage upload failed: ${res.status} ${await res.text().catch(() => '')}`);
  return cdnUrl(cfg, key);
}

export async function deleteObject(cfg: BunnyStorageConfig, key: string): Promise<void> {
  const res = await fetch(`https://${cfg.endpoint}/${cfg.zone}/${key}`, {
    method: 'DELETE',
    headers: { AccessKey: cfg.accessKey },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Bunny Storage delete failed: ${res.status}`);
}

/**
 * Bunny Stream TUS direct-upload signature (Venus reels / Mars video, phase 2).
 * signature = sha256(library_id + api_key + expiration_time + video_id)
 */
export function streamUploadSignature(libraryId: string, apiKey: string, expiresUnix: number, videoId: string): string {
  return createHash('sha256').update(`${libraryId}${apiKey}${expiresUnix}${videoId}`).digest('hex');
}
