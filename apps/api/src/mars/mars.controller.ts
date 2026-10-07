import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { MarsBackstageBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { MarsService } from './mars.service';

/** Mars 裏スタジオ: your kept videos (private). */
@Controller('mars/backstage')
@UseGuards(AuthGuard)
export class MarsController {
  constructor(
    private readonly mars: MarsService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get()
  list(@UserId() userId: string) {
    return this.mars.backstage(userId);
  }

  @Post()
  async keep(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `mars-keep:${userId}`, 30, 600);
    return this.mars.keep(userId, parseBody(MarsBackstageBody, body));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.mars.remove(userId, id);
  }
}
