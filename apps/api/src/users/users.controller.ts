import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { AdvanceJourneyBody, CompleteJourneyDayBody, UpdateProfileBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseBody } from '../common/validate';
import { UsersService } from './users.service';

@Controller('me')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

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

  @Post('journey/advance')
  @HttpCode(200)
  advance(@UserId() userId: string, @Body() body: unknown) {
    return this.users.advanceJourney(userId, parseBody(AdvanceJourneyBody, body ?? {}).skip);
  }
}
