import { describe, expect, it } from 'vitest';
import { faceTo, stack, swipeTo, versionsOf, type Work } from './work';
import { dayWord, madeDay, proposalFor } from './proposal';

const art = (image: string, extra: Partial<Work> = {}): Work => ({ id: 'w1', kind: 'art', prompt: 'うみ', status: 'ready', image, ...extra });

describe('M-R253 §1: the tries inside one card', () => {
  it('a redo stacks on the same card and is its face', () => {
    const one = stack(undefined, art('a.png'));
    expect(one.versions).toHaveLength(1);
    const two = stack({ ...one, status: 'making' }, { ...art('b.png'), id: 'other', prompt: 'もっと青く' }, { kind: 'point', x: 0.1, y: 0.1 });
    expect(two.id).toBe('w1');
    expect(two.versions!.map((v) => v.image)).toEqual(['a.png', 'b.png']);
    expect(two.active).toBe(1);
    expect(two.image).toBe('b.png');
    expect(two.versions![1].target).toEqual({ kind: 'point', x: 0.1, y: 0.1 });
  });
  it('a swipe goes one try left / right (kept in range); the one looked at is the face', () => {
    expect(swipeTo(0, -1, 3)).toBe(0);
    expect(swipeTo(0, 1, 3)).toBe(1);
    expect(swipeTo(2, 1, 3)).toBe(2);
    const w = stack(stack(undefined, art('a.png')), art('b.png'));
    const back = faceTo(w, 0);
    expect(back.image).toBe('a.png');
    expect(back.active).toBe(0);
    expect(back.versions).toHaveLength(2);
    expect(faceTo(back, 1).image).toBe('b.png');
  });
  it('a work from before M-R253 is its one try', () => {
    expect(versionsOf(art('x.png'))).toHaveLength(1);
    expect(versionsOf({ ...art('x.png'), status: 'making' })).toHaveLength(0);
  });
});

describe('M-R253 §3: the morning proposal', () => {
  const now = new Date('2026-11-22T09:00:00');
  const k = (kind: Work['kind'], at: string, x: Partial<Work> = {}) => ({ work: { id: kind + at, kind, prompt: '', status: 'ready' as const, ...x }, createdAt: at });
  it('day 5 (songs open): the kororin of day 3 as lyrics', () => {
    const p = proposalFor(5, [k('voice', '2026-11-20T10:00:00', { text: 'おはよう' })], now);
    expect(p?.kind).toBe('song');
    expect(p?.line).toBe('3日目のコロリン、歌詞にしてみる？');
  });
  it('day 6: the picture of day 4 and yesterday’s song', () => {
    const p = proposalFor(6, [k('art', '2026-11-20T10:00:00'), k('song', '2026-11-21T10:00:00')], now);
    expect(p?.line).toBe('4日目の絵と、昨日の曲で、映像にしよう');
    expect(p?.materials).toHaveLength(2);
  });
  it('nothing to use, or no kind opening today: no proposal', () => {
    expect(proposalFor(6, [k('art', '2026-11-20T10:00:00')], now)).toBeNull();
    expect(proposalFor(4, [k('voice', '2026-11-21T10:00:00')], now)).toBeNull();
    expect(madeDay('2026-11-22T01:00:00', 5, now)).toBe(5);
    expect(dayWord(4, 5)).toBe('昨日');
  });
});
