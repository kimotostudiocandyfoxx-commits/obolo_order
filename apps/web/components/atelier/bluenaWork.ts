import type { Track } from '@/lib/bluena/music';
import { shelf, talks } from './shelf';
import type { Work } from './work';

/**
 * R16: a work opened from Bluena, as whole as this device knows it. Bluena's list holds the planets' records (a title,
 * the file); the card in the talk it was made in holds the rest (a song's lyrics with their section labels, its free
 * changes, the spell it was cast with, a video's reel, a book). The newest card of the same work is taken over the list's.
 */
export function sameWork(a: Work, b: Work): boolean {
  if (a.id === b.id) return true;
  if (a.atelierId && a.atelierId === b.atelierId) return true;
  const r = a.ref ?? {};
  const s = b.ref ?? {};
  return !!((r.songId && r.songId === s.songId) || (r.rootId && r.rootId === s.rootId) || (r.backstageId && r.backstageId === s.backstageId) || (r.mvId && r.mvId === s.mvId) || (r.showId && r.showId === s.showId) || (r.postId && r.postId === s.postId) || (r.bookId && r.bookId === s.bookId) || (r.gameId && r.gameId === s.gameId) || (r.demoSong?.id && r.demoSong.id === s.demoSong?.id));
}

const defined = (w: Work): Partial<Work> => Object.fromEntries(Object.entries(w).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<Work>;

export function fullWork(w: Work): Work {
  if (typeof window === 'undefined') return w;
  for (const t of talks())
    for (let i = t.msgs.length - 1; i >= 0; i--) {
      const m = t.msgs[i];
      // (a card still 'making' is looked at on the server by the viewer: refresh.ts)
      if (m.who !== 'work' || !sameWork(m.work, w)) continue;
      if (m.work.status === 'ready') return { ...w, ...m.work, flown: w.flown || m.work.flown, saved: true };
      if (m.work.status === 'making') {
        // Bluena's own record has the thing made (its file): that, with the card's words; else the card, looked at again
        const media = w.audio || w.video || w.image || w.ref?.bookId || w.ref?.gameId;
        return media ? { ...m.work, ...defined(w), status: 'ready', job: undefined, saved: true } : { ...m.work, origin: m.work.origin ?? { thread: 'bati', talkId: t.id, at: t.at } };
      }
    }
  const kept = shelf().find((x) => sameWork(x, w));
  return kept ? { ...w, ...kept } : w;
}

/** what can be listened to */
export const hearable = (w: Work) => !!(w.ref?.demoSong || (w.audio && w.audio !== 'synth:'));

/** a work as Bluena's music (its file, or the demo's sketch) */
export function trackOf(w: Work, key: string, audio?: string): Track | null {
  const url = audio ?? (w.audio && w.audio !== 'synth:' ? w.audio : undefined);
  const demo = w.ref?.demoSong;
  if (!url && !demo) return null;
  return { id: key, title: w.title || w.prompt || '', url, demo: url ? undefined : demo?.preset, image: w.image ?? w.poster ?? null, seconds: w.tweak?.seconds ?? demo?.seconds };
}

/** the song's versions: its tries (M-R253) and its free changes (R13), the one playing last */
export type SongVersion = { label: string; audio?: string; lyrics?: Work['lyrics']; what?: string; face?: number };
export function songVersions(w: Work): SongVersion[] {
  const out: SongVersion[] = [];
  const tries = w.versions ?? [];
  if (tries.length > 1) tries.forEach((v, i) => i !== (w.active ?? tries.length - 1) && out.push({ label: `試し${i + 1}`, audio: v.audio, face: i }));
  for (const p of w.tweak?.past ?? []) out.push({ label: '', audio: p.url, lyrics: p.lyrics, what: p.what });
  out.push({ label: '', audio: w.audio, lyrics: w.lyrics, what: w.tweak?.what });
  let n = 0;
  return out.map((v) => (v.label ? v : { ...v, label: `${++n}` }));
}
