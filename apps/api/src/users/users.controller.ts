import { Body, Controller, Get, Headers, HttpCode, Inject, NotFoundException, Patch, Post, UseGuards } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { AdvanceJourneyBody, CompleteJourneyDayBody, JumpJourneyBody, UpdateProfileBody } from '@obolo/shared';
import { AppConfig, CONFIG } from '../config';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseBody } from '../common/validate';
import { UsersService } from './users.service';

@Controller('me')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  @Get()
  me(@UserId() userId: string) {
    return this.users.getMe(userId);
  }

  @Patch()
  update(@UserId() userId: string, @Body() body: unknown) {
    return this.users.updateMe(userId, parseBody(UpdateProfileBody, body));
  }

  @Post('journey/complete')
  @HttpCode(200)
  completeDay(@UserId() userId: string, @Body() body: unknown) {
    return this.users.completeJourneyDay(userId, parseBody(CompleteJourneyDayBody, body));
  }

  /** Operator testing from /lab: needs the admin token (404 otherwise). */
  @Post('journey/jump')
  @HttpCode(200)
  jump(@UserId() userId: string, @Body() body: unknown, @Headers('x-admin-token') token?: string) {
    const expected = this.cfg.ADMIN_TOKEN;
    const ok = !!expected && !!token && token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    if (!ok) throw new NotFoundException();
    return this.users.jumpJourney(userId, parseBody(JumpJourneyBody, body).day);
  }

  @Post('journey/advance')
  @HttpCode(200)
  advance(@UserId() userId: string, @Body() body: unknown) {
    return this.users.advanceJourney(userId, parseBody(AdvanceJourneyBody, body ?? {}).skip);
  }
}
