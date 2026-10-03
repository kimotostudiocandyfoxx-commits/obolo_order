import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { createRedis } from './kv';

/**
 * Background job queue (scale decision: heavy work goes through a queue).
 * - "inline": runs the handler in-process right after the request (demo / low traffic).
 * - "bullmq": pushes to Redis; `apps/api/dist/worker.js` (a separate Cloud Run service or
 *   GPU worker pool later) consumes it. Handlers are identical in both modes.
 */
export type JobName = 'buddy.summarize';

export interface JobPayloads {
  'buddy.summarize': { userId: string };
}

export type JobHandler<N extends JobName> = (payload: JobPayloads[N]) => Promise<void>;

export interface JobQueue {
  enqueue<N extends JobName>(name: N, payload: JobPayloads[N], opts?: { dedupeKey?: string }): Promise<void>;
  register<N extends JobName>(name: N, handler: JobHandler<N>): void;
  getHandler(name: string): JobHandler<JobName> | undefined;
  close(): Promise<void>;
}

export const QUEUE_NAME = 'obolo-jobs';

export class InlineQueue implements JobQueue {
  private readonly log = new Logger('InlineQueue');
  private readonly handlers = new Map<JobName, JobHandler<JobName>>();
  private readonly running = new Set<string>();
  register<N extends JobName>(name: N, handler: JobHandler<N>) {
    this.handlers.set(name, handler as JobHandler<JobName>);
  }
  getHandler(name: string) {
    return this.handlers.get(name as JobName);
  }
  async enqueue<N extends JobName>(name: N, payload: JobPayloads[N], opts?: { dedupeKey?: string }) {
    const h = this.handlers.get(name);
    if (!h) throw new Error(`No handler for ${name}`);
    const key = opts?.dedupeKey;
    if (key && this.running.has(key)) return;
    if (key) this.running.add(key);
    setImmediate(() => {
      h(payload)
        .catch((err) => this.log.error(`job ${name} failed: ${String(err)}`))
        .finally(() => key && this.running.delete(key));
    });
  }
  async close() {}
}

export class BullQueue implements JobQueue {
  private readonly queue: Queue;
  private readonly handlers = new Map<JobName, JobHandler<JobName>>();
  constructor(redisUrl: string) {
    this.queue = new Queue(QUEUE_NAME, { connection: createRedis(redisUrl) });
  }
  /** Handlers are registered everywhere but only executed by the worker process (src/worker.ts). */
  register<N extends JobName>(name: N, handler: JobHandler<N>) {
    this.handlers.set(name, handler as JobHandler<JobName>);
  }
  getHandler(name: string) {
    return this.handlers.get(name as JobName);
  }
  async enqueue<N extends JobName>(name: N, payload: JobPayloads[N], opts?: { dedupeKey?: string }) {
    await this.queue.add(name, payload, {
      jobId: opts?.dedupeKey,
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
  async close() {
    await this.queue.close();
  }
}
