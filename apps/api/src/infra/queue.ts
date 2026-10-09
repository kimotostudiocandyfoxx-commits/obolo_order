import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { createRedis } from './kv';

/**
 * Background job queue (scale decision: heavy work goes through a queue).
 * - "inline": runs the handler in-process right after the request (demo / low traffic).
 * - "bullmq": pushes to Redis; `apps/api/dist/worker.js` (a separate Cloud Run service or
 *   GPU worker pool later) consumes it. Handlers are identical in both modes.
 */
export type JobName = 'buddy.summarize' | 'jobs.run';

export interface JobPayloads {
  'buddy.summarize': { userId: string };
  /** a row of the jobs table (song, story MV, MV lyrics — JobsService) */
  'jobs.run': { jobId: string };
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

/**
 * Cloud Tasks (client decision 2026-10-09, for scale on Cloud Run): every job becomes a task that
 * calls this API back (POST {target}/internal/jobs/{name}, signed with an OIDC token of the runtime
 * service account), so the work runs inside a request — Cloud Run gives it CPU and up to the request
 * timeout, scales out with the queue, and retries if an instance is lost. The receiving side is
 * InternalJobsController.
 */
export class CloudTasksQueue implements JobQueue {
  private readonly log = new Logger('CloudTasks');
  private readonly handlers = new Map<JobName, JobHandler<JobName>>();
  constructor(private readonly o: { queue: string; target: string; invoker: string; deadlineSeconds: number }) {}
  register<N extends JobName>(name: N, handler: JobHandler<N>) {
    this.handlers.set(name, handler as JobHandler<JobName>);
  }
  getHandler(name: string) {
    return this.handlers.get(name as JobName);
  }
  private async token(): Promise<string> {
    const res = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', { headers: { 'Metadata-Flavor': 'Google' } });
    if (!res.ok) throw new Error(`metadata token ${res.status}`);
    return ((await res.json()) as { access_token: string }).access_token;
  }
  async enqueue<N extends JobName>(name: N, payload: JobPayloads[N], opts?: { dedupeKey?: string }) {
    const url = `${this.o.target.replace(/\/$/, '')}/internal/jobs/${name}`;
    const task: Record<string, unknown> = {
      httpRequest: {
        httpMethod: 'POST',
        url,
        headers: { 'content-type': 'application/json' },
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        oidcToken: { serviceAccountEmail: this.o.invoker, audience: this.o.target },
      },
      dispatchDeadline: `${this.o.deadlineSeconds}s`,
    };
    // a dedupe key becomes the task name (Cloud Tasks refuses a second task with the same name)
    if (opts?.dedupeKey) task.name = `${this.o.queue}/tasks/${opts.dedupeKey.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 400)}-${Math.floor(Date.now() / 60_000)}`;
    const res = await fetch(`https://cloudtasks.googleapis.com/v2/${this.o.queue}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await this.token()}` },
      body: JSON.stringify({ task }),
    });
    if (res.status === 409) return; // already queued (dedupe)
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      this.log.error(`enqueue ${name} failed ${res.status}: ${text}`);
      throw new Error(`Cloud Tasks ${res.status}`);
    }
  }
  async close() {}
}
