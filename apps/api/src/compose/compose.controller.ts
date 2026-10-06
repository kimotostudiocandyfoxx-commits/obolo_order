import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ComposeChatBody, ComposeDesignBody, InstrumentalBody } from '@obolo/shared';
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

  /** PLACEHOLDER (P-MER-4): 30 tries a day per member (retries while the GPU warms up count too). */
  @Post('instrumental')
  @HttpCode(200)
  async instrumental(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    const b = parseBody(InstrumentalBody, body);
    await rateLimit(this.kv, `compose-inst:${userId}`, 30, 86400);
    return this.compose.instrumental(userId, b, `${req.protocol}://${req.get('host')}`);
  }

  /** PLACEHOLDER (P-MER-4): 20 songs a day per member until the pricing (MANA) is decided. */
  @Post('design')
  @HttpCode(200)
  async design(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `compose-design:${userId}`, 20, 86400);
    return this.compose.design(parseBody(ComposeDesignBody, body));
  }
}
