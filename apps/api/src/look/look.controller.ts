import { Body, Controller, Headers, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { BatiEggBody, BatiNameBody, ChooseLookBody, ChoosePuniPicBody, NeoLookBody, PuniPicBody, RefineLookBody } from '@obolo/shared';
import type { Request } from 'express';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import { AppConfig, CONFIG } from '../config';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { LookService } from './look.service';

const origin = (req: Request) => `${req.protocol}://${req.get('host')}`;

@Controller('me')
@UseGuards(AuthGuard)
export class LookController {
  constructor(
    private readonly look: LookService,
    @Inject(KV) private readonly kv: KvStore,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  /** The operator's admin token lifts the try limits (for testing the generation). */
  private admin(token?: string) {
    const expected = this.cfg.ADMIN_TOKEN;
    return !!expected && !!token && token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  }

  @Post('look/candidates')
  @HttpCode(200)
  async candidates(@UserId() userId: string, @Body() body: unknown, @Req() req: Request, @Headers('x-admin-token') token?: string) {
    await rateLimit(this.kv, `look:${userId}`, 4, 60);
    return this.look.candidates(userId, parseBody(NeoLookBody, body), origin(req), this.admin(token));
  }

  @Post('look/refine')
  @HttpCode(200)
  async refine(@UserId() userId: string, @Body() body: unknown, @Req() req: Request, @Headers('x-admin-token') token?: string) {
    await rateLimit(this.kv, `look:${userId}`, 6, 60);
    return this.look.refine(userId, parseBody(RefineLookBody, body), origin(req), this.admin(token));
  }

  @Post('look')
  @HttpCode(200)
  choose(@UserId() userId: string, @Body() body: unknown) {
    return this.look.choose(userId, parseBody(ChooseLookBody, body).mediaId);
  }

  /** Saturn picture character: 2 painted candidates (3 tries a day, P-PUNI-4). */
  @Post('puni/pic/candidates')
  @HttpCode(200)
  async puniPic(@UserId() userId: string, @Body() body: unknown, @Req() req: Request, @Headers('x-admin-token') token?: string) {
    await rateLimit(this.kv, `puni-pic:${userId}`, 4, 60);
    return this.look.puniPicCandidates(userId, parseBody(PuniPicBody, body), origin(req), this.admin(token));
  }

  @Post('puni/pic')
  @HttpCode(200)
  choosePuniPic(@UserId() userId: string, @Body() body: unknown) {
    return this.look.choosePuniPic(userId, parseBody(ChoosePuniPicBody, body).mediaId);
  }

  /** Jupiter butterfly: 2 painted candidates (3 tries a day, P-JUP-5). */
  @Post('butterfly/candidates')
  @HttpCode(200)
  async butterfly(@UserId() userId: string, @Body() body: unknown, @Req() req: Request, @Headers('x-admin-token') token?: string) {
    await rateLimit(this.kv, `puni-pic:${userId}`, 4, 60);
    return this.look.puniPicCandidates(userId, parseBody(PuniPicBody, body), origin(req), this.admin(token), 'butterfly');
  }

  @Post('butterfly')
  @HttpCode(200)
  chooseButterfly(@UserId() userId: string, @Body() body: unknown) {
    return this.look.chooseButterfly(userId, parseBody(ChoosePuniPicBody, body).mediaId);
  }

  @Post('bati/egg')
  @HttpCode(200)
  egg(@UserId() userId: string, @Body() body: unknown) {
    return this.look.egg(userId, parseBody(BatiEggBody, body));
  }

  @Post('bati/hatch')
  @HttpCode(200)
  async hatch(@UserId() userId: string, @Req() req: Request) {
    await rateLimit(this.kv, `hatch:${userId}`, 4, 60);
    return this.look.hatch(userId, origin(req));
  }

  @Post('bati/name')
  @HttpCode(200)
  name(@UserId() userId: string, @Body() body: unknown) {
    return this.look.name(userId, parseBody(BatiNameBody, body).name);
  }
}
