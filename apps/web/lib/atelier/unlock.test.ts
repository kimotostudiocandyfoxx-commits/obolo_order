import { JOURNEY_DONE, JOURNEY_PAYMENT } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { daysUntil, isOpen, lockLine, openKinds, openLessons } from './unlock';

describe('atelier unlock by journey day (M-R210)', () => {
  it('day 2 opens the look, the dress-up, lookups and pictures; then one kind a day', () => {
    expect(openKinds(1)).toEqual([]);
    expect(openKinds(2)).toEqual(['look', 'bati', 'lookup', 'image']);
    expect(openKinds(3)).toContain('voice');
    expect(openKinds(4)).toContain('art');
    expect(openKinds(5)).toContain('song');
    expect(openKinds(6)).toContain('video');
    expect(openKinds(6)).not.toContain('radio');
    expect(openKinds(7)).toHaveLength(9);
    expect(openKinds(JOURNEY_PAYMENT)).toHaveLength(9);
  });
  it('opens everything after the journey', () => {
    expect(openKinds(JOURNEY_DONE)).toHaveLength(9);
    expect(isOpen('radio', JOURNEY_DONE)).toBe(true);
  });
  it('says how many days are left', () => {
    expect(daysUntil('radio', 3)).toBe(4);
    expect(lockLine('song', 3)).toBe('それは2日後に作れるようになるよ');
  });
  it('teaches each new thing once on the journey', () => {
    expect(openLessons(2)).toEqual(['basics']);
    expect(openLessons(4)).toEqual(['basics', 'voice', 'art']);
    expect(openLessons(JOURNEY_DONE)).toEqual([]);
  });
});
