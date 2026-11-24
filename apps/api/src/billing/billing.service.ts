import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { findManaGem, JOURNEY_PAYMENT, ORDER_PRICE_JPY, type BillingPortal, type GemCheckout, type GemCredit, type ManaGem, type Me, type OrderCheckout } from '@obolo/shared';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { apiError } from '../common/errors';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { users, wallets } from '../db/schema';
import { activeMember } from '../users/tester';
import { UsersService } from '../users/users.service';
import { LedgerService } from '../wallet/ledger.service';

/**
 * Day 9 "エクリプス" payment: ¥88/month subscription through Stripe Embedded Checkout, shown inside
 * the story so the visitor never leaves it. Without STRIPE_SECRET_KEY it runs in demo mode (no charge).
 * The order is recorded either by /me/order/confirm (right after Checkout, so the story can go on
 * without waiting for a webhook) or by the checkout.session.completed webhook — whichever is first.
 * P-BILL-1: mana gems (MANA_GEMS) are one-time payments (`mode: 'payment'`) in the same Embedded Checkout, for active
 * members only; the mana is added through the ledger once per Checkout Session (idempotency key `gem:<session id>`,
 * unique in mana_ledger), by /billing/gems/confirm or the webhook — whichever is first.
 */
@Injectable()
export class BillingService {
  private readonly log = new Logger('Billing');
  private readonly stripe?: Stripe;

  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly db: Database,
    private readonly users: UsersService,
    private readonly ledger: LedgerService,
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
    // P-BILL-4: a member whose subscription ended (canceled / unpaid) may pay again (〔もう一度はじめる〕)
    if (activeMember(u)) throw apiError(HttpStatus.CONFLICT, 'ALREADY_ORDERED', 'Already an ORDER member');
    // the Sun day, or later as a resident who comes back for the Eclipse (draft 21, D08-S005)
    if (u.journeyDay < JOURNEY_PAYMENT) throw apiError(HttpStatus.CONFLICT, 'NOT_ECLIPSE_DAY', 'Not the Eclipse day yet');

    const customer = await this.customerFor(this.stripe, u);

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

  /** the member's Stripe customer (created and stored the first time; the Eclipse and the gems share it) */
  private async customerFor(stripe: Stripe, u: typeof users.$inferSelect): Promise<string> {
    if (u.stripeCustomerId) return u.stripeCustomerId;
    const c = await stripe.customers.create({ email: u.email, name: u.displayName, metadata: { userId: u.id } });
    await this.db.write.update(users).set({ stripeCustomerId: c.id }).where(eq(users.id, u.id));
    return c.id;
  }

  /**
   * P-BILL-1: a mana gem. Active members only (isActiveMember: paid, the subscription not ended; testers too) —
   * residents are offered the Eclipse instead, and an ended member starts it again first. Demo mode (no Stripe key):
   * the mana is added at once without a charge, like the demo order.
   */
  async gemCheckout(userId: string, gemId: string): Promise<GemCheckout> {
    const gem = findManaGem(gemId);
    if (!gem) throw apiError(HttpStatus.NOT_FOUND, 'UNKNOWN_GEM', 'No such mana gem');
    const u = await this.load(userId);
    if (!activeMember(u)) throw apiError(HttpStatus.FORBIDDEN, 'MEMBERS_ONLY', 'Mana gems are for Obolo Order members');
    if (!this.stripe) {
      const credit = await this.creditGem(userId, `gem:demo:${randomUUID()}`, gem.id, gem.mana, 'demo');
      return { mode: 'demo', gemId: gem.id, credit, note: 'デモモード：請求なしで、マナを加えました' };
    }
    const stripe = this.stripe;
    return this.stripeErrors(() => this.createGemCheckout(stripe, u, gem));
  }

  private async createGemCheckout(stripe: Stripe, u: typeof users.$inferSelect, gem: ManaGem): Promise<GemCheckout> {
    const pk = this.cfg.STRIPE_PUBLISHABLE_KEY;
    if (!pk) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'BILLING_MISCONFIGURED', 'STRIPE_PUBLISHABLE_KEY is not set');
    const customer = await this.customerFor(stripe, u);
    // the mana is fixed when the visitor sees it: kept on the session, so a later change to MANA_GEMS does not alter it
    const metadata = { userId: u.id, gemId: gem.id, mana: String(gem.mana) };
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded_page',
      redirect_on_completion: 'never',
      mode: 'payment',
      customer,
      client_reference_id: u.id,
      metadata,
      payment_intent_data: { metadata },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'jpy',
            unit_amount: gem.priceJpy,
            product_data: { name: `マナジェム（${gem.priceJpy.toLocaleString('ja-JP')}円）`, description: `${gem.mana.toLocaleString('ja-JP')}マナが加わります` },
          },
        },
      ],
      locale: 'ja',
    });
    if (!session.client_secret) throw apiError(HttpStatus.BAD_GATEWAY, 'BILLING_ERROR', 'Checkout has no client secret');
    return { mode: 'stripe', gemId: gem.id, publishableKey: pk, clientSecret: session.client_secret, sessionId: session.id };
  }

  /** P-BILL-1: called by the gem sheet when Embedded Checkout reports completion (NOT_PAID while pending). */
  async confirmGem(userId: string, sessionId: string): Promise<GemCredit> {
    if (!this.stripe) throw apiError(HttpStatus.CONFLICT, 'BILLING_DEMO', 'Billing is in demo mode');
    const stripe = this.stripe;
    const session = await this.stripeErrors(() => stripe.checkout.sessions.retrieve(sessionId));
    if (session.client_reference_id !== userId) throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Not your checkout');
    if (session.mode !== 'payment' || !session.metadata?.gemId) throw apiError(HttpStatus.CONFLICT, 'NOT_A_GEM', 'Not a mana gem checkout');
    if (!gemPaid(session)) throw apiError(HttpStatus.CONFLICT, 'NOT_PAID', 'The payment is not complete yet');
    const credit = await this.creditGemSession(session);
    if (!credit) throw apiError(HttpStatus.CONFLICT, 'NOT_A_GEM', 'Not a mana gem checkout');
    return credit;
  }

  /** a paid gem session → its mana, once (the ledger returns the first row for a repeated key) */
  private async creditGemSession(s: Stripe.Checkout.Session): Promise<GemCredit | null> {
    const userId = s.client_reference_id ?? s.metadata?.userId;
    const gemId = s.metadata?.gemId;
    if (!userId || !gemId) return null;
    const kept = Number(s.metadata?.mana);
    const mana = Number.isInteger(kept) && kept > 0 ? kept : findManaGem(gemId)?.mana;
    if (!mana) return null;
    return this.creditGem(userId, `gem:${s.id}`, gemId, mana, s.id);
  }

  private async creditGem(userId: string, idempotencyKey: string, gemId: string, mana: number, refId: string): Promise<GemCredit> {
    return this.db.write.transaction(async (tx) => {
      const row = await this.ledger.applyMana(tx, { userId, delta: mana, reason: 'purchase', idempotencyKey, refType: 'mana_gem', refId });
      const [w] = await tx.select({ manaBalance: wallets.manaBalance }).from(wallets).where(eq(wallets.userId, userId));
      this.log.log(`gem ${userId} ${gemId} +${row.delta} ${refId}`);
      return { gemId, manaAdded: row.delta, manaBalance: w?.manaBalance ?? row.balanceAfter };
    });
  }

  /** Called by the page when Embedded Checkout reports completion. */
  async confirm(userId: string, sessionId: string): Promise<Me> {
    if (!this.stripe) throw apiError(HttpStatus.CONFLICT, 'BILLING_DEMO', 'Billing is in demo mode');
    const stripe = this.stripe;
    const session = await this.stripeErrors(() => stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] }));
    if (session.client_reference_id !== userId) throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Not your checkout');
    // a gem's one-time payment never makes an Obolo Order (P-BILL-1)
    if (session.mode !== 'subscription') throw apiError(HttpStatus.CONFLICT, 'NOT_AN_ORDER', 'Not an Eclipse checkout');
    if (!this.paid(session)) throw apiError(HttpStatus.CONFLICT, 'NOT_PAID', 'The payment is not complete yet');
    return this.record(userId, session);
  }

  /**
   * P-BILL-4: 〔支払い方法の変更・解約〕 — a Stripe Customer Portal session for the member's Stripe customer (stored by
   * the checkout, see createCheckout); back to WEB_ORIGIN/settings. The portal itself must be switched on once in the
   * Stripe dashboard (Settings → Billing → Customer portal). Demo mode (no key): nothing to cancel.
   */
  async portal(userId: string): Promise<BillingPortal> {
    if (!this.stripe) return { mode: 'demo', url: null };
    const stripe = this.stripe;
    const u = await this.load(userId);
    if (!u.stripeCustomerId) throw apiError(HttpStatus.CONFLICT, 'NO_SUBSCRIPTION', 'No Stripe customer for this member');
    const origin = (this.cfg.WEB_ORIGIN ?? 'https://oboloorder-web.vercel.app').replace(/\/$/, '');
    const session = await this.stripeErrors(() =>
      stripe.billingPortal.sessions.create({ customer: u.stripeCustomerId!, return_url: `${origin}/settings`, locale: 'ja' }),
    );
    return { mode: 'stripe', url: session.url };
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
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object;
        // P-BILL-1: a mana gem (one-time payment) adds mana; only the Eclipse (subscription) records an order
        if (s.mode === 'payment') {
          if (gemPaid(s)) await this.creditGemSession(s);
        } else if (s.mode === 'subscription' && event.type === 'checkout.session.completed' && s.client_reference_id && this.paid(s)) {
          await this.record(s.client_reference_id, s);
        }
        break;
      }
      case 'invoice.paid': {
        // each paid month refills the gem (the first month is granted with the order itself; same key, so once)
        const inv = event.data.object;
        const customer = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
        if (!customer) break;
        const [u] = await this.db.write.select({ id: users.id }).from(users).where(eq(users.stripeCustomerId, customer));
        if (u) await this.users.grantMonth(u.id, new Date(inv.created * 1000));
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await this.db.write
          .update(users)
          .set({ ...subscriptionState(sub), updatedAt: new Date() })
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

/** P-BILL-1: a gem's one-time payment is done and the money taken (not an async method still pending) */
export function gemPaid(s: Stripe.Checkout.Session): boolean {
  return s.mode === 'payment' && s.status === 'complete' && s.payment_status === 'paid';
}

/**
 * P-BILL-4: what the settings show from a subscription event — its status, whether it was cancelled to end with the
 * paid month (the portal sets `cancel_at_period_end`; newer portals may set `cancel_at` instead), and when that month
 * ends (`cancel_at`, else the item's `current_period_end`: since API 2025-03-31 the period lives on the items).
 */
export function subscriptionState(sub: Stripe.Subscription): { subscriptionStatus: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: Date | null } {
  const ended = sub.status === 'canceled';
  const end = sub.cancel_at ?? sub.items?.data?.[0]?.current_period_end ?? null;
  return {
    subscriptionStatus: sub.status,
    cancelAtPeriodEnd: !ended && (sub.cancel_at_period_end || !!sub.cancel_at),
    currentPeriodEnd: end ? new Date(end * 1000) : null,
  };
}
