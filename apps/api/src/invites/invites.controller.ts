import { Body, Controller, Get, Headers, HttpCode, Inject, Ip, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { AcceptInviteBody, AdminCreateInviteBody, CreateInviteBody, INVITE_CODE_RE } from '@obolo/shared';
import { timingSafeEqual } from 'node:crypto';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { AppConfig, CONFIG } from '../config';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { InvitesService } from './invites.service';

function checkCode(code: string) {
  if (!INVITE_CODE_RE.test(code)) throw new NotFoundException();
  return code;
}

@Controller()
export class InvitesController {
  constructor(
    private readonly invites: InvitesService,
    @Inject(KV) private readonly kv: KvStore,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  @Get('invites/:code')
  async get(@Param('code') code: string, @Ip() ip: string) {
    await rateLimit(this.kv, `invite-get:${ip}`, 60, 600);
    return this.invites.get(checkCode(code));
  }

  @Post('invites/:code/accept')
  @HttpCode(200)
  async accept(@Param('code') code: string, @Body() body: unknown, @Ip() ip: string) {
    const { displayName } = parseBody(AcceptInviteBody, body);
    await rateLimit(this.kv, `invite-accept:${ip}`, 20, 3600);
    return this.invites.accept(checkCode(code), displayName);
  }

  @Get('invites')
  @UseGuards(AuthGuard)
  mine(@UserId() userId: string) {
    return this.invites.listMine(userId);
  }

  @Post('invites')
  @UseGuards(AuthGuard)
  create(@UserId() userId: string, @Body() body: unknown) {
    return this.invites.createByMember(userId, parseBody(CreateInviteBody, body).email);
  }

  /** Operator endpoint to issue the first invitations. Disabled unless ADMIN_TOKEN is set. */
  @Post('admin/invites')
  async adminCreate(@Headers('x-admin-token') token: string | undefined, @Body() body: unknown, @Ip() ip: string) {
    await rateLimit(this.kv, `admin:${ip}`, 30, 600);
    const expected = this.cfg.ADMIN_TOKEN;
    const ok =
      !!expected && !!token && token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    if (!ok) throw new NotFoundException();
    const { email, inviterName } = parseBody(AdminCreateInviteBody, body);
    return this.invites.createByAdmin(email, inviterName);
  }
}
