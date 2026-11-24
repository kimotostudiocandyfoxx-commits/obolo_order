import { describe, expect, it, vi } from 'vitest';
import { BillingService, subscriptionState } from './billing.service';
import { activeMember } from '../users/tester';

// the Stripe client mocked: only the Customer Portal session is used here
const checkoutCreate = vi.hoisted(() => vi.fn(async () => ({ id: 'cs_1', client_secret: 'cs_secret' })));
const portalCreate = vi.hoisted(() => vi.fn(async (p: { customer: string; return_url: string }) => ({ id: 'bps_1', url: `https://billing.stripe.com/p/session/${p.customer}` })));
vi.mock('stripe', () => {
  class StripeError extends Error {
    type = 'StripeInvalidRequestError';
  }
  class Stripe {
    static errors = { StripeError };
    billingPortal = { sessions: { create: portalCreate } };
    checkout = { sessions: { create: checkoutCreate } };
  }
  return { default: Stripe };
});

const fakeDb = (u: Record<string, unknown> | undefined) => ({ write: { select: () => ({ from: () => ({ where: async () => (u ? [u] : []) }) }) } });

const make = (cfg: Record<string, string | undefined>, u?: Record<string, unknown>) => new BillingService(cfg as never, fakeDb(u) as never, {} as never);

describe('POST /billing/portal (P-BILL-4)', () => {
  it('opens the Customer Portal for the stored Stripe customer, back to /settings', async () => {
    portalCreate.mockClear();
    const s = make({ STRIPE_SECRET_KEY: 'sk_test_x', WEB_ORIGIN: 'https://web.example/' }, { id: 'u1', stripeCustomerId: 'cus_1' });
    await expect(s.portal('u1')).resolves.toEqual({ mode: 'stripe', url: 'https://billing.stripe.com/p/session/cus_1' });
    expect(portalCreate).toHaveBeenCalledWith({ customer: 'cus_1', return_url: 'https://web.example/settings', locale: 'ja' });
  });

  it('demo mode (no Stripe key): nothing to cancel', async () => {
    portalCreate.mockClear();
    await expect(make({}, { id: 'u1', stripeCustomerId: null }).portal('u1')).resolves.toEqual({ mode: 'demo', url: null });
    expect(portalCreate).not.toHaveBeenCalled();
  });

  it('a member without a Stripe customer gets 409 NO_SUBSCRIPTION', async () => {
    const s = make({ STRIPE_SECRET_KEY: 'sk_test_x' }, { id: 'u1', stripeCustomerId: null });
    await expect(s.portal('u1')).rejects.toMatchObject({ response: { error: { code: 'NO_SUBSCRIPTION' } } });
  });
});

describe('membership ends with the subscription (P-BILL-4)', () => {
  const base = { id: 'u1', email: 'a@example.com', orderedAt: new Date(), journeyDay: 8, stripeCustomerId: 'cus_1', displayName: 'A' };
  const live = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_x' };

  it('activeMember: canceled / unpaid close it; past_due and demo keep it; testers keep it', () => {
    expect(activeMember({ ...base, subscriptionStatus: 'active' }, {})).toBe(true);
    expect(activeMember({ ...base, subscriptionStatus: 'past_due' }, {})).toBe(true);
    expect(activeMember({ ...base, subscriptionStatus: 'demo' }, {})).toBe(true);
    expect(activeMember({ ...base, subscriptionStatus: 'canceled' }, {})).toBe(false);
    expect(activeMember({ ...base, subscriptionStatus: 'unpaid' }, {})).toBe(false);
    expect(activeMember({ ...base, subscriptionStatus: 'canceled' }, { TESTER_EMAILS: 'a@example.com' })).toBe(true);
    expect(activeMember({ ...base, orderedAt: null, subscriptionStatus: 'active' }, {})).toBe(false);
  });

  it('an ended member can check out again (〔もう一度はじめる〕), an active one cannot', async () => {
    checkoutCreate.mockClear();
    await expect(make(live, { ...base, subscriptionStatus: 'canceled' }).checkout('u1')).resolves.toMatchObject({ mode: 'stripe', sessionId: 'cs_1' });
    expect(checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_1', mode: 'subscription' }));
    await expect(make(live, { ...base, subscriptionStatus: 'active' }).checkout('u1')).rejects.toMatchObject({ response: { error: { code: 'ALREADY_ORDERED' } } });
  });

  it('subscriptionState: a portal cancellation keeps it active until the period end', () => {
    const sub = (over: Record<string, unknown>) => ({ status: 'active', cancel_at_period_end: false, cancel_at: null, items: { data: [{ current_period_end: 1798761600 }] }, ...over }) as never;
    expect(subscriptionState(sub({ cancel_at_period_end: true }))).toEqual({ subscriptionStatus: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: new Date(1798761600 * 1000) });
    expect(subscriptionState(sub({ cancel_at: 1798000000 }))).toMatchObject({ cancelAtPeriodEnd: true, currentPeriodEnd: new Date(1798000000 * 1000) });
    expect(subscriptionState(sub({}))).toMatchObject({ cancelAtPeriodEnd: false });
    expect(subscriptionState(sub({ status: 'canceled', cancel_at_period_end: true }))).toMatchObject({ subscriptionStatus: 'canceled', cancelAtPeriodEnd: false });
  });
});
