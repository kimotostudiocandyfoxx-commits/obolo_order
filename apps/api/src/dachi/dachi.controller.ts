import { Body, Controller, Get, HttpCode, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { DELIVERY_KINDS, DeliverBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { DachiService } from './dachi.service';

@Controller('dachi')
@UseGuards(AuthGuard)
export class DachiController {
  constructor(
    private readonly dachi: DachiService,
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
}
