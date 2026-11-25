import { bunnyBackend, bunnyConfigFrom, r2Backend, r2ConfigFrom, type MediaBackends } from '@obolo/media';
import type { AppConfig } from '../config';

type C = Pick<
  AppConfig,
  'BUNNY_STORAGE_ZONE' | 'BUNNY_STORAGE_KEY' | 'BUNNY_STORAGE_ENDPOINT' | 'BUNNY_CDN_HOST' | 'R2_ACCOUNT_ID' | 'R2_BUCKET' | 'R2_ACCESS_KEY_ID' | 'R2_SECRET_ACCESS_KEY' | 'R2_PUBLIC_BASE' | 'R2_ENDPOINT'
>;

const cache = new WeakMap<object, MediaBackends>();

/**
 * The storage backends this API can use (docs/media.md): R2 when all of R2_* are set (new files go there), Bunny when
 * BUNNY_* are set (the files from before, until they are copied and Bunny is cancelled). Neither: Postgres (dev only).
 */
export function mediaBackends(c: C): MediaBackends {
  const hit = cache.get(c);
  if (hit) return hit;
  const r2 = r2ConfigFrom({ accountId: c.R2_ACCOUNT_ID, bucket: c.R2_BUCKET, accessKeyId: c.R2_ACCESS_KEY_ID, secretAccessKey: c.R2_SECRET_ACCESS_KEY, publicBase: c.R2_PUBLIC_BASE, endpoint: c.R2_ENDPOINT });
  const bunny = bunnyConfigFrom({ zone: c.BUNNY_STORAGE_ZONE, accessKey: c.BUNNY_STORAGE_KEY, endpoint: c.BUNNY_STORAGE_ENDPOINT, cdnHost: c.BUNNY_CDN_HOST });
  const b: MediaBackends = { r2: r2 ? r2Backend(r2) : null, bunny: bunny ? bunnyBackend(bunny) : null };
  cache.set(c, b);
  return b;
}
