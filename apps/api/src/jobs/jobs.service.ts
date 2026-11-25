import { HttpException, HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { batiSay, estimateEtaMs, fillLine, lateEta, MOON_LINES, shouldRetry, type DemoJobBody, type EtaKind, type FullSongBody, type JobKind, type JobView, type MakeConfirm, type MakeKind, type MvEditBody, type SpellTag } from '@obolo/shared';
import { and, count, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { SongService } from '../compose/song.service';
import { Database } from '../db/db';
import { jobs, users } from '../db/schema';
import { activeBati } from '../look/batis';
import type { JobQueue } from '../infra/queue';
import { QUEUE } from '../infra/tokens';
import { MvService } from '../mv/mv.service';
import { GameService, type GameJobInput } from '../craft/game.service';
import { PushService } from '../push/push.service';
import { costScope, type CostCtx } from '../wallet/cost-scope';
import { LedgerService } from '../wallet/ledger.service';

type Row = typeof jobs.$inferSelect;
type Inputs = {
  /** R16: `confirm` = the yes a Moon atelier song was charged with (its mana goes back when it fails for good) */
  song: { body: FullSongBody; origin: string; confirm?: MakeConfirm };
  /** R13: `tags` = the video's spell; `confirm` + `pay` = the yes it was charged with (the mana goes back when it fails for good) */
  'mv-story': { mvId: string; mood: string; origin: string; from?: 'atelier'; tags?: SpellTag[]; confirm?: MakeConfirm; pay?: MakeKind };
  /** R13: a video of the member's own pictures, a free re-render (edit), or scenes painted again (redraw) */
  'mv-edit': { mvId: string; origin: string; from?: 'atelier'; mode: 'pictures' | 'edit' | 'redraw'; tags?: SpellTag[]; edit?: MvEditBody; scenes?: number[]; confirm?: MakeConfirm; pay?: MakeKind };
  'mv-lyrics': { mvId: string; origin: string };
  /** M-R253: the review page's stand-in (it only waits) */
  demo: DemoJobBody;
  /** client 2026-11-25: a game built or tweaked (its yes: the mana goes back when it fails for good) */
  game: GameJobInput;
  /** R17: a finished song split on our GPU (stems, line times; `voice`: sung in the member's voice too) — when a change first needs it */
  'song-split': { songId: string; origin: string; voice?: boolean };
};

/** what a job's free costs are filed under (its paid making comes from the charge's scope) */
const FEATURE_OF: Record<JobKind, CostCtx['feature']> = { song: 'songEdit', 'mv-story': 'videoEdit', 'mv-edit': 'videoEdit', 'mv-lyrics': 'videoEdit', demo: 'other', game: 'other' };

/** what each job is timed as (M-R253 §4) */
export const ETA_OF: Record<JobKind, EtaKind> = { song: 'song', 'mv-story': 'mv', 'mv-lyrics': 'mv', demo: 'demo', game: 'game', 'mv-edit': 'mvEdit', 'song-split': 'mvEdit' };
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
    private readonly games: GameService,
    private readonly ledger: LedgerService,
  ) {}

  onModuleInit() {
    this.queue.register('jobs.run', ({ jobId }) => this.run(jobId));
  }

  async create<K extends JobKind>(userId: string, kind: K, input: Inputs[K]): Promise<JobView> {
    const etaMs = await this.estimate(kind, input);
    // client 2026-11-25: the paid making this request charged (LedgerService.charge tagged the scope) goes with the job,
    // so the job's provider costs are that making's (one `job` key: the yes's ledger key)
    const s = costScope.get();
    const cost = s?.paid && s.kind ? { kind: s.kind, job: s.job, paid: true } : undefined;
    const [row] = await this.db.write
      .insert(jobs)
      .values({ userId, kind, inputJson: { ...(input as unknown as Record<string, unknown>), ...(cost ? { _cost: cost } : {}) }, etaMs, etaAt: new Date(Date.now() + etaMs) })
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
    // its provider costs: the paid making it was charged as, else a free feature of the member (a re-render, a free song)
    const paid = (row.inputJson as { _cost?: { kind: CostCtx['kind']; job?: string; paid?: boolean } } | null)?._cost;
    return costScope.run({ userId: row.userId, feature: FEATURE_OF[row.kind as JobKind] ?? 'other', ...(paid ? { kind: paid.kind, job: paid.job ?? row.id, paid: true } : { job: row.id }) }, () => this.runScoped(row));
  }

  private async runScoped(row: Row): Promise<void> {
    const jobId = row.id;
    if (row.status === 'running' && row.startedAt && Date.now() - row.startedAt.getTime() < LOST_AFTER_MS) return; // already running elsewhere
    const attempts = row.attempts + 1;
    await this.patch(jobId, { status: 'running', stage: row.attempts ? 'retrying' : 'start', attempts, startedAt: new Date() });
    const t0 = Date.now();
    try {
      const result = await this.work({ ...row, attempts });
      await this.finish(jobId, 'done', result, null);
      this.log.log(`job ${jobId} ${row.kind} done in ${Math.round((Date.now() - t0) / 1000)}s`);
      await this.notify(row, true, result);
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
      // a game that could not be made gives its mana back (once per yes)
      if (row.kind === 'game') await this.games.refundJob(row.userId, row.inputJson as unknown as GameJobInput);
      // R16: so does a song from the Moon atelier (its card says the mana is back)
      if (row.kind === 'song') await this.refundSong(row.userId, row.inputJson as unknown as Inputs['song']);
      // R13: so does a video (painted or moved) and a scene painted again
      if (row.kind === 'mv-story' || row.kind === 'mv-edit') await this.refundVideo(row.userId, row.inputJson as unknown as Inputs['mv-edit']);
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
      case 'song-split': {
        const input = row.inputJson as unknown as Inputs['song-split'];
        const until = Date.now() + WARM_WAIT_MS;
        for (;;) {
          try {
            await this.stage(row.id, 'splitting');
            return { song: await this.songs.split(row.userId, input.songId, input.origin, { voice: !!input.voice }) };
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
        return { mv: await this.mv.story(row.userId, input.mvId, input.origin, input.mood, input.tags) };
      }
      case 'mv-edit': {
        const input = row.inputJson as unknown as Inputs['mv-edit'];
        await this.stage(row.id, input.mode === 'redraw' ? 'painting' : 'moving');
        if (input.mode === 'pictures') return { mv: await this.mv.pictures(row.userId, input.mvId, input.origin, input.tags ?? []) };
        if (input.mode === 'redraw') return { mv: await this.mv.redraw(row.userId, input.mvId, input.origin, { scenes: input.scenes ?? [], spell: input.tags ?? [] }) };
        return { mv: await this.mv.edit(row.userId, input.mvId, input.origin, input.edit!) };
      }
      case 'mv-lyrics': {
        const input = row.inputJson as unknown as Inputs['mv-lyrics'];
        await this.stage(row.id, 'lyrics');
        return { mv: await this.mv.withLyrics(row.userId, input.mvId, input.origin) };
      }
      case 'game': {
        const input = row.inputJson as unknown as Inputs['game'];
        await this.stage(row.id, 'writing');
        return { game: await this.games.make(row.userId, input) };
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

  /** R16: a paid song that could not be made gives its mana back (once per yes) */
  protected async refundSong(userId: string, input: { confirm?: MakeConfirm; body?: { premium?: string } }): Promise<number> {
    if (!input.confirm) return 0;
    // R17: the secret spell's yes was charged as its own kind
    return this.ledger.refundYes(this.db, userId, input.body?.premium ? 'songPremium' : 'song', input.confirm).catch((e) => {
      this.log.error(`song refund failed for ${userId}: ${String(e)}`);
      return 0;
    });
  }

  /** a paid video job that could not be made gives its mana back (once per yes) */
  protected async refundVideo(userId: string, input: { confirm?: MakeConfirm; pay?: MakeKind; mvId: string }): Promise<number> {
    if (!input.confirm || !input.pay) return 0;
    return this.ledger.refundYes(this.db, userId, input.pay, input.confirm, input.mvId).catch((e) => {
      this.log.error(`video refund failed for ${userId}: ${String(e)}`);
      return 0;
    });
  }

  private async stage(id: string, stage: string) {
    await this.patch(id, { stage });
  }

  private async finish(id: string, status: 'done' | 'failed', result: Record<string, unknown> | null, err: { code: string; message: string } | null) {
    await this.patch(id, { status, resultJson: result, errorCode: err?.code ?? null, error: err?.message.slice(0, 500) ?? null, finishedAt: new Date() });
  }

  /** the member's {bati} (its name and manner, for the push) */
  protected async batiOf(userId: string): Promise<{ name: string; speech: Parameters<typeof batiSay>[1] }> {
    const [u] = await this.db.read.select().from(users).where(eq(users.id, userId));
    const b = u ? activeBati(u) : null;
    return { name: b?.name || u?.batiName || 'バティ', speech: b ? { personality: b.personality, egg: b.egg, self: b.self, selfCustom: b.selfCustom, callCustom: b.callCustom, lines: (b as { lines?: Record<string, string> }).lines } : null };
  }

  /**
   * A push to the member's devices (outside the app; inside it the top toast says it), in {bati}'s words (M-R253 §6 ⑤):
   * 「{bati}：{work}、できたよ！　見に来て。」; when the re-tries are over, its sorry line. Made in the Moon atelier →
   * it opens that card there.
   */
  private async notify(row: Row, ok: boolean, result?: Record<string, unknown> | null) {
    // R17: a split is a short wait in the talk (the change follows it), not a work of its own
    if (row.kind === 'song-split') return;
    const input = row.inputJson as { from?: string; body?: { from?: string; title?: string } };
    const atelier = input.from === 'atelier' || input.body?.from === 'atelier' || row.kind === 'demo';
    const url = atelier ? `/moon/atelier?job=${row.id}` : row.kind === 'song' ? '/mercury' : '/mars';
    const r = (result ?? {}) as { song?: { title?: string }; mv?: { songTitle?: string }; game?: { title?: string } };
    const work = (r.song?.title || (r.mv?.songTitle ? `${r.mv.songTitle}（MV）` : '') || r.game?.title || input.body?.title || (row.kind === 'song' ? '曲' : row.kind === 'demo' ? '作品' : row.kind === 'game' ? 'ゲーム' : 'MV')).slice(0, 30);
    const bati = await this.batiOf(row.userId).catch(() => ({ name: 'バティ', speech: null }));
    const body = fillLine(batiSay(ok ? MOON_LINES.push : MOON_LINES.stop, bati.speech), { bati: bati.name, work });
    await this.push.notify(row.userId, { title: bati.name, body, url, tag: `job-${row.id}` }).catch(() => undefined);
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
