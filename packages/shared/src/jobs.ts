import { z } from 'zod';
import type { MvProjectView } from './mv';
import type { SongView } from './types';
import type { GameView } from './craft';

/**
 * Long work done in the background (2026-10-09: 受付 → 順番に処理 → できたら通知): the app starts
 * it, polls GET /jobs/:id, and gets a push when it is done.
 */
export type JobKind = 'song' | 'mv-story' | 'mv-lyrics' | 'demo' | 'game';

/** M-R253 §4: a review stand-in job (no AI): it takes `seconds`, the first `failTimes` tries fail (to show the re-try) */
export const DemoJobBody = z.object({ seconds: z.number().int().min(3).max(240), failTimes: z.number().int().min(0).max(2).default(0) });
export type DemoJobBody = z.infer<typeof DemoJobBody>;

export interface JobView {
  id: string;
  kind: JobKind;
  status: 'queued' | 'running' | 'done' | 'failed';
  /** where the work is: warming (the GPU studio wakes up) | singing | painting | lyrics */
  stage: string | null;
  result: { song?: SongView; mv?: MvProjectView; demo?: { seconds: number }; /** client 2026-11-25: a game built (its face) */ game?: GameView } | null;
  errorCode: string | null;
  error: string | null;
  createdAt: string;
  /** M-R253 §4: when it should be done (an estimate from the kind, recent real times and the queue); null = not timed */
  etaAt?: string | null;
  /** when this try started */
  startedAt?: string | null;
  /** tries so far (a failure is tried again automatically, up to JOB_MAX_ATTEMPTS) */
  attempts?: number;
  /** the time was moved on: {bati} says it first (「ごめん、あと1分だけ」) */
  late?: boolean;
  /** a try failed and it is being made again (no error words on screen: {bati} apologises) */
  retrying?: boolean;
}
