import { describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing.service';

// the Stripe client mocked: only the Customer Portal session is used here
const portalCreate = vi.hoisted(() => vi.fn(async (p: { customer: string; return_url: string }) => ({ id: 'bps_1', url: `https://billing.stripe.com/p/session/${p.customer}` })));
vi.mock('stripe', () => {
  class StripeError extends Error {
    type = 'StripeInvalidRequestError';
  }
  class Stripe {
    static errors = { StripeError };
    billingPortal = { sessions: { create: portalCreate } };
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
