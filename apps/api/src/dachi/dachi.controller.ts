import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { DELIVERY_KINDS, DeliverBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { DachiLinkService } from './dachi-link.service';
import { DachiService } from './dachi.service';

@Controller('dachi')
@UseGuards(AuthGuard)
export class DachiController {
  constructor(
    private readonly dachi: DachiService,
    private readonly links: DachiLinkService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get()
  list(@UserId() userId: string) {
    return this.dachi.list(userId);
  }

  /** D04-S005c: become dachi with the one who invited you */
  @Post('inviter')
  @HttpCode(200)
  befriendInviter(@UserId() userId: string) {
    return this.dachi.befriendInviter(userId);
  }

  /** 〔ダチへ〕 — a work goes to every dachi's 〔推し〕 for 88 hours */
  @Post('deliver')
  @HttpCode(200)
  async deliver(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `deliver:${userId}`, 30, 3600);
    return this.dachi.deliver(userId, parseBody(DeliverBody, body));
  }

  /** 〔推し〕 — what the dachi delivered in the last 88 hours (optionally one kind) */
  @Get('oshi')
  oshi(@UserId() userId: string, @Query('kind') kind?: string) {
    return this.dachi.oshi(userId, kind && (DELIVERY_KINDS as readonly string[]).includes(kind) ? kind : undefined);
  }

  /** 〔🤝 ダチの招待状〕 (M-R175): a link of one's own, once, 48 hours */
  @Post('link')
  @HttpCode(200)
  async createLink(@UserId() userId: string) {
    await rateLimit(this.kv, `dachilink:${userId}`, 10, 3600);
    return this.links.create(userId);
  }

  /** the giver's side: who opened a link and is waiting for 〔ダチになる〕 */
  @Get('link/asks')
  asks(@UserId() userId: string) {
    return this.links.asks(userId);
  }

  @Get('link/:token')
  peekLink(@UserId() userId: string, @Param('token') token: string) {
    return this.links.peek(userId, token);
  }

  /** the one who opened it presses 〔ダチになる〕 */
  @Post('link/:token/open')
  @HttpCode(200)
  async openLink(@UserId() userId: string, @Param('token') token: string) {
    await rateLimit(this.kv, `dachilink-open:${userId}`, 30, 3600);
    return this.links.open(userId, token);
  }

  /** the giver presses 〔ダチになる〕 too */
  @Post('link/:token/confirm')
  @HttpCode(200)
  confirmLink(@UserId() userId: string, @Param('token') token: string) {
    return this.links.confirm(userId, token);
  }

  /** 〔やめる〕 */
  @Delete('link/:token')
  @HttpCode(200)
  async endLink(@UserId() userId: string, @Param('token') token: string) {
    await this.links.end(userId, token);
    return { ok: true };
  }
}
