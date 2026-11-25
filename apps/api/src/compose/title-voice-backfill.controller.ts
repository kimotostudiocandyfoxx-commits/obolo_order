import { Controller, Headers, HttpCode, Inject, Ip, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { assertAdmin } from '../admin/admin.guard';
import { rateLimit } from '../common/rate-limit';
import { AppConfig, CONFIG } from '../config';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { SongTitleVoiceService } from './song-title-voice.service';

/**
 * client 2026-11-25 backfill (admin token only): the songs on Mercury made before the title readings existed — of members
 * with a registered voice — get their title read in that voice in the background, `limit` at a time (default 50, at most
 * 500), newest post first. Absorbed (no mana: 'titleVoice'). Run again until `looked` is 0 (a reading that keeps failing
 * is looked at again each run).
 *   curl -X POST -H "x-admin-token: …" "https://<api>/admin/title-voice-backfill?limit=50"
 */
@Controller('admin')
export class TitleVoiceBackfillController {
  constructor(
    private readonly titles: SongTitleVoiceService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('title-voice-backfill')
  @HttpCode(200)
  async backfill(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Req() req: Request, @Query('limit') limit?: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
    return this.titles.backfill(Math.max(1, Math.min(500, Number(limit) || 50)), `${req.protocol}://${req.get('host')}`);
  }
}
