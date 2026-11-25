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
    // client 2026-11-25: 本 and ゲーム come with the journey's end
    // story 2026-11-25: グッズ too
    expect(openKinds(JOURNEY_DONE)).toHaveLength(12);
    expect(openKinds(JOURNEY_DONE).slice(-3)).toEqual(['novel', 'game', 'goods']);
    expect(isOpen('goods', 7)).toBe(false);
    expect(isOpen('game', JOURNEY_PAYMENT)).toBe(false);
    expect(daysUntil('novel', 7)).toBe(JOURNEY_DONE - 7);
    expect(isOpen('radio', JOURNEY_DONE)).toBe(true);
  });
  it('says how many days are left', () => {
    expect(daysUntil('radio', 3)).toBe(4);
    expect(lockLine('song', 3)).toBe('曲は、5日目から作れるようになるよ。');
    expect(lockLine('art', 2)).toBe('絵は、4日目から作れるようになるよ。');
    expect(lockLine('novel', 2)).toBe('本は、旅が終わったら作れるようになるよ。');
    expect(lockLine('art', 2, 'kansai')).toBe('絵は、4日目から作れるようになるで。');
  });
  it('teaches each new thing once on the journey', () => {
    expect(openLessons(2)).toEqual(['basics']);
    expect(openLessons(4)).toEqual(['basics', 'voice', 'art']);
    expect(openLessons(JOURNEY_DONE)).toEqual([]);
  });
});
