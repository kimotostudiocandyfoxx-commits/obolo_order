import { CLIP_DOC_TYPES, CLIP_KINDS, type ClipFile, type ClipKind } from '@obolo/shared';

/** what a 📎 file row keeps in media_objects.meta */
export type ClipMeta = { sub: ClipKind | 'poster'; name: string; width?: number | null; height?: number | null; seconds?: number | null; posterId?: string | null; parent?: string | null };

export const metaOf = (j: unknown): ClipMeta | null => (j && typeof j === 'object' && typeof (j as { sub?: unknown }).sub === 'string' ? (j as ClipMeta) : null);

/** a 📎 file row as Bluena and the talks show it (null: not one, or a film's poster) */
export function clipView(r: { id: string; mime: string; sizeBytes: number; meta?: unknown; createdAt: Date }): ClipFile | null {
  const m = metaOf(r.meta);
  if (!m || !(CLIP_KINDS as readonly string[]).includes(m.sub)) return null;
  return {
    id: r.id,
    kind: m.sub as ClipKind,
    name: m.name,
    mime: r.mime,
    sizeBytes: r.sizeBytes,
    width: m.width ?? null,
    height: m.height ?? null,
    seconds: m.seconds ?? null,
    posterId: m.posterId ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Does the start of a file match what it said it was? (A renamed program is never kept as a "PDF".) `type` is the
 * declared type (clipType); pictures, films and sounds are checked by decoding them, documents here.
 */
export function docLooksRight(type: string, head: Buffer): boolean {
  if (!CLIP_DOC_TYPES[type]) return false;
  const starts = (sig: number[]) => sig.every((b, i) => head[i] === b);
  if (type === 'application/pdf') return head.subarray(0, 5).toString('latin1') === '%PDF-';
  if (type === 'application/zip' || type.includes('openxmlformats')) return starts([0x50, 0x4b, 0x03, 0x04]);
  if (type === 'application/msword' || type === 'application/vnd.ms-excel' || type === 'application/vnd.ms-powerpoint') return starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  // text: no NUL byte in what was read, and it reads as UTF-8
  if (head.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head.subarray(0, Math.max(0, head.length - 4)));
    return true;
  } catch {
    return false;
  }
}

/** the file's start says it is a HEIC / HEIF picture (the ftyp box of an iPhone photo) */
export function isHeif(head: Buffer): boolean {
  if (head.subarray(4, 8).toString('latin1') !== 'ftyp') return false;
  const brand = head.subarray(8, 12).toString('latin1');
  return ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand);
}

/** a Content-Disposition with the original name (RFC 5987), an attachment for documents */
export function disposition(kind: ClipKind, name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${kind === 'file' ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
