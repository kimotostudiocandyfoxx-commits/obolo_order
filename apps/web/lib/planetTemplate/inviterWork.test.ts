import type { HomeWork } from '@obolo/shared';
import { describe, expect, it, vi } from 'vitest';
import { invitedBy, inviterWorkOn } from './inviterWork';
import { storyHome } from './storyCast';

const work = (id: string, demo = false): HomeWork => ({ id, kind: 'jupiter_post', author: { id: 'u-sakura', name: 'さくら', figure: '/f.png' }, rel: 'oshi', text: '', title: 'さくらの絵', url: '/a.png', flownAt: '2026-11-01T00:00:00Z', ...(demo ? { demo: true } : {}) });
const api = (dachi: { id: string; displayName: string }[], works: HomeWork[]) => ({
  dachi: vi.fn(async () => dachi.map((d) => ({ ...d, pic: null }))),
  planetPerson: vi.fn(async () => ({ planet: 'jupiter' as const, person: null, rel: 'dachi' as const, works })),
});

describe('inside the story the inviter comes with their REAL work of that planet, or not at all (story 2026-11-28)', () => {
  it('nobody invited (or the old stand-in’s name): nobody, nothing asked', async () => {
    expect(invitedBy('…')).toBeNull();
    expect(invitedBy('MIKIE⭐︎DRILL')).toBeNull();
    expect(invitedBy('')).toBeNull();
    const a = api([], []);
    expect(await inviterWorkOn(a, 'jupiter', '…')).toBeNull();
    expect(a.dachi).not.toHaveBeenCalled();
  });
  it('the inviter’s newest real work on the planet, as a ダチ’s', async () => {
    const a = api([{ id: 'u-sakura', displayName: 'さくら' }, { id: 'u-x', displayName: 'ほか' }], [work('w2'), work('w1')]);
    expect(await inviterWorkOn(a, 'jupiter', 'さくら')).toMatchObject({ id: 'w2', rel: 'dachi', title: 'さくらの絵' });
    expect(a.planetPerson).toHaveBeenCalledWith('jupiter', 'u-sakura');
  });
  it('no work on this planet, not a ダチ yet, two ダチ of that name, a sample, or a failing request: none', async () => {
    expect(await inviterWorkOn(api([{ id: 'u-sakura', displayName: 'さくら' }], []), 'jupiter', 'さくら')).toBeNull();
    expect(await inviterWorkOn(api([], [work('w1')]), 'jupiter', 'さくら')).toBeNull();
    expect(await inviterWorkOn(api([{ id: 'a', displayName: 'さくら' }, { id: 'b', displayName: 'さくら' }], [work('w1')]), 'jupiter', 'さくら')).toBeNull();
    expect(await inviterWorkOn(api([{ id: 'u-sakura', displayName: 'さくら' }], [work('s', true)]), 'jupiter', 'さくら')).toBeNull();
    const bad = { dachi: async () => Promise.reject(new Error('x')), planetPerson: async () => Promise.reject(new Error('x')) };
    expect(await inviterWorkOn(bad, 'jupiter', 'さくら')).toBeNull();
  });
  it('{neo}’s place: the inviter first when their work is there; without it the spot is simply left out', () => {
    const withWork = storyHome('jupiter', 'neo', { neo: 'ミナト', inviter: 'さくら', inviterWork: work('w2') });
    expect(withWork.around[0]).toMatchObject({ id: 'w2', rel: 'dachi', author: { name: 'さくら' } });
    expect(withWork.around[1].author.name).toBe('KIMORIN⭐︎');
    const without = storyHome('jupiter', 'neo', { neo: 'ミナト', inviter: 'さくら' });
    expect(without.around[0].author.name).toBe('KIMORIN⭐︎');
    expect(without.around.map((w) => w.author.name)).not.toContain('さくら');
    for (const w of without.around) expect(w.id.startsWith('cast-') || w.id.startsWith('st-')).toBe(true);
  });
});
