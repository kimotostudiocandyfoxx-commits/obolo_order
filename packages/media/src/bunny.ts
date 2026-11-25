/** Bunny Storage + CDN (the files from before R2; spec §7.1). Credentials via env vars (P-MEDIA-1). */
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

/**
 * Read an object straight from Bunny Storage (with the zone's AccessKey, not through the public CDN): Bluena's private
 * files are served by the API this way, after it checked who is asking. `range` passes a byte range through.
 */
export async function getObject(cfg: BunnyStorageConfig, key: string, range?: string): Promise<Response> {
  return fetch(`https://${cfg.endpoint}/${cfg.zone}/${key}`, { headers: { AccessKey: cfg.accessKey, ...(range ? { range } : {}) } });
}

export async function deleteObject(cfg: BunnyStorageConfig, key: string): Promise<void> {
  const res = await fetch(`https://${cfg.endpoint}/${cfg.zone}/${key}`, {
    method: 'DELETE',
    headers: { AccessKey: cfg.accessKey },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Bunny Storage delete failed: ${res.status}`);
}
