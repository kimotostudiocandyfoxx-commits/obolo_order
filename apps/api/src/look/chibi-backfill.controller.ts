import { Controller, Headers, HttpCode, Inject, Ip, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PLANET_FIGURES } from '@obolo/shared';
import { and, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { assertAdmin } from '../admin/admin.guard';
import { rateLimit } from '../common/rate-limit';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { users } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { FIGURE_TRIES, triesKey } from './figures.service';
import { LookService } from './look.service';

/** a figure of the look worn now that is not made and still has tries left */
const missing = (f: (typeof PLANET_FIGURES)[number]) => {
  const e = sql`(${users.planetFigures} -> ${users.avatarUrl})`;
  return sql`((${e} ->> ${f}) IS NULL AND COALESCE((${e} ->> ${triesKey(f)})::int, 0) < ${FIGURE_TRIES})`;
};

/**
 * M-R262 backfill, client 2026-11-25 (admin token only): members whose look has planet figures still to make (made
 * before the figures existed, or one that failed) get them made in the background — `limit` at a time (default 50,
 * at most 500), oldest first; a figure already made or out of its tries (FIGURE_TRIES)
 * is never painted again. Absorbed (no mana).
 *   curl -X POST -H "x-admin-token: …" "https://<api>/admin/chibi-backfill?limit=50"
 *   (the same at /admin/figures-backfill)
 */
@Controller('admin')
export class ChibiBackfillController {
  constructor(
    private readonly db: Database,
    private readonly look: LookService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post(['chibi-backfill', 'figures-backfill'])
  @HttpCode(200)
  async backfill(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Req() req: Request, @Query('limit') limit?: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
    const n = Math.max(1, Math.min(500, Number(limit) || 50));
    const rows = await this.db.read
      .select({ id: users.id, look: users.avatarUrl })
      .from(users)
      .where(and(isNotNull(users.avatarUrl), isNull(users.deletedAt), or(...PLANET_FIGURES.map(missing))))
      .orderBy(users.createdAt)
      .limit(n);
    const origin = `${req.protocol}://${req.get('host')}`;
    for (const r of rows) if (r.look) await this.look.enqueueFigures(r.id, origin, r.look, false, true);
    return { queued: rows.length, tries: FIGURE_TRIES };
  }
}
