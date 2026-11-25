import type { VideoReel } from '@/components/atelier/video';
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
  what: 'song' | 'video' | 'art' | 'voice' | 'demo' | 'game';
  /** the card (its id is the work's; a redo keeps the work's id) */
  card: Work;
  talkId?: string;
  /** long enough to have said 「〇分後に戻ってきてね」: tell when it is done */
  toast: boolean;
  /** the words used (the finisher of a review stand-in makes its sketch from them) */
  words: string;
  /** the song an MV is made on, the material's picture … (the finisher's inputs) */
  extra?: { comment?: string; still?: string | null; songTitle?: string; /** R11: the plan's genre (the stand-in song) */ genre?: string; /** R13: the review page's video (its canned frames and settings) */ reel?: VideoReel; /** story 2026-11-25: an art painted for a game's case */ coverFor?: string };
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
/** what a job that could not be made (or is gone: null) leaves on its card — the host writes it into the saved talk */
type Fail = (w: Watched, job: JobView | null) => Work;
let polling: ReturnType<typeof setInterval> | null = null;
let busy = false;
let host: { finish: Finish; fail: Fail } | null = null;
/** client 2026-11-25 (R16): a job being finished (the host's loop and an opened card may look at the same one) */
const settling = new Map<string, Promise<Work | undefined>>();
/** …and what it came to (this visit): a second look gets the same card, never a second finishing */
const settled = new Map<string, Work>();

/** one look at a watched job: its events said; when it is over, its card finished (or failed) */
function look(w: Watched, next: JobView): Promise<Work | undefined> {
  const prev = views.get(w.jobId);
  views.set(w.jobId, next);
  const ks = jobEvents(prev, next);
  if (next.status === 'done' || next.status === 'failed') return over(w, next);
  for (const k of ks) emit({ kind: k, job: next, w });
  if (!ks.length) emit(null);
  return Promise.resolve(undefined);
}

/** the job is over (done / failed / gone): finished once, its event said once */
function over(w: Watched, next: JobView | null): Promise<Work | undefined> {
  const was = settled.get(w.jobId);
  if (was) return Promise.resolve(was);
  const running = settling.get(w.jobId);
  if (running) return running;
  if (!host) return Promise.resolve(undefined);
  const { finish, fail } = host;
  const p = (async () => {
    unwatch(w.jobId);
    const work = next?.status === 'done' ? await finish(w, next).catch(() => fail(w, next)) : fail(w, next);
    settled.set(w.jobId, work);
    if (next) emit({ kind: work.status === 'failed' ? 'failed' : 'done', job: next, w, work });
    else emit(null);
    return work;
  })().finally(() => settling.delete(w.jobId));
  settling.set(w.jobId, p);
  return p;
}

/**
 * client 2026-11-25 (R16): a card still making looked at again (opened, or its talk loaded): its job is asked for on
 * the server now, not on the host's next tick; done → finished as the host does it, failed / gone → its failed card.
 * `w` is the device's watch (or one made from the card when the device no longer watches it). Undefined: still made.
 */
export async function lookAgain(w: Watched): Promise<Work | undefined> {
  const was = settled.get(w.jobId) ?? (await settling.get(w.jobId));
  if (was) return was;
  let next: JobView;
  try {
    next = await getApi().getJob(w.jobId);
  } catch (e) {
    if ((e as { status?: number }).status === 404) return over(w, null);
    return undefined;
  }
  return look(w, next);
}

/** client 2026-11-25 (R16): the done / failed cards {bati} has spoken about in a live talk (said once, even later) */
const SAID_KEY = 'obolo.atelier.jobs.said.v1';
function saidList(): string[] {
  try {
    return (JSON.parse(localStorage.getItem(SAID_KEY) ?? '[]') as string[]) ?? [];
  } catch {
    return [];
  }
}
export function jobSaid(jobId: string): boolean {
  return saidList().includes(jobId);
}
export function markJobSaid(jobId: string) {
  try {
    localStorage.setItem(SAID_KEY, JSON.stringify([jobId, ...saidList().filter((x) => x !== jobId)].slice(0, 100)));
  } catch {
    /* said in this visit only */
  }
}

/** the host's loop: every few seconds each watched job is looked at; done → finished by `finish`, failed → `fail` */
export function startJobPolling(finish: Finish, fail: Fail, everyMs = 3000): () => void {
  host = { finish, fail };
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      for (const w of [...all()]) {
        let next: JobView;
        try {
          next = await getApi().getJob(w.jobId);
        } catch (e) {
          // gone (another device finished it, a reset demo): its card is not left making for ever
          if ((e as { status?: number }).status === 404) await over(w, null);
          continue;
        }
        await look(w, next);
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
