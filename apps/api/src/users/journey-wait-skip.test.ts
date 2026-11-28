import { JOURNEY_DONE, JOURNEY_PAYMENT, NO_SKIP_INTO_DAYS } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { UsersService } from './users.service';

/**
 * Client 2026-11-28: the wait after a day can be skipped after every day except into days 4 and 8 (NO_SKIP_INTO_DAYS),
 * on the server too. Testers never wait (users/tester.ts), as before.
 */
const row = (journeyDay: number, finishedHoursAgo: number, over: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'a@example.com',
  handle: 'h',
  displayName: 'ネオ',
  locale: 'ja',
  subscriptionStatus: 'none',
  journeyDay,
  journeyCompletedAt: new Date(Date.now() - finishedHoursAgo * 3_600_000) as Date | null,
  orderedAt: null as Date | null,
  atelierJson: null,
  batiEggAt: null as Date | null,
  onboardingJson: { birthYear: '2000' } as Record<string, string>,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date(),
  deletedAt: null,
  ...over,
});

function service(u: ReturnType<typeof row>) {
  const state = { u };
  const db = {
    write: {
      select: () => ({ from: () => ({ where: async () => [state.u] }) }),
      update: () => ({
        set: (v: Record<string, unknown>) => {
          const apply = () => {
            state.u = { ...state.u, ...v } as typeof state.u;
            return [state.u];
          };
          const w = { returning: async () => apply(), then: (r: (x: unknown) => void) => r(apply()) };
          return { where: () => w };
        },
      }),
    },
  };
  return new UsersService(db as never, {} as never);
}

const notYet = { response: { error: { code: 'NOT_YET' } } };

describe('skipping the wait between days (client 2026-11-28)', () => {
  it('a skip right after the day opens the next one, for every day but 3 and 7', async () => {
    expect(NO_SKIP_INTO_DAYS).toEqual([4, 8]);
    for (const day of [1, 2, 4, 5, 6, 8, 9, 10]) expect((await service(row(day, 0.1)).advanceJourney('u1', true)).journeyDay).toBe(day + 1);
    // after the Sun day too (the journey is then done)
    expect((await service(row(JOURNEY_PAYMENT, 0.1)).advanceJourney('u1', true)).journeyDay).toBe(JOURNEY_DONE);
  });

  it('into day 4 and day 8 the 24 hours are waited out, skip or not', async () => {
    for (const day of [3, 7]) {
      await expect(service(row(day, 0.1)).advanceJourney('u1', true)).rejects.toMatchObject(notYet);
      await expect(service(row(day, 23.5)).advanceJourney('u1', true)).rejects.toMatchObject(notYet);
      await expect(service(row(day, 23.5)).advanceJourney('u1', false)).rejects.toMatchObject(notYet);
      expect((await service(row(day, 24.1)).advanceJourney('u1', false)).journeyDay).toBe(day + 1);
      expect((await service(row(day, 24.1)).advanceJourney('u1', true)).journeyDay).toBe(day + 1);
    }
  });

  it('without a skip every wait is 24 hours', async () => {
    for (const day of [1, 2, 5, 9]) await expect(service(row(day, 1)).advanceJourney('u1', false)).rejects.toMatchObject(notYet);
  });

  it('nobody is moved back: someone already past day 4 or 8 goes on, a day not finished yet does not move', async () => {
    expect((await service(row(9, 0.1)).advanceJourney('u1', true)).journeyDay).toBe(10);
    expect((await service(row(4, 0, { journeyCompletedAt: null })).advanceJourney('u1', true)).journeyDay).toBe(4);
    expect((await service(row(JOURNEY_DONE, 0.1)).advanceJourney('u1', true)).journeyDay).toBe(JOURNEY_DONE);
  });
});
