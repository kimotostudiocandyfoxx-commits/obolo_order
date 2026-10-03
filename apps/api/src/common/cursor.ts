/** Opaque keyset cursor over (created_at DESC, id DESC) — stable at any table size. */
export interface Cursor {
  t: string;
  id: string;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

export function decodeCursor(s: string | undefined): Cursor | null {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, 'base64url').toString()) as Cursor;
    if (typeof c.t === 'string' && typeof c.id === 'string' && !Number.isNaN(Date.parse(c.t))) return c;
  } catch {
    /* fallthrough */
  }
  return null;
}
