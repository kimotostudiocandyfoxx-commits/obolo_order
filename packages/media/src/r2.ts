/**
 * Cloudflare R2 (client decision 2026-11-25): S3-compatible storage, public reads through the bucket's custom domain
 * (R2_PUBLIC_BASE, e.g. https://media.obolo.life — egress is free). A small AWS Signature V4 signer on node:crypto
 * keeps this package free of an SDK: put, get (with Range), head, delete and server-side copy are all we use.
 */
import { createHash, createHmac } from 'node:crypto';

export interface R2Config {
  /** Cloudflare account id; the S3 endpoint is https://<accountId>.r2.cloudflarestorage.com */
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** public base of the bucket's custom domain, e.g. "https://media.obolo.life" (no trailing slash needed) */
  publicBase: string;
  /** override of the S3 endpoint (tests, a local S3); default from accountId */
  endpoint?: string;
  /** injected in tests */
  fetch?: typeof fetch;
}

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const sha256Hex = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string) => createHmac('sha256', key).update(data).digest();

/** RFC 3986 encoding of one path segment, as S3 canonical requests want it */
export function encodeSegment(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
export const encodeKey = (key: string) => key.split('/').map(encodeSegment).join('/');

export interface SignInput {
  method: string;
  /** already-encoded URL (path segments encoded once; the canonical URI is its pathname as is) */
  url: string;
  headers?: Record<string, string>;
  /** hex SHA-256 of the body (default: of an empty body) */
  payloadHash?: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service?: string;
  now?: Date;
}

/** AWS Signature V4 (header form). Returns the headers to send, `authorization` included. */
export function signV4(i: SignInput): Record<string, string> {
  const u = new URL(i.url);
  const amzDate = (i.now ?? new Date()).toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const service = i.service ?? 's3';
  const payloadHash = i.payloadHash ?? EMPTY_SHA256;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(i.headers ?? {})) headers[k.toLowerCase()] = String(v).trim().replace(/\s+/g, ' ');
  headers.host = u.host;
  headers['x-amz-content-sha256'] = payloadHash;
  headers['x-amz-date'] = amzDate;
  const names = Object.keys(headers).sort();
  const query = [...u.searchParams.entries()]
    .map(([k, v]) => [encodeSegment(k), encodeSegment(v)])
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const canonical = [i.method.toUpperCase(), u.pathname || '/', query, names.map((n) => `${n}:${headers[n]}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${day}/${i.region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonical)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${i.secretAccessKey}`, day), i.region), service), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(toSign).digest('hex');
  const out: Record<string, string> = { ...headers };
  delete out.host; // fetch sets it
  out.authorization = `AWS4-HMAC-SHA256 Credential=${i.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  return out;
}

export const r2Endpoint = (cfg: Pick<R2Config, 'accountId' | 'endpoint'>) => (cfg.endpoint ?? `https://${cfg.accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, '');

/** the public URL of a key: R2_PUBLIC_BASE + "/" + key */
export function r2Url(cfg: Pick<R2Config, 'publicBase'>, key: string): string {
  return `${cfg.publicBase.replace(/\/+$/, '')}/${encodeKey(key)}`;
}

/**
 * Cache-Control by key. Object keys carry a fresh UUID and are never rewritten, so a stored file is immutable:
 * a year in browsers and at the edge. Bluena's private files (kind "file/…") are not kept by shared caches; the
 * upload pieces under tmp/ are not cached at all.
 */
export function cacheControlFor(key: string): string {
  if (key.startsWith('tmp/')) return 'no-store';
  if (key.startsWith('file/')) return 'private, max-age=31536000, immutable';
  return 'public, max-age=31536000, immutable';
}

async function r2Fetch(cfg: R2Config, method: string, key: string, o: { body?: Uint8Array; headers?: Record<string, string> } = {}): Promise<Response> {
  const url = `${r2Endpoint(cfg)}/${encodeSegment(cfg.bucket)}/${encodeKey(key)}`;
  const headers = signV4({
    method,
    url,
    headers: o.headers,
    payloadHash: o.body ? sha256Hex(o.body) : EMPTY_SHA256,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    region: 'auto',
  });
  return (cfg.fetch ?? fetch)(url, { method, headers, body: o.body });
}

/** upload one object; returns its public URL */
export async function r2PutObject(cfg: R2Config, key: string, body: Uint8Array, contentType: string, cacheControl = cacheControlFor(key)): Promise<string> {
  const res = await r2Fetch(cfg, 'PUT', key, { body, headers: { 'content-type': contentType, 'cache-control': cacheControl } });
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
  return r2Url(cfg, key);
}

/** read an object with the keys (Bluena's private files, upload pieces); `range` passes a byte range through */
export function r2GetObject(cfg: R2Config, key: string, range?: string): Promise<Response> {
  return r2Fetch(cfg, 'GET', key, { headers: range ? { range } : undefined });
}

/** size and type of an object, or null when it is not there */
export async function r2HeadObject(cfg: R2Config, key: string): Promise<{ size: number; contentType: string | null } | null> {
  const res = await r2Fetch(cfg, 'HEAD', key);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 head failed: ${res.status}`);
  return { size: Number(res.headers.get('content-length') ?? NaN), contentType: res.headers.get('content-type') };
}

export async function r2DeleteObject(cfg: R2Config, key: string): Promise<void> {
  const res = await r2Fetch(cfg, 'DELETE', key);
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed: ${res.status}`);
}

/** server-side copy inside the bucket (type and Cache-Control kept from the source) */
export async function r2CopyObject(cfg: R2Config, fromKey: string, toKey: string): Promise<string> {
  const res = await r2Fetch(cfg, 'PUT', toKey, { headers: { 'x-amz-copy-source': `/${encodeSegment(cfg.bucket)}/${encodeKey(fromKey)}`, 'x-amz-metadata-directive': 'COPY' } });
  const text = await res.text().catch(() => '');
  // S3 may answer 200 with an <Error> body for a copy
  if (!res.ok || /<Error>/.test(text)) throw new Error(`R2 copy failed: ${res.status} ${text.slice(0, 300)}`);
  return r2Url(cfg, toKey);
}
