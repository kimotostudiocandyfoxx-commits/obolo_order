import { describe, expect, it } from 'vitest';
import { CLUSTER_GAP_MS, CLUSTER_MAX, clusterPerRow, clusterSpots, floatParams, groupRelics, itemIndexOf, sealOf } from './layout';

describe('relics: float', () => {
  it('is steady per id, gentle, and neighbours are out of phase', () => {
    expect(floatParams('a1')).toEqual(floatParams('a1'));
    for (const id of ['a', 'bb', 'c-3', 'file-xyz', '3f2a']) {
      const f = floatParams(id);
      expect(f.dur).toBeGreaterThanOrEqual(5);
      expect(f.dur).toBeLessThanOrEqual(8.5);
      expect(Math.abs(f.tilt0)).toBeLessThanOrEqual(2);
      expect(Math.abs(f.tilt1)).toBeLessThanOrEqual(2);
      expect(f.delay).toBeLessThanOrEqual(0);
      expect(f.lift).toBeGreaterThanOrEqual(4);
    }
    expect(floatParams('same', 0).delay).not.toBe(floatParams('same', 1).delay);
  });
});

describe('relics: cluster', () => {
  it('one relic sits plain', () => {
    expect(clusterSpots(1)).toEqual([{ scale: 1, dy: 0, dx: 0, rot: 0, z: 1 }]);
  });
  it('several are smaller, staggered, leaning different ways, overlapping', () => {
    const s = clusterSpots(3);
    expect(s).toHaveLength(3);
    expect(s.every((x) => x.scale < 1)).toBe(true);
    expect(s[1].dy).toBeGreaterThan(s[0].dy);
    expect(new Set(s.map((x) => Math.sign(x.rot))).size).toBe(2);
    expect(s[1].dx).toBeLessThan(0);
    expect(clusterSpots(2)[0].scale).toBeGreaterThan(clusterSpots(4)[0].scale);
  });
  it('three to a row on an iPad, two on a phone', () => {
    expect(clusterPerRow(390)).toBe(2);
    expect(clusterPerRow(820)).toBe(3);
    expect(clusterSpots(3, 3)[2].dy).toBe(0);
  });
});

describe('relics: which messages float together', () => {
  const at = (s: number) => s * 1000;
  it('groups runs of relics from the same sender sent close together', () => {
    const g = groupRelics([
      { who: 'me', at: at(0), relicOnly: false },
      { who: 'me', at: at(1), relicOnly: true },
      { who: 'me', at: at(2), relicOnly: true },
      { who: 'me', at: at(3), relicOnly: true },
      { who: 'them', at: at(4), relicOnly: true },
      { who: 'them', at: at(5), relicOnly: false },
      { who: 'them', at: at(6), relicOnly: true },
      { who: 'them', at: at(6) + CLUSTER_GAP_MS + 1, relicOnly: true },
    ]);
    expect(g).toEqual([[0], [1, 2, 3], [4], [5], [6], [7]]);
    expect(itemIndexOf(g)).toEqual([0, 1, 1, 1, 2, 3, 4, 5]);
  });
  it('at most CLUSTER_MAX in one cluster', () => {
    const g = groupRelics(Array.from({ length: CLUSTER_MAX + 2 }, (_, i) => ({ who: 'me', at: i, relicOnly: true })));
    expect(g.map((x) => x.length)).toEqual([CLUSTER_MAX, 2]);
  });
});

describe('relics: wax seals', () => {
  it('names each document type', () => {
    expect(sealOf('menu.pdf').word).toBe('PDF');
    expect(sealOf('plan.DOCX').word).toBe('Word');
    expect(sealOf('a.xlsx').word).toBe('Excel');
    expect(sealOf('deck.pptx').word).toBe('PPT');
    expect(sealOf('list.csv').word).toBe('CSV');
    expect(sealOf('pack.zip').word).toBe('ZIP');
    expect(sealOf('memo.txt').word).toBe('TXT');
    expect(sealOf('noext', 'application/pdf').word).toBe('PDF');
    expect(sealOf('x.abc').word).toBe('ABC');
  });
});
