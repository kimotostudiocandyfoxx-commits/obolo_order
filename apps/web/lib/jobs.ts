import type { JobView } from '@obolo/shared';
import { ApiError, getApi } from '@/lib/api';

/**
 * Wait for background work (a song, an MV — 2026-10-09: 受付 → 順番に処理 → できたら通知): poll the
 * job every few seconds, report its stage, resolve with the finished job or throw its error.
 * The member may also leave: a push arrives when it is done.
 */
export async function waitJob(job: JobView, onStage?: (stage: string | null) => void, everyMs = 4000): Promise<JobView> {
  let j = job;
  let last: string | null | undefined;
  for (;;) {
    if (j.stage !== last) onStage?.((last = j.stage));
    if (j.status === 'done') return j;
    if (j.status === 'failed') throw new ApiError(422, j.errorCode ?? 'JOB_FAILED', j.error ?? 'The work did not finish');
    await new Promise((r) => setTimeout(r, everyMs));
    try {
      j = await getApi().getJob(j.id);
    } catch (e) {
      // a blip on the network: keep waiting; a missing job ends the wait
      if (e instanceof ApiError && e.status === 404) throw e;
    }
  }
}
