import { describe, expect, it } from 'vitest';
import { MemoryKv } from '../infra/kv';
import { DachiLinkService } from './dachi-link.service';

// the database is only written to (the follows); who people are and blocks are stubbed below
function fakeDb() {
  const follows: { followerId: string; followeeId: string }[] = [];
  const db = { write: { insert: () => ({ values: (v: typeof follows) => ({ onConflictDoNothing: async () => void follows.push(...v) }) }) } };
  return { db, follows };
}

describe('ダチの招待状 (M-R175)', () => {
  const make = () => {
    const { db, follows } = fakeDb();
    const s = new DachiLinkService(db as never, new MemoryKv());
    // who is looked up is the id asked for
    (s as unknown as { person: (id: string) => Promise<unknown> }).person = async (id: string) => ({ id, displayName: id, pic: null });
    (s as unknown as { blocked: () => Promise<boolean> }).blocked = async () => false;
    return { s, follows };
  };

  it('both have to press 〔ダチになる〕; a link sent on cannot be taken by a second person; it works once', async () => {
    const { s, follows } = make();
    const { token } = await s.create('a');
    expect((await s.peek('b', token)).state).toBe('open');
    expect((await s.open('b', token)).state).toBe('waiting');
    // someone else it was forwarded to
    expect((await s.open('c', token)).state).toBe('gone');
    expect(follows).toHaveLength(0);
    expect((await s.asks('a')).map((x) => x.who.id)).toEqual(['b']);
    await s.confirm('a', token);
    expect(follows).toEqual([
      { followerId: 'a', followeeId: 'b' },
      { followerId: 'b', followeeId: 'a' },
    ]);
    await expect(s.peek('b', token)).rejects.toThrow();
  });

  it('one cannot open one’s own link, and only the giver can confirm or end it', async () => {
    const { s } = make();
    const { token } = await s.create('a');
    await expect(s.open('a', token)).rejects.toThrow();
    await s.open('b', token);
    await expect(s.confirm('b', token)).rejects.toThrow();
    await s.end('c', token);
    expect((await s.peek('b', token)).state).toBe('waiting');
    await s.end('a', token);
    await expect(s.peek('b', token)).rejects.toThrow();
  });

  it('a link that is not well formed is never looked up', async () => {
    const { s } = make();
    await expect(s.peek('b', '../x')).rejects.toThrow();
  });
});
