import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { StoryFirstBookBody, StoryFirstGameBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { StoryFirstService } from './story-first.service';

/**
 * Client 2026-11-28: the first journey's own book (day 8) and game (day 9) made real, free and once (StoryFirstService).
 * The story flies them afterwards with the Moon's calls (POST /moon/books/:id/fly, /moon/games/:id/fly).
 */
@Controller('moon/story-first')
@UseGuards(AuthGuard)
export class StoryFirstController {
  constructor(
    private readonly first: StoryFirstService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('book')
  @HttpCode(200)
  async book(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `story-first:${userId}`, 10, 600);
    return this.first.book(userId, parseBody(StoryFirstBookBody, body));
  }

  @Post('game')
  @HttpCode(200)
  async game(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `story-first:${userId}`, 10, 600);
    return this.first.game(userId, parseBody(StoryFirstGameBody, body));
  }
}
