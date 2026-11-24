import { describe, expect, it, vi } from 'vitest';
import { BillingService, subscriptionState } from './billing.service';
import { activeMember } from '../users/tester';
import { wallets } from '../db/schema';

// the Stripe client mocked: only the Customer Portal session is used here
const checkoutCreate = vi.hoisted(() => vi.fn(async () => ({ id: 'cs_1', client_secret: 'cs_secret' })));
const sessionRetrieve = vi.hoisted(() => vi.fn());
const constructEvent = vi.hoisted(() => vi.fn());
const customerCreate = vi.hoisted(() => vi.fn(async () => ({ id: 'cus_new' })));
const portalCreate = vi.hoisted(() => vi.fn(async (p: { customer: string; return_url: string }) => ({ id: 'bps_1', url: `https://billing.stripe.com/p/session/${p.customer}` })));
vi.mock('stripe', () => {
  class StripeError extends Error {
    type = 'StripeInvalidRequestError';
  }
  class Stripe {
    static errors = { StripeError };
    billingPortal = { sessions: { create: portalCreate } };
    checkout = { sessions: { create: checkoutCreate, retrieve: sessionRetrieve } };
    customers = { create: customerCreate };
    webhooks = { constructEvent };
  }
  return { default: Stripe };
});

const fakeDb = (u: Record<string, unknown> | undefined) => ({ write: { select: () => ({ from: () => ({ where: async () => (u ? [u] : []) }) }) } });

const make = (cfg: Record<string, string | undefined>, u?: Record<string, unknown>) => new BillingService(cfg as never, fakeDb(u) as never, {} as never, {} as never);

/**
 * P-BILL-1: a fake ledger with the real rule that matters here — one row per idempotency key (mana_ledger_idem_uq) —
 * and a fake db whose transaction hands the ledger a tx that can read the wallet.
 */
function gemWorld(cfg: Record<string, string | undefined>, u: Record<string, unknown> | undefined) {
  const wallet = { manaBalance: 5 };
  const rows = new Map<string, { delta: number; balanceAfter: number }>();
  const ledger = {
    applyMana: vi.fn(async (_tx: unknown, e: { delta: number; idempotencyKey: string; reason: string }) => {
      const dupe = rows.get(e.idempotencyKey);
      if (dupe) return dupe;
      wallet.manaBalance += e.delta;
      const row = { delta: e.delta, balanceAfter: wallet.manaBalance };
      rows.set(e.idempotencyKey, row);
      return row;
    }),
  };
  const pick = (t: unknown) => (t === wallets ? [wallet] : u ? [u] : []);
  const sel = () => ({ from: (t: unknown) => ({ where: async () => pick(t) }) });
  const updates: unknown[] = [];
  const db = {
    write: {
      select: sel,
      update: () => ({ set: (v: unknown) => ({ where: async () => void updates.push(v) }) }),
      transaction: async (fn: (tx: unknown) => unknown) => fn({ select: sel }),
    },
  };
  const markOrdered = vi.fn();
  const s = new BillingService(cfg as never, db as never, { markOrdered } as never, ledger as never);
  return { s, wallet, rows, ledger, updates, markOrdered };
}

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

describe('mana gems (P-BILL-1)', () => {
  const live = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' };
  const member = { id: 'u1', email: 'a@example.com', displayName: 'A', orderedAt: new Date(), journeyDay: 9, subscriptionStatus: 'active', stripeCustomerId: 'cus_1' };
  const paidSession = (over: Record<string, unknown> = {}) => ({
    id: 'cs_gem_1',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    client_reference_id: 'u1',
    metadata: { userId: 'u1', gemId: 'gem888', mana: '888' },
    ...over,
  });
  const event = (type: string, obj: unknown) => ({ type, data: { object: obj } });

  it('checkout: a one-time JPY payment in the embedded UI, the price from MANA_GEMS, metadata { userId, gemId }', async () => {
    checkoutCreate.mockClear();
    const { s } = gemWorld(live, member);
    await expect(s.gemCheckout('u1', 'gem8888')).resolves.toEqual({ mode: 'stripe', gemId: 'gem8888', publishableKey: 'pk_test_x', clientSecret: 'cs_secret', sessionId: 'cs_1' });
    expect(checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        ui_mode: 'embedded_page',
        redirect_on_completion: 'never',
        mode: 'payment',
        customer: 'cus_1',
        client_reference_id: 'u1',
        metadata: { userId: 'u1', gemId: 'gem8888', mana: '8888' },
        line_items: [expect.objectContaining({ quantity: 1, price_data: expect.objectContaining({ currency: 'jpy', unit_amount: 8888 }) })],
      }),
    );
  });

  it('checkout: creates and stores the Stripe customer when the member has none', async () => {
    customerCreate.mockClear();
    checkoutCreate.mockClear();
    const { s, updates } = gemWorld(live, { ...member, stripeCustomerId: null });
    await s.gemCheckout('u1', 'gem88');
    expect(customerCreate).toHaveBeenCalledWith({ email: 'a@example.com', name: 'A', metadata: { userId: 'u1' } });
    expect(updates).toContainEqual({ stripeCustomerId: 'cus_new' });
    expect(checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_new' }));
  });

  it('only active members: a resident, an ended member and an unknown gem are refused', async () => {
    await expect(gemWorld(live, { ...member, orderedAt: null }).s.gemCheckout('u1', 'gem88')).rejects.toMatchObject({ response: { error: { code: 'MEMBERS_ONLY' } } });
    await expect(gemWorld(live, { ...member, subscriptionStatus: 'canceled' }).s.gemCheckout('u1', 'gem88')).rejects.toMatchObject({ response: { error: { code: 'MEMBERS_ONLY' } } });
    await expect(gemWorld(live, member).s.gemCheckout('u1', 'gem1')).rejects.toMatchObject({ response: { error: { code: 'UNKNOWN_GEM' } } });
  });

  it('demo mode (no Stripe key): the mana is added at once, without Stripe, and the response says so', async () => {
    checkoutCreate.mockClear();
    const { s, wallet } = gemWorld({}, member);
    const r = await s.gemCheckout('u1', 'gem88');
    expect(r).toMatchObject({ mode: 'demo', gemId: 'gem88', credit: { gemId: 'gem88', manaAdded: 88, manaBalance: 93 } });
    expect(r.mode === 'demo' && r.note).toContain('デモ');
    expect(wallet.manaBalance).toBe(93);
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it('webhook: checkout.session.completed (payment, paid) adds the mana once — a repeated event does not add it again', async () => {
    const { s, wallet, ledger, markOrdered } = gemWorld(live, member);
    constructEvent.mockReturnValue(event('checkout.session.completed', paidSession()));
    await s.webhook(Buffer.from('{}'), 'sig');
    await s.webhook(Buffer.from('{}'), 'sig');
    expect(wallet.manaBalance).toBe(5 + 888);
    expect(ledger.applyMana).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'u1', delta: 888, reason: 'purchase', idempotencyKey: 'gem:cs_gem_1' }));
    expect(markOrdered).not.toHaveBeenCalled();
  });

  it('webhook then confirm (either order) credit the same session once', async () => {
    const { s, wallet } = gemWorld(live, member);
    constructEvent.mockReturnValue(event('checkout.session.completed', paidSession()));
    await s.webhook(Buffer.from('{}'), 'sig');
    sessionRetrieve.mockResolvedValueOnce(paidSession());
    await expect(s.confirmGem('u1', 'cs_gem_1')).resolves.toEqual({ gemId: 'gem888', manaAdded: 888, manaBalance: 893 });
    expect(wallet.manaBalance).toBe(893);
  });

  it('webhook: an unpaid (pending) gem session adds nothing until async_payment_succeeded', async () => {
    const { s, wallet } = gemWorld(live, member);
    constructEvent.mockReturnValue(event('checkout.session.completed', paidSession({ payment_status: 'unpaid' })));
    await s.webhook(Buffer.from('{}'), 'sig');
    expect(wallet.manaBalance).toBe(5);
    constructEvent.mockReturnValue(event('checkout.session.async_payment_succeeded', paidSession()));
    await s.webhook(Buffer.from('{}'), 'sig');
    expect(wallet.manaBalance).toBe(893);
  });

  it('confirm: NOT_PAID while pending, FORBIDDEN for another user; the order confirm refuses a gem session', async () => {
    const { s } = gemWorld(live, member);
    sessionRetrieve.mockResolvedValueOnce(paidSession({ payment_status: 'unpaid' }));
    await expect(s.confirmGem('u1', 'cs_gem_1')).rejects.toMatchObject({ response: { error: { code: 'NOT_PAID' } } });
    sessionRetrieve.mockResolvedValueOnce(paidSession({ client_reference_id: 'u2' }));
    await expect(s.confirmGem('u1', 'cs_gem_1')).rejects.toMatchObject({ response: { error: { code: 'FORBIDDEN' } } });
    sessionRetrieve.mockResolvedValueOnce(paidSession());
    await expect(s.confirm('u1', 'cs_gem_1')).rejects.toMatchObject({ response: { error: { code: 'NOT_AN_ORDER' } } });
  });

  it('the mana kept on the session wins over a later change of the table', async () => {
    const { s, wallet } = gemWorld(live, member);
    constructEvent.mockReturnValue(event('checkout.session.completed', paidSession({ metadata: { userId: 'u1', gemId: 'gem888', mana: '900' } })));
    await s.webhook(Buffer.from('{}'), 'sig');
    expect(wallet.manaBalance).toBe(905);
  });
});
