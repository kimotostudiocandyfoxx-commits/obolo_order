import { describe, expect, it, vi } from 'vitest';
import { TesterJumpBody } from '@obolo/shared';
import { MemoryKv } from '../infra/kv';
import { buddyMessages, moonWorks, users } from '../db/schema';
import { isTester } from './tester';
import { TesterController } from './tester.controller';
import { TesterService } from './tester.service';

vi.hoisted(() => {
  process.env.TESTER_EMAILS = ' Tester@Example.com ; other@example.com';
  process.env.TESTER_ACCOUNT_IDS = 'id-by-account';
});

type Row = typeof users.$inferSelect;

const row = (over: Partial<Row> = {}): Row =>
  ({
    id: 'u1',
    email: 'tester@example.com',
    handle: 'h',
    displayName: 'テスター',
    bio: '',
    country: 'JP',
    locale: 'ja',
    subscriptionStatus: 'demo',
    journeyDay: 6,
    journeyCompletedAt: new Date(),
    invitedByName: null,
    invitedByMessage: null,
    neoForm: 'a',
    avatarUrl: 'https://cdn/x.png',
    lookJson: null,
    puniPicUrl: null,
    butterflyUrl: null,
    jupiterBranches: null,
    atelierJson: null,
    batiFood: 'ラーメン',
    batiName: 'ラー',
    batiImageUrl: 'https://cdn/b.png',
    batisJson: null,
    batiId: null,
    batiEggAt: null,
    orderedAt: null,
    stripeSubscriptionId: null,
    voiceSelfId: 'v',
    voiceBatiId: 'vb',
    voiceBatiUrl: null,
    voiceBatiState: 'ready',
    voiceKororinId: null,
    voiceKororinUrl: null,
    voiceSelfUrl: null,
    consentVersion: null,
    consentAt: null,
    guardianConsentVersion: null,
    guardianConsentAt: null,
    onboardingJson: { birthYear: '1990', 'd1.x': 'y', 'd3.kororins': 'a', 'look.standee': 'u' },
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date(),
    ...over,
  }) as Row;

/** a database with one user; records which tables were wiped */
function fakeDb(u: Row) {
  const state = { u, wiped: [] as string[] };
  const name = (t: unknown) => (t === users ? 'users' : t === moonWorks ? 'moon_works' : t === buddyMessages ? 'buddy_messages' : 'other');
  const q = {
    select: () => ({ from: () => ({ where: async () => [state.u] }) }),
    delete: (t: unknown) => ({ where: async () => void state.wiped.push(`delete ${name(t)}`) }),
    update: (t: unknown) => ({
      set: (v: Partial<Row>) => {
        const apply = () => {
          if (t === users) state.u = { ...state.u, ...v };
          else state.wiped.push(`update ${name(t)}`);
          return [state.u];
        };
        const w = { returning: async () => apply(), then: (r: (x: unknown) => void) => r(apply()) };
        return { where: () => w };
      },
    }),
    insert: () => ({ values: () => ({ onConflictDoUpdate: async () => undefined, onConflictDoNothing: async () => undefined }) }),
  };
  const db = { write: { ...q, transaction: async <T>(fn: (tx: typeof q) => Promise<T>) => fn(q) } };
  return { db, state };
}

const make = (u: Row) => {
  const { db, state } = fakeDb(u);
  const queue = { enqueue: vi.fn(async () => undefined) };
  const s = new TesterService(db as never, {} as never, { markDachi: async () => undefined } as never, new MemoryKv(), queue as never);
  return { s, state, queue };
};

describe('the tester allowlist', () => {
  it('reads emails in any case, separated by commas / semicolons / spaces, and account ids', () => {
    const cfg = { TESTER_EMAILS: 'A@x.com, b@Y.jp;c@z.com', TESTER_ACCOUNT_IDS: 'ID-9' };
    expect(isTester({ id: '1', email: 'a@X.COM' }, cfg)).toBe(true);
    expect(isTester({ id: '1', email: 'B@y.jp' }, cfg)).toBe(true);
    expect(isTester({ id: '1', email: 'c@z.com' }, cfg)).toBe(true);
    expect(isTester({ id: 'id-9', email: 'nobody@x.com' }, cfg)).toBe(true);
    expect(isTester({ id: '1', email: 'nobody@x.com' }, cfg)).toBe(false);
  });

  it('an empty list names nobody', () => {
    expect(isTester({ id: '', email: '' }, { TESTER_EMAILS: '', TESTER_ACCOUNT_IDS: '' })).toBe(false);
    expect(isTester({ id: 'u', email: 'a@x.com' }, {})).toBe(false);
  });

  it('reads the server environment by default', () => {
    expect(isTester({ id: 'u', email: 'TESTER@example.com' })).toBe(true);
    expect(isTester({ id: 'id-by-account', email: 'x@y.z' })).toBe(true);
    expect(isTester({ id: 'u', email: 'someone@example.com' })).toBe(false);
  });
});

describe('POST /me/tester/* guards', () => {
  const stranger = row({ email: 'someone@example.com' });

  it('a non-tester gets 403 on every action, and nothing is changed', async () => {
    const { s, state } = make(stranger);
    for (const call of [() => s.unlockAll('u1', 'o'), () => s.jump('u1', 3, 'o'), () => s.next('u1', 'o'), () => s.reset('u1')]) {
      await expect(call()).rejects.toMatchObject({ status: 403 });
    }
    expect(state.u).toBe(stranger);
    expect(state.wiped).toEqual([]);
  });

  it('the controller asks who first: a non-tester gets 403 even with a bad body', async () => {
    const { s } = make(stranger);
    const c = new TesterController(s);
    await expect(c.jump('u1', { day: 99 }, { protocol: 'https', get: () => 'h' } as never)).rejects.toMatchObject({ status: 403 });
  });

  it('jump takes days 1–8 and the members’ days m1–m3 only', async () => {
    for (const day of [1, 8, 'm1', 'm2', 'm3']) expect(TesterJumpBody.safeParse({ day }).success).toBe(true);
    for (const day of [0, 9, 10, -1, 2.5, 'm0', 'm4', '3', null]) expect(TesterJumpBody.safeParse({ day }).success).toBe(false);
    const { s } = make(row());
    const c = new TesterController(s);
    await expect(c.jump('u1', { day: 9 }, { protocol: 'https', get: () => 'h' } as never)).rejects.toMatchObject({ status: 400 });
  });
});

describe('〔最初から〕 (POST /me/tester/reset)', () => {
  it('goes back to before day 1, keeping the account, the birth year and the dachi; twice is the same as once', async () => {
    const { s, state } = make(row({ orderedAt: new Date(), journeyDay: 9, dachiAt: new Date('2026-11-02T00:00:00Z') } as Partial<Row>));
    const once = await s.reset('u1');
    expect(once.journeyDay).toBe(1);
    expect(once.journeyCompletedAt).toBeNull();
    expect(once.orderedAt).toBeNull();
    expect(once.bati).toBeNull();
    expect(once.batis).toEqual([]);
    expect(once.avatarUrl).toBeNull();
    expect(once.story).toEqual({});
    expect(once.birthYear).toBe(1990);
    expect(once.email).toBe('tester@example.com');
    expect(once.displayName).toBe('テスター');
    expect(once.voices.self).toBe(true);
    expect(once.voices.bati).toBe(false);
    expect(once.tester).toBe(true);
    expect((state.u as Row & { dachiAt: Date }).dachiAt).toEqual(new Date('2026-11-02T00:00:00Z'));
    expect(state.wiped).toEqual(expect.arrayContaining(['delete buddy_messages', 'update moon_works']));
    const twice = await s.reset('u1');
    expect(twice).toEqual(once);
  });
});

describe('{bati} for a jump', () => {
  it('a tester with none gets a default one (named, painted in the background); one already there is kept', async () => {
    const { s, state, queue } = make(row({ batiFood: null, batiName: null, batiImageUrl: null }));
    await s.ensureBati('u1', 'https://api');
    expect(state.u.batiFood).toBe('いちご');
    expect(state.u.batiName).toBe('バティ');
    expect(state.u.batisJson).toHaveLength(1);
    expect(queue.enqueue).toHaveBeenCalledWith('bati.paint', { userId: 'u1', origin: 'https://api' }, expect.anything());
    const before = state.u;
    await s.ensureBati('u1', 'https://api');
    expect(state.u).toBe(before);
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
  });
});
