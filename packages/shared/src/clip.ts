import { z } from 'zod';

/**
 * Bluena's 📎 (client 2026-11-24): pictures, films, sounds and files from the member's own phone / iPad, kept in their
 * Bluena and sent to a ダチ talk or handed to {bati}. They are private: only the one who put it there, and the ダチ of
 * a talk it was sent into, can open it (GET /media/files/:id checks; no public link is handed out).
 *
 * Upload is in pieces (POST …/parts/:n, CLIP_CHUNK_BYTES each) so a big film never meets Cloud Run's 32 MiB request
 * limit, then POST …/done re-encodes it like every other upload (docs/media.md): a picture → WebP ≤ 1600 px with its
 * metadata (GPS) dropped (an iPhone HEIC is converted), a film → 720p MP4 (the first MEDIA_POLICY.video.maxSeconds),
 * a sound → AAC, a document → kept as it is.
 */
export const CLIP_KINDS = ['photo', 'video', 'audio', 'file'] as const;
export type ClipKind = (typeof CLIP_KINDS)[number];

const MB = 1024 * 1024;
/** the largest original accepted, per kind (before it is made lighter) */
export const CLIP_MAX_BYTES: Record<ClipKind, number> = { photo: 25 * MB, video: 100 * MB, audio: 30 * MB, file: 20 * MB };
/** one piece of an upload (well under Cloud Run's 32 MiB request limit) */
export const CLIP_CHUNK_BYTES = 8 * MB;
/** a sound is kept up to this long (seconds) */
export const CLIP_AUDIO_MAX_SECONDS = 30 * 60;
/** at most this many at once in the 📎 sheet */
export const CLIP_PICK_MAX = 6;

/** what each kind is called on screen */
export const CLIP_WORD: Record<ClipKind, string> = { photo: '写真', video: '動画', audio: '音声', file: 'ファイル' };

/** documents that may be sent (anything else is refused) */
export const CLIP_DOC_TYPES: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'text/plain': ['txt'],
  'text/csv': ['csv'],
  'application/zip': ['zip'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
};

const EXT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm', '3gp': 'video/3gpp',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', aif: 'audio/aiff', aiff: 'audio/aiff', caf: 'audio/x-caf',
  ...Object.fromEntries(Object.entries(CLIP_DOC_TYPES).flatMap(([t, exts]) => exts.map((e) => [e, t]))),
};
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence', 'image/avif'];

/** the type a file says it is: its own (lower case, no parameters), else from its name (iOS gives some files none) */
export function clipType(mime: string | null | undefined, name = ''): string {
  const m = (mime ?? '').split(';')[0].trim().toLowerCase();
  if (m && m !== 'application/octet-stream') return m;
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return EXT_TYPE[ext] ?? m;
}

/** which kind a file is (null = not something Bluena keeps) */
export function clipKindOf(mime: string | null | undefined, name = ''): ClipKind | null {
  const t = clipType(mime, name);
  if (PHOTO_TYPES.includes(t)) return 'photo';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (CLIP_DOC_TYPES[t]) return 'file';
  return null;
}

/** why a file cannot be taken (null = it can): the words shown on its row */
export function clipRefusal(f: { type?: string | null; name: string; size: number }): string | null {
  const k = clipKindOf(f.type, f.name);
  if (!k) return 'このファイルは、送れないみたい';
  if (f.size <= 0) return 'からっぽのファイルみたい';
  if (f.size > CLIP_MAX_BYTES[k]) return `${CLIP_WORD[k]}は ${Math.round(CLIP_MAX_BYTES[k] / MB)}MB まで`;
  return null;
}

/** how many pieces an upload of `size` bytes is sent in */
export const clipParts = (size: number) => Math.max(1, Math.ceil(size / CLIP_CHUNK_BYTES));
/** the length piece `n` must have */
export function clipPartBytes(size: number, n: number): number {
  const parts = clipParts(size);
  if (n < 0 || n >= parts) return 0;
  return n < parts - 1 ? CLIP_CHUNK_BYTES : size - CLIP_CHUNK_BYTES * (parts - 1);
}

/** a size as it is said: 820KB, 3.4MB */
export function clipSize(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  const m = bytes / MB;
  return `${m < 10 ? m.toFixed(1) : Math.round(m)}MB`;
}

/** a file name kept short and safe to show (no path, no control characters) */
export function clipName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (clean || 'file').slice(0, 120);
}

export const ClipStartBody = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.string().trim().max(160).default(''),
  size: z.number().int().positive(),
});
export type ClipStartBody = z.infer<typeof ClipStartBody>;

/** one file in Bluena (or sent into a talk) */
export interface ClipFile {
  id: string;
  kind: ClipKind;
  /** the name it had on the device */
  name: string;
  /** what is stored (image/webp, video/mp4, audio/mp4, or the document's own type) */
  mime: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  seconds?: number | null;
  /** a film's first frame (another private file) */
  posterId?: string | null;
  createdAt: string;
}

/** the answer to POST /media/files: where the pieces go */
export interface ClipUploadStart {
  id: string;
  parts: number;
  chunkBytes: number;
}

/** what {bati} says on a file handed over: a picture is looked at (when the chat can see), else a line by kind */
export const CLIP_BATI_LINES: Record<ClipKind, string> = {
  photo: 'いい写真だね。だいじに、もっておくね',
  video: '動画、うけとったよ。あとで、いっしょに見よう',
  audio: '音、うけとったよ。どんな音かな。たのしみ',
  file: 'ファイル、うけとったよ。だいじに、しまっておくね',
};
