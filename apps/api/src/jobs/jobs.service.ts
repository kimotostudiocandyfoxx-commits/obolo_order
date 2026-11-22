import { HttpException, HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { estimateEtaMs, lateEta, shouldRetry, type DemoJobBody, type EtaKind, type FullSongBody, type JobKind, type JobView } from '@obolo/shared';
import { and, count, desc, eq, inArray, isNotNull } from 'drizzle-orm';
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
  'mv-story': { mvId: string; mood: string; origin: string; from?: 'atelier' };
  'mv-lyrics': { mvId: string; origin: string };
  /** M-R253: the review page's stand-in (it only waits) */
  demo: DemoJobBody;
};

/** what each job is timed as (M-R253 §4) */
export const ETA_OF: Record<JobKind, EtaKind> = { song: 'song', 'mv-story': 'mv', 'mv-lyrics': 'mv', demo: 'demo' };
type Patch = Partial<typeof jobs.$inferInsert>;

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
    const etaMs = await this.estimate(kind, input);
    const [row] = await this.db.write
      .insert(jobs)
      .values({ userId, kind, inputJson: input as unknown as Record<string, unknown>, etaMs, etaAt: new Date(Date.now() + etaMs) })
      .returning();
    try {
      await this.queue.enqueue('jobs.run', { jobId: row.id });
    } catch (e) {
      await this.finish(row.id, 'failed', null, { code: 'QUEUE_FAILED', message: String(e) });
      throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'QUEUE_FAILED', 'Could not start the work, try again');
    }
    return this.view(row);
  }

  /**
   * M-R253 §4: how long it will take — the kind's table, the recent real times of that kind, and the work waiting
   * before it. The review stand-in takes what it was asked to.
   */
  async estimate(kind: JobKind, input?: unknown): Promise<number> {
    if (kind === 'demo') return (input as DemoJobBody).seconds * 1000;
    const [recent, waiting] = await Promise.all([this.recentMs(kind), this.waiting(kind)]);
    return estimateEtaMs(ETA_OF[kind], recent, waiting);
  }

  /** the last real times of this kind (ms), oldest first */
  protected async recentMs(kind: JobKind): Promise<number[]> {
    const rows = await this.db.read
      .select({ s: jobs.startedAt, f: jobs.finishedAt })
      .from(jobs)
      .where(and(eq(jobs.kind, kind), eq(jobs.status, 'done'), isNotNull(jobs.startedAt), isNotNull(jobs.finishedAt)))
      .orderBy(desc(jobs.finishedAt))
      .limit(20);
    return rows.map((r) => r.f!.getTime() - r.s!.getTime()).reverse();
  }

  /** how many of this kind are queued or running (everyone's: the studio is shared) */
  protected async waiting(kind: JobKind): Promise<number> {
    const [r] = await this.db.read
      .select({ n: count() })
      .from(jobs)
      .where(and(eq(jobs.kind, kind), inArray(jobs.status, ['queued', 'running'])));
    return Number(r?.n ?? 0);
  }

  protected async load(id: string): Promise<Row | undefined> {
    const [row] = await this.db.write.select().from(jobs).where(eq(jobs.id, id));
    return row;
  }

  protected async patch(id: string, set: Patch): Promise<void> {
    await this.db.write
      .update(jobs)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(jobs.id, id));
  }

  async get(userId: string, id: string): Promise<JobView> {
    const [row] = await this.db.read
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
    if (!row) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Job not found');
    return this.view(await this.lateCheck(await this.lostCheck(row)));
  }

  /** M-R253 §4: near its time and not done: the time is moved on (a minute) and it is late — {bati} says it first */
  async lateCheck(row: Row, now = Date.now()): Promise<Row> {
    if ((row.status !== 'queued' && row.status !== 'running') || !row.etaAt) return row;
    const l = lateEta(row.etaAt.getTime(), now);
    if (!l.late) return row;
    const etaAt = new Date(l.etaAt);
    await this.patch(row.id, { etaAt, late: row.late + 1 });
    return { ...row, etaAt, late: row.late + 1 };
  }

  /** The member's unfinished jobs (to pick the wait up again after a reload). */
  async active(userId: string): Promise<JobView[]> {
    const rows = await this.db.read
      .select()
      .from(jobs)
      .where(and(eq(jobs.userId, userId), inArray(jobs.status, ['queued', 'running'])))
      .orderBy(desc(jobs.createdAt))
      .limit(10);
    return Promise.all(rows.map(async (r) => this.view(await this.lateCheck(await this.lostCheck(r)))));
  }

  /** Run one job (called by the queue). Never throws: the outcome is written on the row. */
  async run(jobId: string): Promise<void> {
    const row = await this.load(jobId);
    if (!row || row.status === 'done' || row.status === 'failed') return;
    if (row.status === 'running' && row.startedAt && Date.now() - row.startedAt.getTime() < LOST_AFTER_MS) return; // already running elsewhere
    const attempts = row.attempts + 1;
    await this.patch(jobId, { status: 'running', stage: row.attempts ? 'retrying' : 'start', attempts, startedAt: new Date() });
    const t0 = Date.now();
    try {
      const result = await this.work({ ...row, attempts });
      await this.finish(jobId, 'done', result, null);
      this.log.log(`job ${jobId} ${row.kind} done in ${Math.round((Date.now() - t0) / 1000)}s`);
      await this.notify(row, true);
    } catch (e) {
      const err = errorOf(e);
      this.log.warn(`job ${jobId} ${row.kind} try ${attempts} failed after ${Math.round((Date.now() - t0) / 1000)}s: ${err.code} ${err.message}`);
      // M-R253 §4: no error words — it is made again (a few times), with a new time; only then it has failed
      if (shouldRetry(err.code, attempts)) {
        const eta = await this.estimate(row.kind as JobKind, row.inputJson).catch(() => 60_000);
        await this.patch(jobId, { status: 'queued', stage: 'retrying', lastErrorCode: err.code, etaAt: new Date(Date.now() + eta) });
        try {
          await this.queue.enqueue('jobs.run', { jobId });
          return;
        } catch (qe) {
          this.log.warn(`job ${jobId} could not be queued again: ${String(qe)}`);
        }
      }
      await this.finish(jobId, 'failed', null, err);
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
      case 'demo': {
        const input = row.inputJson as unknown as Inputs['demo'];
        await this.stage(row.id, 'waiting');
        await new Promise((r) => setTimeout(r, input.seconds * 1000));
        if (row.attempts <= (input.failTimes ?? 0)) throw apiError(HttpStatus.BAD_GATEWAY, 'DEMO_FAIL', 'a stand-in failure');
        return { demo: { seconds: input.seconds } };
      }
      default:
        throw new Error(`unknown job kind ${row.kind}`);
    }
  }

  private async stage(id: string, stage: string) {
    await this.patch(id, { stage });
  }

  private async finish(id: string, status: 'done' | 'failed', result: Record<string, unknown> | null, err: { code: string; message: string } | null) {
    await this.patch(id, { status, resultJson: result, errorCode: err?.code ?? null, error: err?.message.slice(0, 500) ?? null, finishedAt: new Date() });
  }

  /**
   * A push to the member's devices (outside the app; inside it the top toast says it): the work is ready (or could not
   * be made, said gently). Made in the Moon atelier → it opens that card there.
   */
  private async notify(row: Row, ok: boolean) {
    const input = row.inputJson as { from?: string; body?: { from?: string } };
    const atelier = input.from === 'atelier' || input.body?.from === 'atelier' || row.kind === 'demo';
    const what = row.kind === 'song' ? '曲' : row.kind === 'demo' ? '作品' : 'MV';
    const url = atelier ? `/moon/atelier?job=${row.id}` : row.kind === 'song' ? '/mercury' : '/mars';
    await this.push
      .notify(
        row.userId,
        ok
          ? { title: `${what}ができたよ！`, body: 'タップして見てみてね', url, tag: `job-${row.id}` }
          : { title: `ごめん、${what}をうまく作れなかった`, body: 'タップして、もう一回ためしてみてね', url, tag: `job-${row.id}` },
      )
      .catch(() => undefined);
  }

  /** A running job whose instance went away is reported as failed (the member may try again). */
  private async lostCheck(row: Row): Promise<Row> {
    if (row.status !== 'running' || !row.startedAt || Date.now() - row.startedAt.getTime() < LOST_AFTER_MS) return row;
    // a lost try is made again too (M-R253 §4), while tries are left
    if (shouldRetry('LOST', row.attempts)) {
      const etaAt = new Date(Date.now() + (await this.estimate(row.kind as JobKind, row.inputJson).catch(() => 60_000)));
      await this.patch(row.id, { status: 'queued', stage: 'retrying', lastErrorCode: 'LOST', etaAt });
      await this.queue.enqueue('jobs.run', { jobId: row.id }).catch(() => undefined);
      return { ...row, status: 'queued', stage: 'retrying', lastErrorCode: 'LOST', etaAt };
    }
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
      etaAt: r.etaAt?.toISOString() ?? null,
      startedAt: r.startedAt?.toISOString() ?? null,
      attempts: r.attempts,
      late: r.late > 0,
      retrying: (r.status === 'queued' || r.status === 'running') && !!r.lastErrorCode,
    };
  }
}
