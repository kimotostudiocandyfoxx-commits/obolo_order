import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { TesterJumpBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseBody } from '../common/validate';
import { TesterService } from './tester.service';

const origin = (req: Request) => `${req.protocol}://${req.get('host')}`;

/**
 * The tester entrance (docs/本番の状態.md): login required, and only accounts on the server's allowlist
 * (TESTER_EMAILS / TESTER_ACCOUNT_IDS) — 403 for everyone else. The web's TesterBar calls these.
 */
@Controller('me/tester')
@UseGuards(AuthGuard)
export class TesterController {
  constructor(private readonly tester: TesterService) {}

  /** 〔全部ひらく〕: every Moon atelier kind, {bati}, Bluena, the ダチ */
  @Post('unlock-all')
  @HttpCode(200)
  unlockAll(@UserId() userId: string, @Req() req: Request) {
    return this.tester.unlockAll(userId, origin(req));
  }

  /** 〔マナ +88〕 */
  @Post('mana')
  @HttpCode(200)
  mana(@UserId() userId: string) {
    return this.tester.mana(userId);
  }

  /** 〔N日目〕 / 〔会員N〕: { day: 1..8 | 'm1' | 'm2' | 'm3' } */
  @Post('jump')
  @HttpCode(200)
  async jump(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    // who first (a non-tester gets 403 whatever the body), then the body
    await this.tester.guard(userId);
    return this.tester.jump(userId, parseBody(TesterJumpBody, body).day, origin(req));
  }

  /** 〔次の日へ〕: the next day now */
  @Post('next')
  @HttpCode(200)
  next(@UserId() userId: string, @Req() req: Request) {
    return this.tester.next(userId, origin(req));
  }

  /** 〔最初から〕: back to before day 1 (the account and the login stay) */
  @Post('reset')
  @HttpCode(200)
  reset(@UserId() userId: string) {
    return this.tester.reset(userId);
  }
}
