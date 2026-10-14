import { describe, expect, it } from 'vitest';
import { JOURNEY, JOURNEY_DONE, JOURNEY_LAST_DAY, JOURNEY_PAYMENT, journeyMeta, nextJourneyDay } from './journey';

describe('journey (seven days, story 2026-10-14)', () => {
  it('days 1..6 visit Earth, the Moon, Saturn, Jupiter, Mercury, Mars; day 7 is the Eclipse', () => {
    expect(JOURNEY.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(JOURNEY.map((d) => d.planet)).toEqual(['earth', 'moon', 'saturn', 'jupiter', 'mercury', 'mars']);
    expect(JOURNEY_LAST_DAY).toBe(6);
    expect(JOURNEY_PAYMENT).toBe(7);
    expect(JOURNEY_DONE).toBe(8);
    expect(journeyMeta(3)?.guides).toContain('たこ焼きシスター');
    expect(JOURNEY.some((d) => d.planet === 'venus')).toBe(false);
  });
  it('no day is skipped', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(nextJourneyDay)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });
});
