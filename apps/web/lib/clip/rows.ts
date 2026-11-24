import { CLIP_DOC_TYPES, CLIP_PICK_MAX, CLIP_WORD, clipKindOf, clipName, clipRefusal, type ClipFile, type ClipKind } from '@obolo/shared';

/**
 * Bluena's 📎 on the web (pure parts: no React, no API — tested in rows.test.ts). The picker asks for pictures, films,
 * sounds and the documents Bluena keeps. HEIC is not named, so iOS hands a photo from the library over as a JPEG.
 */
export const CLIP_ACCEPT = [
  'image/*',
  'video/*',
  'audio/*',
  ...Object.keys(CLIP_DOC_TYPES),
  ...Object.values(CLIP_DOC_TYPES)
    .flat()
    .map((e) => `.${e}`),
].join(',');

/** where the picked files go: a ダチ talk, {bati}, or just into Bluena (the hall, the plain) */
export type ClipMode = 'dachi' | 'bati' | 'keep';

/** one row of the 📎 sheet */
export type ClipRow = {
  key: string;
  name: string;
  kind: ClipKind | null;
  size: number;
  type: string;
  state: 'wait' | 'up' | 'ready' | 'bad';
  /** bytes sent so far */
  sent: number;
  /** why it cannot go (state 'bad') */
  note?: string;
  /** the kept file (state 'ready') */
  file?: ClipFile;
};

let n = 0;
/** the picked files as rows: refused ones say why; at most CLIP_PICK_MAX in the sheet (the rest are left out) */
export function rowsOf(files: { name: string; size: number; type: string }[], already = 0): ClipRow[] {
  return files.slice(0, Math.max(0, CLIP_PICK_MAX - already)).map((f) => {
    const note = clipRefusal(f);
    return {
      key: `c${Date.now().toString(36)}${n++}`,
      name: clipName(f.name),
      kind: clipKindOf(f.type, f.name),
      size: f.size,
      type: f.type,
      state: note ? 'bad' : 'wait',
      sent: 0,
      note: note ?? undefined,
    };
  });
}

/** the share of the sheet's bytes that has gone (0–1), the refused rows left out */
export function progressOf(rows: ClipRow[]): number {
  const live = rows.filter((r) => r.state !== 'bad');
  const total = live.reduce((a, r) => a + r.size, 0);
  if (!total) return 0;
  return Math.min(1, live.reduce((a, r) => a + (r.state === 'ready' ? r.size : Math.min(r.sent, r.size)), 0) / total);
}

/** a row's own share (0–1) */
export const rowProgress = (r: ClipRow) => (r.state === 'ready' ? 1 : r.size ? Math.min(0.98, r.sent / r.size) : 0);

/** the sheet's title and its button, by where the files go */
export function sheetWords(mode: ClipMode, bati: string): { title: string; go: string; busy: string } {
  if (mode === 'dachi') return { title: 'この会話に送る', go: '送る', busy: '送っています…' };
  if (mode === 'bati') return { title: `${bati}にわたす`, go: 'わたす', busy: 'わたしています…' };
  return { title: 'ブルーナにしまう', go: 'しまう', busy: 'しまっています…' };
}

/** the small words under a row's name */
export function rowSub(r: ClipRow): string {
  if (r.state === 'bad') return r.note ?? '';
  const k = r.kind ? CLIP_WORD[r.kind] : 'ファイル';
  if (r.state === 'up' || r.state === 'wait') return `${k}・${Math.round(rowProgress(r) * 100)}%`;
  return `${k}・${sizeWord(r.file?.sizeBytes ?? r.size)}`;
}

/** a size as it is said (shared clipSize, repeated here for the rows without a file yet) */
export function sizeWord(bytes: number): string {
  const MB = 1024 * 1024;
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  const m = bytes / MB;
  return `${m < 10 ? m.toFixed(1) : Math.round(m)}MB`;
}

/** the files ready to go, in the order picked */
export const readyFiles = (rows: ClipRow[]) => rows.filter((r) => r.state === 'ready' && r.file).map((r) => r.file!);

/** a file's name extension, for the document mark (PDF, DOCX …) */
export const extOf = (name: string) => (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] ?? '').toUpperCase();

/** a length in seconds as 0:42 / 12:05 */
export function lengthWord(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return '';
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** when a file was put into Bluena: today → きょう 06:49, else 11/24 06:49 */
export function keptWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toDateString() === now.toDateString() ? `きょう ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}
