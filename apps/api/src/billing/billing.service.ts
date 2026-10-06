import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { JOURNEY_PAYMENT, ORDER_PRICE_JPY, type Me, type OrderCheckout } from '@obolo/shared';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { apiError } from '../common/errors';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { users } from '../db/schema';
import { UsersService } from '../users/users.service';

/**
 * Day 9 "エクリプス" payment: ¥88/month subscription through Stripe Embedded Checkout, shown inside
 * the story so the visitor never leaves it. Without STRIPE_SECRET_KEY it runs in demo mode (no charge).
 * The order is recorded either by /me/order/confirm (right after Checkout, so the story can go on
 * without waiting for a webhook) or by the checkout.session.completed webhook — whichever is first.
 */
@Injectable()
export class BillingService {
  private readonly log = new Logger('Billing');
  private readonly stripe?: Stripe;

  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly db: Database,
    private readonly users: UsersService,
  ) {
    if (cfg.STRIPE_SECRET_KEY) this.stripe = new Stripe(cfg.STRIPE_SECRET_KEY);
  }

  get live() {
    return !!this.stripe;
  }

  private async load(userId: string) {
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    return u;
  }

  async checkout(userId: string): Promise<OrderCheckout> {
    return this.stripeErrors(() => this.createCheckout(userId));
  }

  /** Stripe's own errors (bad key, unknown price …) come back as 502 with Stripe's message. */
  private async stripeErrors<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Stripe.errors.StripeError) {
        this.log.warn(`stripe: ${e.type} ${e.message}`);
        throw apiError(HttpStatus.BAD_GATEWAY, 'STRIPE_ERROR', e.message);
      }
      throw e;
    }
  }

  private async createCheckout(userId: string): Promise<OrderCheckout> {
    if (!this.stripe) return { mode: 'demo' };
    const pk = this.cfg.STRIPE_PUBLISHABLE_KEY;
    if (!pk) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'BILLING_MISCONFIGURED', 'STRIPE_PUBLISHABLE_KEY is not set');
    const u = await this.load(userId);
    if (u.orderedAt) throw apiError(HttpStatus.CONFLICT, 'ALREADY_ORDERED', 'Already an ORDER member');
    if (u.journeyDay !== JOURNEY_PAYMENT) throw apiError(HttpStatus.CONFLICT, 'NOT_ECLIPSE_DAY', 'Not the Eclipse day yet');

    let customer = u.stripeCustomerId;
    if (!customer) {
      const c = await this.stripe.customers.create({ email: u.email, name: u.displayName, metadata: { userId } });
      customer = c.id;
      await this.db.write.update(users).set({ stripeCustomerId: customer }).where(eq(users.id, userId));
    }

    const price: Stripe.Checkout.SessionCreateParams.LineItem = this.cfg.STRIPE_PRICE_ID
      ? { price: this.cfg.STRIPE_PRICE_ID, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: 'jpy',
            unit_amount: ORDER_PRICE_JPY,
            recurring: { interval: 'month' },
            product_data: { name: 'エクリプス（OBOLO ORDER 月額）' },
          },
        };
    const session = await this.stripe.checkout.sessions.create({
      ui_mode: 'embedded_page',
      redirect_on_completion: 'never',
      mode: 'subscription',
      customer,
      client_reference_id: userId,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
      line_items: [price],
      locale: 'ja',
    });
    if (!session.client_secret) throw apiError(HttpStatus.BAD_GATEWAY, 'BILLING_ERROR', 'Checkout has no client secret');
    return { mode: 'stripe', publishableKey: pk, clientSecret: session.client_secret, sessionId: session.id };
  }

  /** Called by the page when Embedded Checkout reports completion. */
  async confirm(userId: string, sessionId: string): Promise<Me> {
    if (!this.stripe) throw apiError(HttpStatus.CONFLICT, 'BILLING_DEMO', 'Billing is in demo mode');
    const stripe = this.stripe;
    const session = await this.stripeErrors(() => stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] }));
    if (session.client_reference_id !== userId) throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Not your checkout');
    if (!this.paid(session)) throw apiError(HttpStatus.CONFLICT, 'NOT_PAID', 'The payment is not complete yet');
    return this.record(userId, session);
  }

  /** Demo mode only: "OK" without a charge. */
  async demoOrder(userId: string): Promise<Me> {
    if (this.stripe) throw apiError(HttpStatus.CONFLICT, 'BILLING_LIVE', 'Payment is required');
    return this.users.demoOrder(userId);
  }

  async webhook(raw: Buffer, signature: string | undefined): Promise<{ received: true }> {
    const secret = this.cfg.STRIPE_WEBHOOK_SECRET;
    if (!this.stripe || !secret) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Webhook not configured');
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(raw, signature ?? '', secret);
    } catch {
      throw apiError(HttpStatus.BAD_REQUEST, 'BAD_SIGNATURE', 'Invalid signature');
    }
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        if (s.client_reference_id && this.paid(s)) await this.record(s.client_reference_id, s);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await this.db.write
          .update(users)
          .set({ subscriptionStatus: sub.status, updatedAt: new Date() })
          .where(eq(users.stripeSubscriptionId, sub.id));
        break;
      }
    }
    return { received: true };
  }

  private paid(s: Stripe.Checkout.Session) {
    return s.status === 'complete' && s.payment_status !== 'unpaid';
  }

  private async record(userId: string, s: Stripe.Checkout.Session) {
    const sub = s.subscription;
    const subscriptionStatus = sub && typeof sub === 'object' ? sub.status : 'active';
    this.log.log(`order ${userId} ${s.id}`);
    return this.users.markOrdered(userId, {
      subscriptionStatus,
      stripeCustomerId: typeof s.customer === 'string' ? s.customer : (s.customer?.id ?? null),
      stripeSubscriptionId: typeof sub === 'string' ? sub : (sub?.id ?? null),
    });
  }
}
