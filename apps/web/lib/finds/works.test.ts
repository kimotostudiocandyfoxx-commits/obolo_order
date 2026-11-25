import { describe, expect, it } from 'vitest';
import type { FoundWork } from '@obolo/shared';
import { workOf } from './works';

const found = (x: Partial<FoundWork>): FoundWork => ({ kind: 'goods', id: 'g1', planet: 'uranus', title: '夕焼け', image: 'https://x/a.png', createdAt: '2026-11-25T00:00:00.000Z', stars: 0, mark: null, ...x });

describe("Bluena shows a goods item's kind as it was made", () => {
  it('uses the stored kind, whatever the title says', () => {
    expect(workOf(found({ goodsKind: 'マグカップ', title: '夕焼け' })).goods?.kind).toBe('マグカップ');
    expect(workOf(found({ goodsKind: '缶バッジ', title: '夕焼けトート' })).goods?.kind).toBe('缶バッジ');
  });
  it('falls back to the name, then a tote, when an older answer has no kind', () => {
    expect(workOf(found({ title: '夕焼けステッカー' })).goods?.kind).toBe('ステッカー');
    expect(workOf(found({ title: '夕焼け' })).goods?.kind).toBe('トート');
    expect(workOf(found({ goodsKind: 'ふしぎ', title: '夕焼け' })).goods?.kind).toBe('トート');
  });
});
