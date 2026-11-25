import { bagBar, GIB } from '@obolo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BagRow } from './BagRow';

const bags = (html: string) => [...html.matchAll(/data-bag="(big|one)" data-fill="(\d+)"/g)].map((m) => [m[1], Number(m[2])]);

describe("R18: Bluena's bar is a row of bags (1袋 = 1GB), no numbers", () => {
  it('a member: 5 bags, filled from the left, a calm label', () => {
    const html = renderToStaticMarkup(<BagRow bar={bagBar(2.1 * GIB, 5 * GIB)} />);
    expect(bags(html)).toEqual([
      ['one', 100],
      ['one', 100],
      ['one', 10],
      ['one', 0],
      ['one', 0],
    ]);
    expect(html).toContain('aria-label="ふくろ 5つのうち、2つぶんくらい"');
    expect(html).toContain('role="img"');
    // nothing to read but the bags: no GB, no digits shown as text
    expect(html.replace(/<[^>]*>/g, '')).toBe('');
    expect(html).not.toMatch(/GB|ブルーナ：/);
  });
  it('a non-member: one bag', () => {
    expect(bags(renderToStaticMarkup(<BagRow bar={bagBar(0.25 * GIB, GIB)} />))).toEqual([['one', 25]]);
  });
  it('a big room is grouped in bags of 10 (15 → 1 big + 5; 105 → 10 big + 5)', () => {
    expect(bags(renderToStaticMarkup(<BagRow bar={bagBar(12 * GIB, 15 * GIB)} />))).toEqual([
      ['big', 100],
      ['one', 100],
      ['one', 100],
      ['one', 0],
      ['one', 0],
      ['one', 0],
    ]);
    const big = bags(renderToStaticMarkup(<BagRow bar={bagBar(4 * GIB, 105 * GIB)} />));
    expect(big).toHaveLength(15);
    expect(big.filter(([k]) => k === 'big')).toHaveLength(10);
    expect(big[0]).toEqual(['big', 40]);
  });
  it('every clip has its own id (several bars on one page)', () => {
    const html = renderToStaticMarkup(
      <>
        <BagRow bar={bagBar(1 * GIB, 5 * GIB)} />
        <BagRow bar={bagBar(1 * GIB, 5 * GIB)} />
      </>,
    );
    const ids = [...html.matchAll(/clipPath id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
