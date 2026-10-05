import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { BatiEggBody, BatiNameBody, ChooseLookBody, NeoLookBody, RefineLookBody } from '@obolo/shared';
import type { Request } from 'express';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
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
  ) {}

  @Post('look/candidates')
  @HttpCode(200)
  async candidates(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `look:${userId}`, 4, 60);
    return this.look.candidates(userId, parseBody(NeoLookBody, body), origin(req));
  }

  @Post('look/refine')
  @HttpCode(200)
  async refine(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `look:${userId}`, 6, 60);
    return this.look.refine(userId, parseBody(RefineLookBody, body), origin(req));
  }

  @Post('look')
  @HttpCode(200)
  choose(@UserId() userId: string, @Body() body: unknown) {
    return this.look.choose(userId, parseBody(ChooseLookBody, body).mediaId);
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
