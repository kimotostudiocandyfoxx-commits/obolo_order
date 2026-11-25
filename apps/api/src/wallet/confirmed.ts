import { HttpStatus } from '@nestjs/common';
import type { JobView, MakeConfirm, MakeKind } from '@obolo/shared';
import { apiError } from '../common/errors';
import type { Database } from '../db/db';
import type { KvStore } from '../infra/kv';
import type { LedgerService } from './ledger.service';

/** where the job a yes started is remembered (a repeat of the same yes gets it back) */
export const confirmJobKey = (userId: string, confirm: MakeConfirm) => `confirm-job:${userId}:${confirm.id}`;

/**
 * R11: a paid background job — charged with the member's yes (LedgerService.charge), then started. The same yes again
 * (a double tap, a retry of the same request) is never a second charge nor a second job: the job the first started
 * comes back, or 409 ALREADY_STARTED while it is still being queued. A job that cannot be queued gives the mana back.
 */
export async function startConfirmed(o: {
  ledger: Pick<LedgerService, 'charge'>;
  db: Database;
  kv: Pick<KvStore, 'get' | 'set'>;
  jobs: { get(userId: string, id: string): Promise<JobView> };
  userId: string;
  kind: MakeKind;
  refId?: string;
  confirm?: MakeConfirm;
  /** spellKey of the spell the request carries (it must be the one said yes to) */
  spell?: string | null;
  required: boolean;
  /** R18: this work's own quote (the server's), instead of the kind's price list */
  price?: number;
  create: () => Promise<JobView>;
}): Promise<JobView> {
  const fee = await o.ledger.charge(o.db, o.userId, o.kind, o.refId, { confirm: o.confirm, required: o.required, spell: o.spell ?? null, ...(o.price != null ? { price: o.price } : {}) });
  const key = o.confirm ? confirmJobKey(o.userId, o.confirm) : null;
  if (fee.repeat) {
    const id = key ? await o.kv.get(key) : null;
    if (id) return o.jobs.get(o.userId, id);
    throw alreadyStarted();
  }
  try {
    const job = await o.create();
    if (key) await o.kv.set(key, job.id, 60 * 60 * 24);
    return job;
  } catch (e) {
    await fee.refund();
    throw e;
  }
}

export const alreadyStarted = () => apiError(HttpStatus.CONFLICT, 'ALREADY_STARTED', 'もう作り始めているよ');
