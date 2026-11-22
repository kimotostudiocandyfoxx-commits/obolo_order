import type { AtelierKind } from '@/lib/atelier/unlock';
import type { Msg, Work } from './work';

/**
 * Bluena's folders that live on this device (M-R211): your looks, {bati}'s dress-ups, lookups and pictures — and, in
 * the review demo, songs (the demo has no song server). Kept as the card itself, so a folder item can be opened
 * again. The past talks (left drawer) are kept apart from the works.
 */
const SHELF_KEY = 'obolo.atelier.shelf.v1';
const TALKS_KEY = 'obolo.atelier.talks.v1';

function read<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private window / full: the item stays in the talk only */
  }
}

export const LOCAL_KINDS: AtelierKind[] = ['look', 'bati', 'lookup', 'image'];

export function shelf(): Work[] {
  return read<Work[]>(SHELF_KEY, []);
}
export function putShelf(w: Work) {
  write(SHELF_KEY, [w, ...shelf().filter((x) => x.id !== w.id)].slice(0, 200));
}
export function dropShelf(id: string) {
  write(SHELF_KEY, shelf().filter((x) => x.id !== id));
}

export type Talk = { id: string; at: string; msgs: Msg[] };
export function talks(): Talk[] {
  return read<Talk[]>(TALKS_KEY, []);
}
export function saveTalk(t: Talk) {
  if (!t.msgs.some((m) => m.who === 'me')) return;
  write(TALKS_KEY, [t, ...talks().filter((x) => x.id !== t.id)].slice(0, 40));
}

/** M-R253 §4: a card finished while its talk was not open (the job host) is written into the saved talk */
export function patchTalkWork(talkId: string | undefined, w: Work) {
  const all = talks();
  const t = all.find((x) => x.id === talkId) ?? all.find((x) => x.msgs.some((m) => m.who === 'work' && m.work.id === w.id));
  if (!t) return;
  const msgs = t.msgs.some((m) => m.who === 'work' && m.work.id === w.id) ? t.msgs.map((m) => (m.who === 'work' && m.work.id === w.id ? { ...m, work: w } : m)) : [...t.msgs, { id: `m-${w.id}`, who: 'work' as const, work: w }];
  write(TALKS_KEY, all.map((x) => (x.id === t.id ? { ...x, msgs } : x)));
}

/** the talk a work was made in (by its card, or the job it waits for) */
export function talkWith(pred: (w: Work) => boolean): Talk | undefined {
  return talks().find((t) => t.msgs.some((m) => m.who === 'work' && pred(m.work)));
}
