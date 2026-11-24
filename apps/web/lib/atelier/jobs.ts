import type { JobView } from '@obolo/shared';
import { jobEvents } from './jobTime';
export { countdown, isLong, jobEvents, msLeft } from './jobTime';
import type { Work } from '@/components/atelier/work';
import { getApi } from '@/lib/api';

/**
 * M-R253 §4: the slow generations, watched for the whole app (not only the atelier). A job started in the Moon atelier
 * is kept here with its card; one host (components/JobToasts, in the app's layout) polls them wherever you are,
 * finishes the card when its job is done (puts it in Bluena, writes it into the saved talk) and shows the small toast at
 * the top (outside the app the server's push says it). The atelier listens to say {bati}'s lines (late, made again,
 * done) and to update its cards.
 */
export type Watched = {
  jobId: string;
  /** what the finished job makes */
  what: 'song' | 'video' | 'art' | 'voice' | 'demo';
  /** the card (its id is the work's; a redo keeps the work's id) */
  card: Work;
  talkId?: string;
  /** long enough to have said 「〇分後に戻ってきてね」: tell when it is done */
  toast: boolean;
  /** the words used (the finisher of a review stand-in makes its sketch from them) */
  words: string;
  /** the song an MV is made on, the material's picture … (the finisher's inputs) */
  extra?: { comment?: string; still?: string | null; songTitle?: string; /** R11: the plan's genre (the stand-in song) */ genre?: string };
  since: number;
};

import type { JobEventKind } from './jobTime';
export type { JobEventKind } from './jobTime';
export type JobEvent = { kind: JobEventKind; job: JobView; w: Watched; work?: Work };

const KEY = 'obolo.atelier.jobs.v1';
const read = (): Watched[] => {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as Watched[]) ?? [];
  } catch {
    return [];
  }
};
const write = (ws: Watched[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(ws.slice(0, 20)));
  } catch {
    /* private window: watched while the app is open */
  }
};

let list: Watched[] | null = null;
const views = new Map<string, JobView>();
const listeners = new Set<(e: JobEvent | null) => void>();
const all = () => (list ??= typeof window === 'undefined' ? [] : read());

export function watched(): Watched[] {
  return all();
}
export function watchedFor(workId: string): Watched | undefined {
  return all().find((w) => w.card.id === workId);
}
export function watchJob(w: Watched, job?: JobView) {
  list = [w, ...all().filter((x) => x.jobId !== w.jobId)];
  write(list);
  if (job) views.set(w.jobId, job);
  emit(null);
}
export function unwatch(jobId: string) {
  list = all().filter((x) => x.jobId !== jobId);
  write(list);
}
export function jobView(id: string | undefined): JobView | undefined {
  return id ? views.get(id) : undefined;
}
export function onJobs(fn: (e: JobEvent | null) => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export function emit(e: JobEvent | null) {
  for (const fn of listeners) fn(e);
}

type Finish = (w: Watched, job: JobView) => Promise<Work>;
let polling: ReturnType<typeof setInterval> | null = null;
let busy = false;

/** the host's loop: every few seconds each watched job is looked at; done → finished by `finish` */
export function startJobPolling(finish: Finish, everyMs = 3000): () => void {
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      for (const w of [...all()]) {
        let next: JobView;
        try {
          next = await getApi().getJob(w.jobId);
        } catch (e) {
          // gone (another device finished it, a reset demo): stop watching
          if ((e as { status?: number }).status === 404) unwatch(w.jobId);
          continue;
        }
        const prev = views.get(w.jobId);
        views.set(w.jobId, next);
        for (const k of jobEvents(prev, next)) {
          if (k === 'done') {
            unwatch(w.jobId);
            const work = await finish(w, next).catch(() => ({ ...w.card, status: 'failed' as const }));
            emit({ kind: work.status === 'failed' ? 'failed' : 'done', job: next, w, work });
          } else if (k === 'failed') {
            unwatch(w.jobId);
            emit({ kind: 'failed', job: next, w, work: { ...w.card, status: 'failed' } });
          } else emit({ kind: k, job: next, w });
        }
        if (!jobEvents(prev, next).length) emit(null);
      }
    } finally {
      busy = false;
    }
  };
  void tick();
  polling ??= setInterval(() => void tick(), everyMs);
  return () => {
    if (polling) clearInterval(polling);
    polling = null;
  };
}
