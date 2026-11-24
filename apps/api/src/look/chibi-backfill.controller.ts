import { Controller, Headers, HttpCode, Inject, Ip, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { and, isNotNull, isNull, sql } from 'drizzle-orm';
import { assertAdmin } from '../admin/admin.guard';
import { rateLimit } from '../common/rate-limit';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { users } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { CHIBI_TRIES, LookService } from './look.service';

/**
 * M-R262 backfill (admin token only): members who decided a look before the Saturn mini figure existed get theirs
 * painted in the background — `limit` at a time (default 50), oldest first, never one already made or out of tries.
 *   curl -X POST -H "x-admin-token: …" "https://<api>/admin/chibi-backfill?limit=50"
 */
@Controller('admin')
export class ChibiBackfillController {
  constructor(
    private readonly db: Database,
    private readonly look: LookService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('chibi-backfill')
  @HttpCode(200)
  async backfill(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Req() req: Request, @Query('limit') limit?: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
    const n = Math.max(1, Math.min(500, Number(limit) || 50));
    const rows = await this.db.read
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          isNotNull(users.avatarUrl),
          isNull(users.chibiPicUrl),
          isNull(users.deletedAt),
          sql`COALESCE((${users.onboardingJson}->>'chibi.tries')::int, 0) < ${CHIBI_TRIES}`,
        ),
      )
      .orderBy(users.createdAt)
      .limit(n);
    const origin = `${req.protocol}://${req.get('host')}`;
    for (const r of rows) await this.look.enqueueChibi(r.id, origin);
    return { queued: rows.length };
  }
}
