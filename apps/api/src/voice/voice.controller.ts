import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { RegisterVoiceBody, SpeakBody } from '@obolo/shared';
import type { Request } from 'express';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { VoiceService } from './voice.service';

/** Member voices (see VoiceService). */
@Controller('voice')
@UseGuards(AuthGuard)
export class VoiceController {
  constructor(
    private readonly voice: VoiceService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('register')
  @HttpCode(200)
  async register(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `voice-reg:${userId}`, 10, 86400);
    return this.voice.register(userId, parseBody(RegisterVoiceBody, body));
  }

  /** PLACEHOLDER (P-VOICE-3): 100 read-alouds a day per member until pricing is decided. */
  @Post('speak')
  @HttpCode(200)
  async speak(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `voice-speak:${userId}`, 100, 86400);
    return this.voice.speak(userId, parseBody(SpeakBody, body), `${req.protocol}://${req.get('host')}`);
  }
}
