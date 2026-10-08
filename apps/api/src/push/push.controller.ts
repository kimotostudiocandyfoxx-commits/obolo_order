import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseBody } from '../common/validate';
import { PushService } from './push.service';

const SubscribeBody = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});
const UnsubscribeBody = z.object({ endpoint: z.string().url().max(1000) });

/** Web Push: the public key for the browser, and turning notifications on / off per device. */
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('key')
  async key() {
    return { publicKey: await this.push.publicKey() };
  }

  @Post('subscribe')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async subscribe(@UserId() userId: string, @Body() body: unknown) {
    await this.push.subscribe(userId, parseBody(SubscribeBody, body));
    return { ok: true };
  }

  @Post('unsubscribe')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async unsubscribe(@Body() body: unknown) {
    await this.push.unsubscribe(parseBody(UnsubscribeBody, body).endpoint);
    return { ok: true };
  }
}
