import { describe, expect, it } from 'vitest';
import { JOURNEY, JOURNEY_DONE, JOURNEY_LAST_DAY, JOURNEY_PAYMENT, journeyMeta, nextJourneyDay } from './journey';

describe('journey (eight days, story draft 21)', () => {
  it('days 1..7 visit Earth, the Moon, Saturn, Jupiter, Mercury, Mars, Venus; day 8 is the Sun', () => {
    expect(JOURNEY.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(JOURNEY.map((d) => d.planet)).toEqual(['earth', 'moon', 'saturn', 'jupiter', 'mercury', 'mars', 'venus']);
    expect(JOURNEY_LAST_DAY).toBe(7);
    expect(JOURNEY_PAYMENT).toBe(8);
    expect(JOURNEY_DONE).toBe(9);
    expect(journeyMeta(3)?.guides).toContain('たこ焼きシスター');
  });
  it('no day is skipped', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(nextJourneyDay)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
