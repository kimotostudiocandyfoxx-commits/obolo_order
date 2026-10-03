import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CreateSaturnPostBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { SaturnService } from './saturn.service';

@Controller('saturn/posts')
@UseGuards(AuthGuard)
export class SaturnController {
  constructor(
    private readonly saturn: SaturnService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get()
  feed(@UserId() userId: string, @Query('cursor') cursor?: string, @Query('fresh') fresh?: string) {
    return this.saturn.feed(userId, cursor, 20, fresh === '1');
  }

  @Post()
  async create(@UserId() userId: string, @Body() body: unknown) {
    const input = parseBody(CreateSaturnPostBody, body);
    await rateLimit(this.kv, `saturn-post:${userId}`, 10, 600);
    return this.saturn.create(userId, input);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.saturn.remove(userId, id);
  }

  @Post(':id/star')
  @HttpCode(200)
  star(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.saturn.setStar(userId, id, true);
  }

  @Delete(':id/star')
  @HttpCode(200)
  unstar(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.saturn.setStar(userId, id, false);
  }
}
