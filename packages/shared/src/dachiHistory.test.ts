import { describe, expect, it } from 'vitest';
import { historyOrder, historyPage } from './dachiVoice';

describe('R10: the ダチ history — newest first, a page at a time', () => {
  const list = Array.from({ length: 45 }, (_, k) => ({ id: `t${String(k).padStart(2, '0')}`, lastAt: k % 9 === 0 ? null : new Date(Date.UTC(2026, 10, 24) - k * 60_000).toISOString() }));
  it('orders by the latest message (nothing yet last), ties by id', () => {
    const o = historyOrder([
      { id: 'b', lastAt: '2026-11-24T10:00:00.000Z' },
      { id: 'a', lastAt: '2026-11-24T10:00:00.000Z' },
      { id: 'n', lastAt: null },
      { id: 'c', lastAt: '2026-11-24T11:00:00.000Z' },
    ]);
    expect(o.map((x) => x.id)).toEqual(['c', 'a', 'b', 'n']);
  });
  it('pages with a cursor until the end, every row once', () => {
    const o = historyOrder(list);
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const p = historyPage(o, cursor, 20);
      seen.push(...p.items.map((x) => x.id));
      cursor = p.next;
      pages++;
    } while (cursor);
    expect(pages).toBe(3);
    expect(seen).toEqual(o.map((x) => x.id));
    expect(new Set(seen).size).toBe(45);
  });
  it('an unknown cursor gives nothing (not the first page again)', () => {
    expect(historyPage(historyOrder(list), 'nope|x').items).toEqual([]);
  });
});
