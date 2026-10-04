import { describe, expect, it } from 'vitest';
import { JOURNEY, JOURNEY_LAST_DAY, journeyMeta } from './journey';

describe('journey', () => {
  it('has days 1..8 in order, ending on Mars', () => {
    expect(JOURNEY.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(journeyMeta(JOURNEY_LAST_DAY)?.planet).toBe('mars');
    expect(journeyMeta(3)?.planet).toBe('moon');
    expect(journeyMeta(4)?.guides).toContain('たこ焼きシスター');
  });
});
