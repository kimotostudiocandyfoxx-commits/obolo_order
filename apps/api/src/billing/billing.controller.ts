import { Body, Controller, Headers, HttpCode, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ConfirmOrderBody } from '@obolo/shared';
import type { Request } from 'express';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { BillingService } from './billing.service';

/** Day 9 Eclipse payment (see BillingService). */
@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('me/order/checkout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async checkout(@UserId() userId: string) {
    await rateLimit(this.kv, `order:${userId}`, 10, 600);
    return this.billing.checkout(userId);
  }

  @Post('me/order/confirm')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  confirm(@UserId() userId: string, @Body() body: unknown) {
    return this.billing.confirm(userId, parseBody(ConfirmOrderBody, body).sessionId);
  }

  /** Demo mode only (no Stripe key): "OK" records the order without a charge. */
  @Post('me/order')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  demo(@UserId() userId: string) {
    return this.billing.demoOrder(userId);
  }

  /** P-BILL-4: the Stripe Customer Portal (change the card, cancel) — { mode, url } */
  @Post('billing/portal')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async portal(@UserId() userId: string) {
    await rateLimit(this.kv, `portal:${userId}`, 10, 600);
    return this.billing.portal(userId);
  }

  /** P-BILL-1: buy a mana gem (MANA_GEMS) — Embedded Checkout `mode: 'payment'`; demo mode adds the mana at once */
  @Post('billing/gems/:id/checkout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async gemCheckout(@UserId() userId: string, @Param('id') id: string) {
    await rateLimit(this.kv, `gem:${userId}`, 10, 600);
    return this.billing.gemCheckout(userId, id);
  }

  /** P-BILL-1: after the gem's Embedded Checkout completed — the mana is added (once per session) */
  @Post('billing/gems/confirm')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async gemConfirm(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `gemconfirm:${userId}`, 60, 600);
    return this.billing.confirmGem(userId, parseBody(ConfirmOrderBody, body).sessionId);
  }

  @Post('billing/webhook')
  @HttpCode(200)
  webhook(@Req() req: Request, @Headers('stripe-signature') sig?: string) {
    return this.billing.webhook(Buffer.isBuffer(req.body) ? req.body : Buffer.from(''), sig);
  }
}
