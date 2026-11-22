import { describe, expect, it } from 'vitest';
import { dotOfRow, spiralDots } from './spiral';

const at = (d: number, h = 0) => new Date(2026, 10, d, 12 + h).toISOString();

describe('M-R237: the spiral of works (a time map)', () => {
  it('few works: one dot each, the newest at the outer end', () => {
    const e = [1, 2, 3].map((k) => ({ id: `w${k}`, at: at(20 - k), color: '#f00' }));
    const d = spiralDots(e);
    expect(d.map((x) => x.key)).toEqual(['w1', 'w2', 'w3']);
    expect(d[0].t).toBe(1);
    expect(d[2].t).toBe(0);
  });
  it('many works: at most 30 dots, the older a day to a dot, every row has its dot', () => {
    // 100 works over 10 days (10 a day), newest first
    const e = Array.from({ length: 100 }, (_, i) => ({ id: `w${i}`, at: at(30 - Math.floor(i / 10), -(i % 10) / 2), color: i % 3 ? '#0f0' : '#00f' }));
    const d = spiralDots(e);
    expect(d.length).toBeLessThanOrEqual(30);
    expect(d[0]).toMatchObject({ first: 0, last: 0, count: 1 });
    expect(d[d.length - 1].last).toBe(99);
    const covered = d.reduce((n, x) => n + x.count, 0);
    expect(covered).toBe(100);
    // the oldest dot is one whole day
    expect(d[d.length - 1].count).toBe(10);
    expect(dotOfRow(d, 99)).toBe(d.length - 1);
    // the group's colour is the one it has the most of
    expect(d[d.length - 1].color).toBe('#0f0');
  });
  it('even the days are too many: a few days to a dot', () => {
    const e = Array.from({ length: 90 }, (_, i) => ({ id: `w${i}`, at: new Date(2026, 0, 1 + 90 - i).toISOString(), color: '#fff' }));
    const d = spiralDots(e);
    expect(d.length).toBeLessThanOrEqual(30);
    expect(d.reduce((n, x) => n + x.count, 0)).toBe(90);
  });
});
