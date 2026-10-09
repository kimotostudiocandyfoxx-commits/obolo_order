import type { MvProjectView } from './mv';
import type { SongView } from './types';

/**
 * Long work done in the background (2026-10-09: 受付 → 順番に処理 → できたら通知): the app starts
 * it, polls GET /jobs/:id, and gets a push when it is done.
 */
export type JobKind = 'song' | 'mv-story' | 'mv-lyrics';

export interface JobView {
  id: string;
  kind: JobKind;
  status: 'queued' | 'running' | 'done' | 'failed';
  /** where the work is: warming (the GPU studio wakes up) | singing | painting | lyrics */
  stage: string | null;
  result: { song?: SongView; mv?: MvProjectView } | null;
  errorCode: string | null;
  error: string | null;
  createdAt: string;
}
