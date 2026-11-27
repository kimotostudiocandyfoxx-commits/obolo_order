import { AcceptInviteBody, birthYearOf, ConsentBody, MEDIA_CONSENT_VERSION, UpdateProfileBody, validBirthYear } from '@obolo/shared';
import { describe, expect, it, vi } from 'vitest';
import { InvitesService } from '../invites/invites.service';
import { UsersService } from './users.service';

/** client 2026-11-27: nobody goes on without the year they were born — on the server too */
const code = (e: unknown) => (e as { getResponse?: () => { error?: { code?: string } } }).getResponse?.().error?.code ?? null;
const refused = (e: unknown) => code(e) === 'BIRTH_YEAR_REQUIRED';
const at = new Date('2026-11-27T00:00:00Z');
const row = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'a@example.com',
  handle: 'h',
  displayName: 'A',
  journeyDay: 1,
  journeyCompletedAt: null,
  onboardingJson: {},
  batisJson: null,
  createdAt: at,
  ...over,
});

function users(u: Record<string, unknown>) {
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
    },
  };
  return { s: new UsersService(db as never, {} as never), sets };
}

describe('the birth year is always there (client 2026-11-27)', () => {
  it('a year: 1900 … this year, a whole number', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    expect([1899, 1900, 2014, 2026, 2027, 2014.5, NaN].map((y) => validBirthYear(y, now))).toEqual([false, true, true, true, false, false, false]);
    expect([validBirthYear(null), validBirthYear(undefined), validBirthYear('2010')]).toEqual([false, false, false]);
    expect([birthYearOf({ birthYear: '2010' }), birthYearOf({ birthYear: '' }), birthYearOf({}), birthYearOf(null)]).toEqual([2010, null, null, null]);
    // the bodies refuse a year still to come
    const next = new Date().getFullYear() + 1;
    expect(UpdateProfileBody.safeParse({ birthYear: next }).success).toBe(false);
    expect(ConsentBody.safeParse({ version: 'v', birthYear: next }).success).toBe(false);
    expect(AcceptInviteBody.safeParse({ displayName: 'A', birthYear: next }).success).toBe(false);
    expect(AcceptInviteBody.safeParse({ displayName: 'A', birthYear: 2010 }).success).toBe(true);
  });

  it('no account is made without it: the invitation is not even read', async () => {
    const transaction = vi.fn();
    const s = new InvitesService({} as never, {} as never, { write: { transaction } } as never, {} as never, {} as never, {} as never);
    for (const y of [undefined, null, 0, new Date().getFullYear() + 1]) await expect(s.accept('code', 'A', y)).rejects.toSatisfy(refused);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('the account is made with the year, kept the way PATCH /me keeps it', async () => {
    const made: Record<string, unknown>[] = [];
    const tx = {
      select: (cols?: unknown) => ({
        from: () => ({
          // the invitation (locked), then "is this email a member already" (nobody)
          where: () => (cols ? Promise.resolve([]) : { for: async () => [{ id: 'i1', email: 'a@example.com', status: 'pending', expiresAt: new Date(Date.now() + 86400_000), inviterUserId: null, inviterName: 'M', message: null }] }),
        }),
      }),
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          made.push(v);
          return { returning: async () => [row({ ...v, id: 'u9' })] };
        },
      }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    };
    const db = { write: { transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx) } };
    const s = new InvitesService({ STARTER_GEM_MANA: 0 } as never, {} as never, db as never, {} as never, { createSession: async () => 'tok' } as never, {} as never);
    const r = await s.accept('code', 'A', 2012);
    expect(made[0]).toMatchObject({ displayName: 'A', journeyDay: 1, onboardingJson: { birthYear: '2012' } });
    expect(r.user.birthYear).toBe(2012);
  });

  it('the agreement: refused with no year on the account and none given; kept once when given', async () => {
    const none = users(row());
    await expect(none.s.consent('u1', MEDIA_CONSENT_VERSION, false, { media: false, birthYear: null })).rejects.toSatisfy(refused);
    await expect(none.s.consent('u1', MEDIA_CONSENT_VERSION)).rejects.toSatisfy(refused);
    expect(none.sets).toEqual([]);
    const given = users(row());
    expect((await given.s.consent('u1', MEDIA_CONSENT_VERSION, false, { birthYear: 1990 })).birthYear).toBe(1990);
    // an account that has one keeps it (set once), and agrees without sending it again
    const has = users(row({ onboardingJson: { birthYear: '2015' } }));
    expect((await has.s.consent('u1', MEDIA_CONSENT_VERSION, false, { birthYear: 1990 })).birthYear).toBe(2015);
    expect((await has.s.consent('u1', MEDIA_CONSENT_VERSION)).birthYear).toBe(2015);
  });

  it('an account from before with no year: the journey does not move on (a day finished, the next day, a members’ day)', async () => {
    const day = users(row());
    await expect(day.s.completeJourneyDay('u1', { day: 1 })).rejects.toSatisfy(refused);
    const next = users(row({ journeyCompletedAt: new Date(Date.now() - 3 * 86400_000) }));
    await expect(next.s.advanceJourney('u1', false)).rejects.toSatisfy(refused);
    const member = users(row({ journeyDay: 9, orderedAt: at, subscriptionStatus: 'active' }));
    await expect(member.s.completeLap2('u1', { chapter: 0 })).rejects.toSatisfy(refused);
    expect([day.sets, next.sets, member.sets]).toEqual([[], [], []]);
  });

  it('with the year it moves as before', async () => {
    const y = { onboardingJson: { birthYear: '2014' } };
    const day = users(row(y));
    expect((await day.s.completeJourneyDay('u1', { day: 1 })).journeyCompletedAt).toBeTruthy();
    const next = users(row({ ...y, journeyCompletedAt: new Date(Date.now() - 3 * 86400_000) }));
    expect((await next.s.advanceJourney('u1', false)).journeyDay).toBe(2);
  });
});
