import { Controller, Headers, HttpCode, Inject, Ip, Post, Query } from '@nestjs/common';
import { assertAdmin } from '../admin/admin.guard';
import { rateLimit } from '../common/rate-limit';
import { AppConfig, CONFIG } from '../config';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { BatiVoiceService } from './bati-voice.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * M-R342 one-off (admin token only): the members' voice models made before M-R342 (from the day-2 recording pitched up
 * two semitones) are made again from the stored recording as it is — BatiVoiceService.remakeOld. A page of members at
 * a time in the order of their ids (`limit`, default 20, at most 100: each is one ffmpeg run and one Fish model call).
 *   curl -X POST -H "x-admin-token: …" "https://<api>/admin/voice-models-remake?limit=20"
 * → { looked, remade, notAllowed, noRecording, failed, next } — run again with `&after=<next>` until `next` is null.
 * Safe to run again from the start at any time: a model already made without the pitch change is marked and skipped;
 * `notAllowed` members (no current agreement — after a new consent version, everyone until they agree again) and
 * failures stay as they are and are picked up by a later run. Members without a stored recording are never looked at.
 */
@Controller('admin')
export class VoiceModelsRemakeController {
  constructor(
    private readonly voices: BatiVoiceService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('voice-models-remake')
  @HttpCode(200)
  async remake(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Query('after') after?: string, @Query('limit') limit?: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
    return this.voices.remakeOld(after && UUID_RE.test(after) ? after.toLowerCase() : null, Math.max(1, Math.min(100, Number(limit) || 20)));
  }
}
