/**
 * @obolo/media — where user media is kept (spec §7.1; docs/media.md). New files go to Cloudflare R2 once it is
 * configured (client decision 2026-11-25, `r2.ts`); the files from before stay on Bunny (`bunny.ts`) until they are
 * copied over. `backend.ts` is one interface for both. Credentials come from env vars.
 */
import { createHash, randomUUID } from 'node:crypto';

export * from './bunny';
export * from './r2';
export * from './backend';

export type MediaKind = 'voice' | 'image' | 'audio' | 'video-thumb' | 'avatar' | 'bati' | 'photo' | 'video' | 'poster' | 'show' | 'file';

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
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
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

/**
 * Bunny Stream TUS direct-upload signature (Venus reels / Mars video, phase 2).
 * signature = sha256(library_id + api_key + expiration_time + video_id)
 */
export function streamUploadSignature(libraryId: string, apiKey: string, expiresUnix: number, videoId: string): string {
  return createHash('sha256').update(`${libraryId}${apiKey}${expiresUnix}${videoId}`).digest('hex');
}
