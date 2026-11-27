import { Controller, Headers, HttpCode, Inject, Ip, Post, Query } from '@nestjs/common';
import { assertAdmin } from '../admin/admin.guard';
import { rateLimit } from '../common/rate-limit';
import { AppConfig, CONFIG } from '../config';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { DachiVoiceDraftService } from './voice-draft.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * client 2026-11-27 one-off cleanup (admin token only): the "last take" of a ダチ voice message — one clean file per
 * member and its pointer `voice-take:<member>` (30 days) — was kept only on 2026-11-27, for a trial of the voice
 * settings the sender no longer has (they do not hear their own voice). Nothing keeps it any more; this removes what
 * was kept: a page of members at a time in the order of their ids (`limit`, default 500, at most 2000).
 *   curl -X POST -H "x-admin-token: …" "https://<api>/admin/voice-takes-cleanup?limit=500"
 * → { looked, removed, next } — run again with `&after=<next>` until `next` is null. (A member's own take also goes at
 * their next voice message or voice-settings turn: DachiVoiceDraftService.forgetTake.)
 */
@Controller('admin')
export class VoiceTakesCleanupController {
  constructor(
    private readonly drafts: DachiVoiceDraftService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('voice-takes-cleanup')
  @HttpCode(200)
  async cleanup(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Query('after') after?: string, @Query('limit') limit?: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
    return this.drafts.sweepTakes(after && UUID_RE.test(after) ? after.toLowerCase() : null, Math.max(1, Math.min(2000, Number(limit) || 500)));
  }
}
