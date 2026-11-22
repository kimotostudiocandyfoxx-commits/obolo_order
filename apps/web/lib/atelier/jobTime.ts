import { leftWords, progressOf, QUICK_MS, type JobView } from '@obolo/shared';

/** M-R253 §4: the times of a watched job (pure: the card's count, what {bati} says) */
export type JobEventKind = 'late' | 'retrying' | 'done' | 'failed';

/** what changed between two looks at a job (said once each) */
export function jobEvents(prev: JobView | undefined, next: JobView): JobEventKind[] {
  const out: JobEventKind[] = [];
  if (next.status === 'done') return prev?.status === 'done' ? [] : ['done'];
  if (next.status === 'failed') return prev?.status === 'failed' ? [] : ['failed'];
  if (next.retrying && (!prev?.retrying || (prev.attempts ?? 0) !== (next.attempts ?? 0))) out.push('retrying');
  else if (next.late && prev?.etaAt && next.etaAt && Date.parse(next.etaAt) > Date.parse(prev.etaAt)) out.push('late');
  return out;
}

/** ms to its time (0 when there is no time) */
export function msLeft(job: Pick<JobView, 'etaAt'> | undefined, now = Date.now()): number {
  return job?.etaAt ? Math.max(0, Date.parse(job.etaAt) - now) : 0;
}

/** said up front? (more than 30 s: 「〇分後に戻ってきてね」; else you wait in place, no time said) */
export function isLong(job: Pick<JobView, 'etaAt' | 'createdAt'> | undefined, now = Date.now()): boolean {
  return msLeft(job, now) > QUICK_MS;
}

/** the card's count: the words (「あと3分」, none when it is quick) and how far it has filled */
export function countdown(job: Pick<JobView, 'etaAt' | 'startedAt' | 'createdAt'> | undefined, now = Date.now(), long = true): { left: string | null; progress: number } {
  if (!job?.etaAt) return { left: null, progress: 0 };
  const start = Date.parse(job.startedAt ?? job.createdAt);
  return { left: long ? leftWords(msLeft(job, now)) : null, progress: progressOf(start, Date.parse(job.etaAt), now) };
}

