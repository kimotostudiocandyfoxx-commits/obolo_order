import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UpdateProfileBody } from '@obolo/shared';
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
}
