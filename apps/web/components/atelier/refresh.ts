import type { JobView } from '@obolo/shared';
import { lookAgain, watched, type Watched } from '@/lib/atelier/jobs';
import { patchTalkWork, putShelf, shelf, talks } from './shelf';
import { faceTo, type Msg, type Work } from './work';

/**
 * client 2026-11-25 (R16, 「さっき作ってもらった曲を聴きたいのに再生ボタンがない」): a card kept on the device is a snapshot —
 * a song asked for with a slow job was saved while it was being made (no sound yet). Wherever such a card is shown again
 * (the live talk, a past day's talk, Bluena's way into it) it is looked at on the server: done → the finished card (its
 * player, lyrics, tries), still made → its count, failed → a clear failed card (its mana is given back).
 */

/** the kinds whose mana the server gives back when their job could not be made */
const REFUNDED: Work['kind'][] = ['song', 'video', 'game'];

/** a failed job's card: a redo keeps the try before as its face; a first try shows that it could not be made */
export function failedCard(card: Work, job: Pick<JobView, 'id' | 'status'> | null, jobId = job?.id ?? card.job?.id): Work {
  const settled = jobId ? { job: jobId, failed: true } : undefined;
  // a game that could not be made: the one before stays
  if (card.kind === 'game' || card.kind === 'novel') return { ...card, status: card.game || card.book ? 'ready' : 'failed', job: undefined, target: undefined, settled, ...(card.game || card.book ? {} : { note: failNote(card, job) }) };
  if (card.versions?.length) return { ...faceTo({ ...card, status: 'ready', job: undefined, target: undefined }, card.versions.length - 1), settled };
  return { ...card, status: 'failed', job: undefined, target: undefined, settled, note: failNote(card, job) };
}

/** what the failed card says under its title */
export function failNote(card: Pick<Work, 'kind'>, job: Pick<JobView, 'status'> | null): string {
  return job?.status === 'failed' && REFUNDED.includes(card.kind) ? 'うまく、できなかった……。つかったマナは、もどしてあるよ' : 'うまく、できなかった……';
}

/**
 * of two copies of the same card (the talk's own and the saved one), the one further along: a card still waiting for a
 * job loses to a copy where that job is over (finished or failed); otherwise the talk's own copy stays.
 */
export function newerWork(own: Work, other: Work | undefined): Work {
  if (!other || other.id !== own.id) return own;
  if (own.status === 'making' && own.job && other.settled?.job === own.job.id) return other;
  // the saved copy is still making the job this one already settled: keep this one
  return own;
}

/** a talk's messages with each card replaced by its saved copy when that is further along */
export function mergeMsgs(own: Msg[], saved: Msg[] | undefined): Msg[] {
  if (!saved?.length) return own;
  const byId = new Map<string, Work>();
  for (const m of saved) if (m.who === 'work') byId.set(m.work.id, m.work);
  let changed = false;
  const out = own.map((m) => {
    if (m.who !== 'work') return m;
    const w = newerWork(m.work, byId.get(m.work.id));
    if (w === m.work) return m;
    changed = true;
    return { ...m, work: w };
  });
  return changed ? out : own;
}

/** the saved talk's copy of a talk's messages, merged (the talk opened again with an older copy in memory) */
export function freshMsgs(talkId: string, own: Msg[]): Msg[] {
  return mergeMsgs(own, talks().find((t) => t.id === talkId)?.msgs);
}

/** does this card need a look on the server? (a job it waits for) */
export const stale = (w: Work) => w.status === 'making' && !!w.job?.id;

/** the watch of a card's job (the device's own, or one made from the card when it is no longer watched) */
export function watchOf(w: Work, talkId?: string): Watched | null {
  const id = w.job?.id;
  if (!id) return null;
  const own = watched().find((x) => x.jobId === id);
  if (own) return own;
  const what: Watched['what'] = w.kind === 'song' || w.kind === 'video' || w.kind === 'art' || w.kind === 'voice' || w.kind === 'game' ? w.kind : 'demo';
  return { jobId: id, what, card: w, talkId, toast: !!w.job?.long, words: w.prompt, extra: w.title ? { songTitle: w.title } : undefined, since: Date.now() };
}

/**
 * one card looked at on the server: the card as it is now (the same card while still made). The finished / failed card
 * is written into the saved talk (and Bluena's shelf for device kinds) by the job host.
 */
export async function refreshWork(w: Work, talkId?: string): Promise<Work> {
  if (!stale(w)) return w;
  const watch = watchOf(w, talkId);
  if (!watch) return w;
  const got = await lookAgain(watch).catch(() => undefined);
  if (!got) return w;
  const out = { ...got, id: w.id };
  patchTalkWork(talkId, out);
  if (shelf().some((x) => x.id === w.id)) putShelf(out);
  return out;
}

/** every card of these messages still making, looked at (a past day's talk opened) */
export async function refreshMsgs(msgs: Msg[], talkOf: (m: Msg) => string | undefined): Promise<Map<string, Work>> {
  const out = new Map<string, Work>();
  await Promise.all(
    msgs.map(async (m) => {
      if (m.who !== 'work' || !stale(m.work)) return;
      const w = await refreshWork(m.work, talkOf(m));
      if (w !== m.work) out.set(m.work.id, w);
    }),
  );
  return out;
}
