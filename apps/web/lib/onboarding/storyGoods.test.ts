import { describe, expect, it, vi } from 'vitest';
import { publishStoryGoods, rootOfArt, STORY_SHAPE_KIND, storyGoodsNote, type StoryGoodsApi } from './storyGoods';

const roots = [
  { id: 'r2', kind: 'photo' as const, url: 'https://m/a2.png?v=1', posterUrl: null, createdAt: '2026-11-20T00:00:00Z' },
  { id: 'r1', kind: 'photo' as const, url: 'https://m/a1.png', posterUrl: null, createdAt: '2026-11-19T00:00:00Z' },
  { id: 'rv', kind: 'video' as const, url: 'https://m/v.mp4', posterUrl: null, createdAt: '2026-11-18T00:00:00Z' },
];
const api = (over: Partial<StoryGoodsApi> = {}) => {
  const a = {
    jupiterRoots: vi.fn(async () => roots),
    makeGoods: vi.fn(async () => ({ id: 'g1' }) as never),
    flyGoods: vi.fn(async (id: string) => ({ id, flownAt: '2026-11-28T00:00:00Z' })),
    ...over,
  };
  return a as typeof a & StoryGoodsApi;
};

describe('day 10: the goods made in the story become a real item in the member’s shop on Uranus', () => {
  it('the six shapes of the story are the six real kinds', () => {
    expect(STORY_SHAPE_KIND).toEqual({ tshirt: 'Tシャツ', mug: 'マグカップ', acrylic: 'アクスタ', sticker: 'ステッカー', badge: '缶バッジ', tote: 'トート' });
  });
  it('the art chosen is used only when it is one of the member’s own arts (the same picture); never another in its place', () => {
    expect(rootOfArt(roots, 'https://m/a1.png')).toBe('r1');
    expect(rootOfArt(roots, 'https://m/a2.png')).toBe('r2');
    expect(rootOfArt(roots, 'https://m/other.png')).toBeNull();
    expect(rootOfArt(roots, 'https://m/v.mp4')).toBeNull();
    expect(rootOfArt(roots, null)).toBeNull();
  });
  it('made with the Moon’s own free maker, then flown: one item, in the shop', async () => {
    const a = api();
    expect(await publishStoryGoods(a, 'mug', 'https://m/a1.png')).toEqual({ at: 'shop', id: 'g1' });
    expect(a.makeGoods).toHaveBeenCalledWith({ kind: 'マグカップ', rootId: 'r1' });
    expect(a.flyGoods).toHaveBeenCalledWith('g1', true);
  });
  it('played again: the item made before is only flown again (one work = one item)', async () => {
    const a = api();
    expect(await publishStoryGoods(a, 'mug', 'https://m/a1.png', 'g0')).toEqual({ at: 'shop', id: 'g0' });
    expect(a.makeGoods).not.toHaveBeenCalled();
    expect(a.jupiterRoots).not.toHaveBeenCalled();
    expect(a.flyGoods).toHaveBeenCalledWith('g0', true);
  });
  it('words only, or a picture that is not the member’s art: nothing is made — the shelf stays on the device and the screen says so', async () => {
    const a = api();
    expect(await publishStoryGoods(a, 'tote', null)).toEqual({ at: 'device', why: 'no-art' });
    expect(await publishStoryGoods(a, 'tote', 'https://m/other.png')).toEqual({ at: 'device', why: 'no-art' });
    expect(a.makeGoods).not.toHaveBeenCalled();
    expect(a.flyGoods).not.toHaveBeenCalled();
    expect(storyGoodsNote({ at: 'device', why: 'no-art' })).toContain('この端末の中だけ');
  });
  it('the server refusing does not stop the story', async () => {
    const a = api({ makeGoods: vi.fn(async () => Promise.reject(new Error('limit'))) });
    expect(await publishStoryGoods(a, 'tote', 'https://m/a1.png')).toEqual({ at: 'device', why: 'failed' });
    expect(storyGoodsNote({ at: 'device', why: 'failed' })).toContain('この端末の中だけ');
    expect(storyGoodsNote('preview')).toContain('この端末の中だけ');
    expect(storyGoodsNote({ at: 'shop', id: 'g1' })).toContain('お店に並びました');
  });
});
