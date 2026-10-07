import { Body, Controller, Get, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ComposeChatBody, ComposeDesignBody, InstrumentalBody, SingBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { ComposeService } from './compose.service';

/** Mercury 作曲 (see ComposeService). */
@Controller('compose')
@UseGuards(AuthGuard)
export class ComposeController {
  constructor(
    private readonly compose: ComposeService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('chat')
  @HttpCode(200)
  async chat(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `compose-chat:${userId}`, 20, 60);
    return this.compose.chat(parseBody(ComposeChatBody, body));
  }

  /** The GPU studio's state (warming up, downloading, error) for the song card. */
  @Get('music-status')
  async musicStatus(@UserId() userId: string) {
    await rateLimit(this.kv, `compose-status:${userId}`, 30, 60);
    return this.compose.musicStatus();
  }

  /** PLACEHOLDER (P-MER-4): 30 tries a day per member (retries while the GPU warms up count too). */
  @Post('instrumental')
  @HttpCode(200)
  async instrumental(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    const b = parseBody(InstrumentalBody, body);
    await rateLimit(this.kv, `compose-inst:${userId}`, 30, 86400);
    return this.compose.instrumental(userId, b, `${req.protocol}://${req.get('host')}`);
  }

  /** PLACEHOLDER (P-VOICE-3): 10 sung songs a day per member (each one is a paid Fish call). */
  @Post('sing')
  @HttpCode(200)
  async sing(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    const b = parseBody(SingBody, body);
    await rateLimit(this.kv, `compose-sing:${userId}`, 10, 86400);
    return this.compose.sing(userId, b, `${req.protocol}://${req.get('host')}`);
  }

  /** PLACEHOLDER (P-MER-4): 20 songs a day per member until the pricing (MANA) is decided. */
  @Post('design')
  @HttpCode(200)
  async design(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `compose-design:${userId}`, 20, 86400);
    return this.compose.design(parseBody(ComposeDesignBody, body));
  }
}
