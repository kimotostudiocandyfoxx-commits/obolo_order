import { JOURNEY_DONE, JOURNEY_PAYMENT } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { isOpen, lockLine, omakaseKind, openKinds } from './unlock';

describe('atelier unlock by journey day (M-R208)', () => {
  it('opens one kind a day from day 3', () => {
    expect(openKinds(1)).toEqual([]);
    expect(openKinds(2)).toEqual([]);
    expect(openKinds(3)).toEqual(['voice']);
    expect(openKinds(4)).toEqual(['voice', 'art']);
    expect(openKinds(5)).toEqual(['voice', 'art', 'song']);
    expect(openKinds(6)).toEqual(['voice', 'art', 'song', 'video']);
    expect(openKinds(7)).toEqual(['voice', 'art', 'song', 'video', 'radio']);
    expect(openKinds(JOURNEY_PAYMENT)).toHaveLength(5);
  });
  it('opens everything after the journey', () => {
    for (const k of ['voice', 'art', 'song', 'video', 'radio', 'any', 'goods']) expect(isOpen(k, JOURNEY_DONE)).toBe(true);
  });
  it('locks a kind before its day, with one calm line', () => {
    expect(isOpen('radio', 6)).toBe(false);
    expect(isOpen('voice', 3)).toBe(true);
    expect(lockLine('radio')).toBe('7日目に、作れるようになる');
  });
  it('おまかせ follows what is open', () => {
    expect(isOpen('any', 2)).toBe(false);
    expect(isOpen('any', 3)).toBe(true);
    expect(omakaseKind(2)).toBeNull();
    expect(omakaseKind(3)).toBe('voice');
    expect(omakaseKind(4)).toBe('art');
    expect(omakaseKind(5)).toBe('song');
    expect(omakaseKind(7)).toBe('song');
  });
  it('leaves the later planets (goods / book / game) as they are', () => {
    expect(isOpen('goods', 3)).toBe(true);
  });
});
