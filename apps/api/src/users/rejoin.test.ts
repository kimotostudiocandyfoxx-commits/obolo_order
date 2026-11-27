import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service';

/** P-BILL-4: paying again after the subscription ended keeps the first orderedAt and replaces the subscription */
const first = new Date('2026-11-26T00:00:00Z');
const row = (over: Record<string, unknown>) => ({
  id: 'u1',
  email: 'a@example.com',
  handle: 'h',
  displayName: 'A',
  journeyDay: 11,
  orderedAt: first,
  subscriptionStatus: 'canceled',
  stripeSubscriptionId: 'sub_old',
  cancelAtPeriodEnd: true,
  currentPeriodEnd: new Date('2026-12-26T00:00:00Z'),
  onboardingJson: {},
  batisJson: null,
  createdAt: first,
  ...over,
});

function fake(u: Record<string, unknown>) {
  const sets: Record<string, unknown>[] = [];
  const db = {
    write: {
      select: () => ({ from: () => ({ where: async () => [u] }) }),
      update: () => ({
        set: (v: Record<string, unknown>) => {
          sets.push(v);
          return { where: () => ({ returning: async () => [{ ...u, ...v }] }) };
        },
      }),
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    },
  };
  const ledger = { applyMana: vi.fn(async () => undefined) };
  return { s: new UsersService(db as never, ledger as never), sets, ledger };
}

describe('markOrdered after the subscription ended (P-BILL-4)', () => {
  it('rejoins: new subscription, cancel cleared, first orderedAt kept, the month granted', async () => {
    const { s, sets, ledger } = fake(row({}));
    const me = await s.markOrdered('u1', { subscriptionStatus: 'active', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_new' });
    expect(sets).toEqual([expect.objectContaining({ subscriptionStatus: 'active', stripeSubscriptionId: 'sub_new', cancelAtPeriodEnd: false, currentPeriodEnd: null })]);
    expect(sets[0]).not.toHaveProperty('orderedAt');
    expect(me.orderedAt).toBe(first.toISOString());
    expect(me.subscriptionStatus).toBe('active');
    expect(ledger.applyMana).toHaveBeenCalledOnce();
  });

  it('an active member is left as is (the confirm and the webhook both call it)', async () => {
    const { s, sets } = fake(row({ subscriptionStatus: 'active', cancelAtPeriodEnd: false }));
    await s.markOrdered('u1', { subscriptionStatus: 'active', stripeSubscriptionId: 'sub_new' });
    expect(sets).toEqual([]);
  });
});
