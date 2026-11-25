/**
 * Where a file is kept: Cloudflare R2 (new files once R2 is configured, client 2026-11-25) or Bunny Storage (the files
 * from before, until they are copied over and Bunny is cancelled). One interface for both, and the choice of where new
 * files go. `media_objects.storage` records which one holds each file ('r2' | 'bunny' | 'db' for the dev fallback).
 */
import { cdnUrl, deleteObject, getObject, putObject, type BunnyStorageConfig } from './bunny';
import { r2DeleteObject, r2GetObject, r2HeadObject, r2PutObject, r2Url, type R2Config } from './r2';

export type BackendName = 'bunny' | 'r2';

export interface MediaBackend {
  readonly name: BackendName;
  /** the public URL of a key */
  url(key: string): string;
  /** upload; returns the public URL */
  put(key: string, body: Uint8Array, contentType: string): Promise<string>;
  /** read with the storage keys (not through the public CDN); `range` passes a byte range through */
  get(key: string, range?: string): Promise<Response>;
  /** remove (a missing object is not an error) */
  delete(key: string): Promise<void>;
  /** size of an object, null when it is not there (R2 only) */
  head?(key: string): Promise<{ size: number; contentType: string | null } | null>;
}

export function bunnyBackend(cfg: BunnyStorageConfig): MediaBackend {
  return {
    name: 'bunny',
    url: (key) => cdnUrl(cfg, key),
    put: (key, body, type) => putObject(cfg, key, body, type),
    get: (key, range) => getObject(cfg, key, range),
    delete: (key) => deleteObject(cfg, key),
  };
}

export function r2Backend(cfg: R2Config): MediaBackend {
  return {
    name: 'r2',
    url: (key) => r2Url(cfg, key),
    put: (key, body, type) => r2PutObject(cfg, key, body, type),
    get: (key, range) => r2GetObject(cfg, key, range),
    delete: (key) => r2DeleteObject(cfg, key),
    head: (key) => r2HeadObject(cfg, key),
  };
}

export interface MediaBackends {
  r2: MediaBackend | null;
  bunny: MediaBackend | null;
}

/** where new files go: R2 when it is configured, else Bunny, else nothing (the API keeps them in Postgres, dev only) */
export function writeBackend(b: MediaBackends): MediaBackend | null {
  return b.r2 ?? b.bunny;
}

/** the backend that holds a stored row (`media_objects.storage`), or null ('db', or that backend is not configured) */
export function backendOf(b: MediaBackends, storage: string): MediaBackend | null {
  return storage === 'r2' ? b.r2 : storage === 'bunny' ? b.bunny : null;
}

/** R2 settings from env-style values; null unless every one is present (then the API stays on Bunny) */
export function r2ConfigFrom(v: { accountId?: string; bucket?: string; accessKeyId?: string; secretAccessKey?: string; publicBase?: string; endpoint?: string }): R2Config | null {
  if (!v.accountId || !v.bucket || !v.accessKeyId || !v.secretAccessKey || !v.publicBase) return null;
  if (!/^https?:\/\//.test(v.publicBase)) return null;
  return { accountId: v.accountId, bucket: v.bucket, accessKeyId: v.accessKeyId, secretAccessKey: v.secretAccessKey, publicBase: v.publicBase.replace(/\/+$/, ''), endpoint: v.endpoint };
}

export function bunnyConfigFrom(v: { zone?: string; accessKey?: string; endpoint?: string; cdnHost?: string }): BunnyStorageConfig | null {
  if (!v.zone || !v.accessKey || !v.cdnHost) return null;
  return { zone: v.zone, accessKey: v.accessKey, endpoint: v.endpoint || 'sg.storage.bunnycdn.com', cdnHost: v.cdnHost };
}

/** the public URL prefixes of the two backends (`https://<cdnHost>/` and `<R2_PUBLIC_BASE>/`), for rewriting old URLs */
export function urlPrefixes(bunny: Pick<BunnyStorageConfig, 'cdnHost'>, r2: Pick<R2Config, 'publicBase'>) {
  return { from: `https://${bunny.cdnHost}/`, to: `${r2.publicBase.replace(/\/+$/, '')}/` };
}

/** an old Bunny URL rewritten to the R2 one for the same key (any other text unchanged) */
export function rewriteUrl(text: string, p: { from: string; to: string }): string {
  return text.split(p.from).join(p.to);
}
