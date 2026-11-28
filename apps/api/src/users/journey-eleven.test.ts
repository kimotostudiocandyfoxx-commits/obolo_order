import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JOURNEY_DONE, JOURNEY_EIGHT_KEY, JOURNEY_PAYMENT, LAP2_DONE, lap2Done } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { UsersService } from './users.service';

/**
 * M-R341 (handoff planets-08): the first journey is eleven days — Pluto, Neptune and Uranus are days 8–10, before
 * becoming Obolo Order; the Eclipse is day 11; 12 = done. Migration 0064 moves the accounts of the eight-day journey.
 */
const row = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'a@example.com',
  handle: 'h',
  displayName: 'ネオ',
  locale: 'ja',
  subscriptionStatus: 'none',
  journeyDay: 8,
  journeyCompletedAt: null as Date | null,
  orderedAt: null as Date | null,
  atelierJson: null,
  batiEggAt: null as Date | null,
  onboardingJson: { birthYear: '2000' } as Record<string, string>,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date(),
  deletedAt: null,
  ...over,
});

function users(u: ReturnType<typeof row>) {
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
  return { s: new UsersService(db as never, {} as never), state };
}

describe('the eleven-day journey on the server (M-R341)', () => {
  it('days 8, 9 and 10 are ordinary journey days: finished, then the next after the wait; day 11 is the Sun', async () => {
    const { s, state } = users(row({ journeyDay: 8 }));
    const done = await s.completeJourneyDay('u1', { day: 8, answers: { f_m_pluto_done: 'true' } });
    expect(done.journeyDay).toBe(8);
    expect(done.journeyCompletedAt).toBeTruthy();
    expect(done.story?.['d8.f_m_pluto_done']).toBe('true');
    // no day after the journey yet (the 2nd egg's morning counts from the Sun day, not from Pluto)
    expect(state.u.batiEggAt).toBeNull();
    // without a skip the 24 hours are waited (the skip rule: journey-wait-skip.test.ts)
    await expect(s.advanceJourney('u1', false)).rejects.toMatchObject({ response: { error: { code: 'NOT_YET' } } });
    state.u = { ...state.u, journeyCompletedAt: new Date(Date.now() - 25 * 3_600_000) };
    expect((await s.advanceJourney('u1', false)).journeyDay).toBe(9);
    state.u = { ...state.u, journeyDay: 10, journeyCompletedAt: new Date(Date.now() - 25 * 3_600_000) };
    expect((await s.advanceJourney('u1', false)).journeyDay).toBe(JOURNEY_PAYMENT);
    const sun = await s.completeJourneyDay('u1', { day: JOURNEY_PAYMENT });
    expect(sun.journeyCompletedAt).toBeTruthy();
    expect(state.u.batiEggAt).toBeInstanceOf(Date);
    state.u = { ...state.u, journeyCompletedAt: new Date(Date.now() - 25 * 3_600_000) };
    expect((await s.advanceJourney('u1', false)).journeyDay).toBe(JOURNEY_DONE);
    expect((await s.advanceJourney('u1', false)).journeyDay).toBe(JOURNEY_DONE);
  });

  it('Uranus’s atelier opens with the planet (day 10), an Obolo Order or not; before it only for a member', async () => {
    await expect(users(row({ journeyDay: 9 })).s.getAtelier('u1')).rejects.toMatchObject({ response: { error: { code: 'ORDER_REQUIRED' } } });
    await expect(users(row({ journeyDay: 9 })).s.saveAtelier('u1', { items: [] } as never)).rejects.toMatchObject({ response: { error: { code: 'ORDER_REQUIRED' } } });
    await expect(users(row({ journeyDay: 10 })).s.getAtelier('u1')).resolves.toBeTruthy();
    // a resident whose journey is done, and one whose subscription ended: both in
    await expect(users(row({ journeyDay: JOURNEY_DONE })).s.getAtelier('u1')).resolves.toBeTruthy();
    await expect(users(row({ journeyDay: JOURNEY_DONE, orderedAt: new Date(), subscriptionStatus: 'canceled' })).s.getAtelier('u1')).resolves.toBeTruthy();
    // someone who became Obolo Order early is in as before
    await expect(users(row({ journeyDay: 5, orderedAt: new Date(), subscriptionStatus: 'active' })).s.getAtelier('u1')).resolves.toBeTruthy();
  });

  it('no days after joining for someone who played days 8–10: finishing one changes nothing', async () => {
    const at = new Date();
    const { s, state } = users(row({ journeyDay: JOURNEY_DONE, orderedAt: at, subscriptionStatus: 'active' }));
    const me = await s.completeLap2('u1', { chapter: 0, answers: { x: 'y' } });
    expect(me.story?.['l2.done']).toBeUndefined();
    expect(lap2Done(state.u.onboardingJson)).toBe(LAP2_DONE);
  });

  it('an account of the eight-day journey keeps its three days after joining, in the order it had', async () => {
    const at = new Date();
    const { s, state } = users(row({ journeyDay: JOURNEY_DONE, orderedAt: at, subscriptionStatus: 'active', onboardingJson: { birthYear: '2000', [JOURNEY_EIGHT_KEY]: '1' } }));
    expect(lap2Done(state.u.onboardingJson)).toBe(0);
    const me = await s.completeLap2('u1', { chapter: 0, answers: { f_m_uranus_done: 'true' } });
    expect(me.story?.['l2.done']).toBe('1');
    expect(me.story?.['l2.uranus.f_m_uranus_done']).toBe('true');
    // the next opens a day later
    await expect(s.completeLap2('u1', { chapter: 1 })).rejects.toMatchObject({ response: { error: { code: 'NOT_YET' } } });
  });
});

describe('migration 0064: nobody goes back', () => {
  const sql = readFileSync(join(__dirname, '../../drizzle/0064_journey_eleven_days.sql'), 'utf8');
  /** the migration's CASE, as it is written */
  const moved = (day: number) => {
    const done = /WHEN "journey_day" >= 9 THEN (\d+)/.exec(sql);
    const sun = /WHEN "journey_day" = 8 THEN (\d+)/.exec(sql);
    expect(done && sun).toBeTruthy();
    return day >= 9 ? Number(done![1]) : day === 8 ? Number(sun![1]) : day;
  };
  it('old 9 (done) → 12 (done), old 8 (the Sun day) → 11 (the Sun day), 1–7 as they are', () => {
    expect(moved(9)).toBe(JOURNEY_DONE);
    expect(moved(8)).toBe(JOURNEY_PAYMENT);
    for (let d = 1; d <= 7; d++) expect(moved(d)).toBe(d);
    // never earlier than before, and nobody who was done is put back on a day
    for (let d = 1; d <= 9; d++) expect(moved(d)).toBeGreaterThanOrEqual(d);
    expect(sql).toContain('SET DEFAULT 12');
  });
  it('the accounts that had reached the old day 8 are marked BEFORE the days move (they keep their days after joining)', () => {
    const mark = sql.indexOf(`'{"${JOURNEY_EIGHT_KEY}":"1"}'::jsonb WHERE "journey_day" >= 8`);
    const move = sql.indexOf('UPDATE "users" SET "journey_day" = CASE');
    expect(mark).toBeGreaterThan(0);
    expect(move).toBeGreaterThan(mark);
    const journal = JSON.parse(readFileSync(join(__dirname, '../../drizzle/meta/_journal.json'), 'utf8')) as { entries: { idx: number; tag: string }[] };
    // in the journal (later migrations come after it: 0065 the story-first works and the cast choices)
    expect(journal.entries.find((e) => e.idx === 64)).toMatchObject({ idx: 64, tag: '0064_journey_eleven_days' });
  });
});
