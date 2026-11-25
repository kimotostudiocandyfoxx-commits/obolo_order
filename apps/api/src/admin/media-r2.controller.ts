import { Controller, Get, Headers, HttpCode, Inject, Ip, NotFoundException, Post, Query } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { rateLimit } from '../common/rate-limit';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { mediaBackends } from '../media/backends';
import { line, R2MoveService } from '../media/r2-move.service';
import { assertAdmin } from './admin.guard';

/**
 * The move of the media from Bunny to Cloudflare R2 (admin token only; docs/media.md "Bunny から R2 へ"):
 *  GET  /admin/media/r2         where new files go, the counts (total / migrated / failed / bytes), recent failures
 *  POST /admin/media/r2/move    one step now (?n= files, ≤ 200): copy a batch, or switch when all are copied
 *  POST /admin/media/r2/retry   the failed files back into the queue
 *  GET  /admin/media/r2/ready   may Bunny be cancelled? ready: true when no file and no column points at Bunny
 */
@Controller('admin/media/r2')
export class AdminMediaR2Controller {
  constructor(
    private readonly moves: R2MoveService,
    private readonly db: Database,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  private async admin(token: string | undefined, ip: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
  }

  private get mover() {
    const m = this.moves.mover;
    if (!m) throw new NotFoundException({ error: { code: 'R2_NOT_CONFIGURED', message: 'R2 and Bunny must both be configured' } });
    return m;
  }

  @Get()
  async status(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string) {
    await this.admin(token, ip);
    const b = mediaBackends(this.cfg);
    const base = { newFiles: b.r2 ? 'r2' : b.bunny ? 'bunny' : 'db', r2: !!b.r2, bunny: !!b.bunny, background: this.cfg.R2_MIGRATE };
    if (!this.moves.mover) return base;
    const counts = await this.mover.status();
    const failures = await this.db.write.execute<{ id: string; key: string; tries: number; error: string }>(sql`
      SELECT id, key, move_tries AS tries, move_error AS error FROM media_objects
      WHERE deleted_at IS NULL AND storage = 'bunny' AND move_state IN ('failed', 'missing') ORDER BY updated_at DESC LIMIT 20`);
    return { ...base, counts, line: line(counts), failures: failures.rows };
  }

  @Post('move')
  @HttpCode(200)
  async move(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Query('n') n?: string) {
    await this.admin(token, ip);
    const m = this.mover;
    const r = await this.moves.tick(Math.min(200, Math.max(1, Number(n) || this.cfg.R2_MIGRATE_BATCH)));
    const counts = await m.status();
    return { busy: r === null, step: r?.step ?? null, result: r && r.step === 'copy' ? r.result : r && r.step === 'switch' ? { rows: r.rows, columns: r.columns } : null, counts, line: line(counts) };
  }

  @Post('retry')
  @HttpCode(200)
  async retry(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string) {
    await this.admin(token, ip);
    return { requeued: await this.mover.retry() };
  }

  @Get('ready')
  async ready(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string) {
    await this.admin(token, ip);
    const r = await this.mover.readiness();
    return { ...r, line: line(r.counts), say: r.ready ? 'Bunny can be cancelled: no file and no column points at Bunny any more.' : 'Not yet: see reasons.' };
  }
}
