import { Body, Controller, Delete, Get, HttpCode, Inject, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BuddyChatBody, UpdateBuddyProfileBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { BuddyService } from './buddy.service';

@Controller('buddy')
@UseGuards(AuthGuard)
export class BuddyController {
  constructor(
    private readonly buddy: BuddyService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get('profile')
  profile(@UserId() userId: string) {
    return this.buddy.getProfile(userId);
  }

  @Patch('profile')
  updateProfile(@UserId() userId: string, @Body() body: unknown) {
    return this.buddy.updateProfile(userId, parseBody(UpdateBuddyProfileBody, body));
  }

  @Get('messages')
  messages(@UserId() userId: string, @Query('cursor') cursor?: string) {
    return this.buddy.listMessages(userId, cursor);
  }

  @Get('quota')
  quota(@UserId() userId: string) {
    return this.buddy.getQuota(userId);
  }

  @Post('chat')
  @HttpCode(200)
  async chat(@UserId() userId: string, @Body() body: unknown) {
    const { text, locale } = parseBody(BuddyChatBody, body);
    await rateLimit(this.kv, `buddy:${userId}`, 12, 60);
    return this.buddy.chat(userId, text, locale);
  }

  @Delete('memory')
  @HttpCode(204)
  async forget(@UserId() userId: string) {
    await this.buddy.forget(userId);
  }
}
