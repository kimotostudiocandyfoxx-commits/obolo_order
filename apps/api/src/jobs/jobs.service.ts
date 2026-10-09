import { HttpException, HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { FullSongBody, JobKind, JobView } from '@obolo/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { SongService } from '../compose/song.service';
import { Database } from '../db/db';
import { jobs } from '../db/schema';
import type { JobQueue } from '../infra/queue';
import { QUEUE } from '../infra/tokens';
import { MvService } from '../mv/mv.service';
import { PushService } from '../push/push.service';

type Row = typeof jobs.$inferSelect;
type Inputs = {
  song: { body: FullSongBody; origin: string };
  'mv-story': { mvId: string; mood: string; origin: string };
  'mv-lyrics': { mvId: string; origin: string };
};

/** A job running longer than this was lost (its instance went away): the member may try again. */
const LOST_AFTER_MS = 16 * 60_000;
/** How long a song job waits for the GPU studio to wake up (inside the 15-minute request). */
const WARM_WAIT_MS = 10 * 60_000;

const errorOf = (e: unknown): { code: string; message: string } => {
  if (e instanceof HttpException) {
    const body = e.getResponse() as { error?: { code?: string; message?: string } } | string;
    if (typeof body === 'object' && body?.error) return { code: body.error.code ?? 'ERROR', message: body.error.message ?? e.message };
    return { code: HttpStatus[e.getStatus()] ?? 'ERROR', message: e.message };
  }
  return { code: 'ERROR', message: String(e instanceof Error ? e.message : e).slice(0, 300) };
};

/**
 * Long work in the background (client decision 2026-10-09: 受付 → 順番に処理 → できたら通知).
 * The request only records the job and queues it; the queue (Cloud Tasks in production, in-process
 * locally) runs it; the app polls GET /jobs/:id and gets a push when it is done.
 */
@Injectable()
export class JobsService implements OnModuleInit {
  private readonly log = new Logger('Jobs');
  constructor(
    private readonly db: Database,
    @Inject(QUEUE) private readonly queue: JobQueue,
    private readonly songs: SongService,
    private readonly mv: MvService,
    private readonly push: PushService,
  ) {}

  onModuleInit() {
    this.queue.register('jobs.run', ({ jobId }) => this.run(jobId));
  }

  async create<K extends JobKind>(userId: string, kind: K, input: Inputs[K]): Promise<JobView> {
    const [row] = await this.db.write
      .insert(jobs)
      .values({ userId, kind, inputJson: input as unknown as Record<string, unknown> })
      .returning();
    try {
      await this.queue.enqueue('jobs.run', { jobId: row.id });
    } catch (e) {
      await this.finish(row.id, 'failed', null, { code: 'QUEUE_FAILED', message: String(e) });
      throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'QUEUE_FAILED', 'Could not start the work, try again');
    }
    return this.view(row);
  }

  async get(userId: string, id: string): Promise<JobView> {
    const [row] = await this.db.read
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
    if (!row) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Job not found');
    return this.view(await this.lostCheck(row));
  }

  /** The member's unfinished jobs (to pick the wait up again after a reload). */
  async active(userId: string): Promise<JobView[]> {
    const rows = await this.db.read
      .select()
      .from(jobs)
      .where(and(eq(jobs.userId, userId), inArray(jobs.status, ['queued', 'running'])))
      .orderBy(desc(jobs.createdAt))
      .limit(10);
    return Promise.all(rows.map(async (r) => this.view(await this.lostCheck(r))));
  }

  /** Run one job (called by the queue). Never throws: the outcome is written on the row. */
  async run(jobId: string): Promise<void> {
    const [row] = await this.db.write.select().from(jobs).where(eq(jobs.id, jobId));
    if (!row || row.status === 'done' || row.status === 'failed') return;
    if (row.status === 'running' && row.startedAt && Date.now() - row.startedAt.getTime() < LOST_AFTER_MS) return; // already running elsewhere
    await this.db.write
      .update(jobs)
      .set({ status: 'running', stage: 'start', attempts: row.attempts + 1, startedAt: new Date(), updatedAt: new Date() })
      .where(eq(jobs.id, jobId));
    const t0 = Date.now();
    try {
      const result = await this.work(row);
      await this.finish(jobId, 'done', result, null);
      this.log.log(`job ${jobId} ${row.kind} done in ${Math.round((Date.now() - t0) / 1000)}s`);
      await this.notify(row, true);
    } catch (e) {
      const err = errorOf(e);
      await this.finish(jobId, 'failed', null, err);
      this.log.warn(`job ${jobId} ${row.kind} failed after ${Math.round((Date.now() - t0) / 1000)}s: ${err.code} ${err.message}`);
      await this.notify(row, false);
    }
  }

  private async work(row: Row): Promise<Record<string, unknown>> {
    switch (row.kind as JobKind) {
      case 'song': {
        const input = row.inputJson as unknown as Inputs['song'];
        // the GPU studio may be asleep: wait for it here (the member just waits for the push)
        const until = Date.now() + WARM_WAIT_MS;
        for (;;) {
          try {
            await this.stage(row.id, 'singing');
            return { song: await this.songs.createFull(row.userId, input.body, input.origin) };
          } catch (e) {
            if (errorOf(e).code !== 'MUSIC_WARMING' || Date.now() > until) throw e;
            await this.stage(row.id, 'warming');
            await new Promise((r) => setTimeout(r, 15_000));
          }
        }
      }
      case 'mv-story': {
        const input = row.inputJson as unknown as Inputs['mv-story'];
        await this.stage(row.id, 'painting');
        return { mv: await this.mv.story(row.userId, input.mvId, input.origin, input.mood) };
      }
      case 'mv-lyrics': {
        const input = row.inputJson as unknown as Inputs['mv-lyrics'];
        await this.stage(row.id, 'lyrics');
        return { mv: await this.mv.withLyrics(row.userId, input.mvId, input.origin) };
      }
      default:
        throw new Error(`unknown job kind ${row.kind}`);
    }
  }

  private async stage(id: string, stage: string) {
    await this.db.write.update(jobs).set({ stage, updatedAt: new Date() }).where(eq(jobs.id, id));
  }

  private async finish(id: string, status: 'done' | 'failed', result: Record<string, unknown> | null, err: { code: string; message: string } | null) {
    await this.db.write
      .update(jobs)
      .set({ status, resultJson: result, errorCode: err?.code ?? null, error: err?.message.slice(0, 500) ?? null, finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(jobs.id, id));
  }

  /** A push to the member's devices: the work is ready (or did not work). */
  private async notify(row: Row, ok: boolean) {
    const what = row.kind === 'song' ? '曲' : 'MV';
    const url = row.kind === 'song' ? '/mercury' : '/mars';
    await this.push
      .notify(
        row.userId,
        ok
          ? { title: `${what}ができたよ！`, body: 'タップして聴いてみてね', url, tag: `job-${row.id}` }
          : { title: `${what}を作れなかった…`, body: 'もう一回ためしてみてね', url, tag: `job-${row.id}` },
      )
      .catch(() => undefined);
  }

  /** A running job whose instance went away is reported as failed (the member may try again). */
  private async lostCheck(row: Row): Promise<Row> {
    if (row.status !== 'running' || !row.startedAt || Date.now() - row.startedAt.getTime() < LOST_AFTER_MS) return row;
    await this.finish(row.id, 'failed', null, { code: 'LOST', message: 'The work stopped, try again' });
    return { ...row, status: 'failed', errorCode: 'LOST', error: 'The work stopped, try again' };
  }

  private view(r: Row): JobView {
    return {
      id: r.id,
      kind: r.kind as JobKind,
      status: r.status as JobView['status'],
      stage: r.stage,
      result: (r.resultJson ?? null) as JobView['result'],
      errorCode: r.errorCode,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
