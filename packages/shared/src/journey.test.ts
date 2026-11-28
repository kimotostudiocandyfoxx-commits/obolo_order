import { describe, expect, it } from 'vitest';
import { JOURNEY, JOURNEY_DONE, JOURNEY_LAST_DAY, JOURNEY_PAYMENT, journeyMeta, journeyWaitSkippable, nextJourneyDay, NO_SKIP_INTO_DAYS, planetIsOpen, planetOpenDay } from './journey';

describe('journey (eleven days, story M-R341)', () => {
  it('days 1..10 visit Earth, the Moon, Saturn, Jupiter, Mercury, Mars, Venus, Pluto, Neptune, Uranus; day 11 is the Sun', () => {
    expect(JOURNEY.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(JOURNEY.map((d) => d.planet)).toEqual(['earth', 'moon', 'saturn', 'jupiter', 'mercury', 'mars', 'venus', 'pluto', 'neptune', 'uranus']);
    expect(JOURNEY_LAST_DAY).toBe(10);
    expect(JOURNEY_PAYMENT).toBe(11);
    expect(JOURNEY_DONE).toBe(12);
    expect(journeyMeta(3)?.guides).toContain('たこ焼きシスター');
    expect(journeyMeta(8)?.guides).toContain('クロコパトラ');
    expect(journeyMeta(9)?.guides).toContain('オニモンク');
    expect(journeyMeta(10)?.guides).toContain('MONBAN');
  });
  it('no day is skipped', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(nextJourneyDay)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
  it('the outer planets open on the day they are visited, an Obolo Order or not (M-R341)', () => {
    expect([planetOpenDay('pluto'), planetOpenDay('neptune'), planetOpenDay('uranus')]).toEqual([8, 9, 10]);
    expect(planetOpenDay('venus')).toBeUndefined();
    expect(planetIsOpen('pluto', 7)).toBe(false);
    expect(planetIsOpen('pluto', 8)).toBe(true);
    expect(planetIsOpen('neptune', 8)).toBe(false);
    expect(planetIsOpen('uranus', 9)).toBe(false);
    expect(planetIsOpen('uranus', 10)).toBe(true);
    // everyone whose journey is done (the accounts of before too) has all three
    for (const p of ['pluto', 'neptune', 'uranus']) expect(planetIsOpen(p, JOURNEY_DONE)).toBe(true);
    expect(planetIsOpen('saturn', 1)).toBe(true);
    expect(planetIsOpen('uranus', null)).toBe(true);
  });
});

describe('the wait between days (client 2026-11-28)', () => {
  it('can be skipped after every day except 3 → 4 and 7 → 8', () => {
    expect(NO_SKIP_INTO_DAYS).toEqual([4, 8]);
    const skippable = Array.from({ length: JOURNEY_PAYMENT }, (_, i) => i + 1).filter(journeyWaitSkippable);
    expect(skippable).toEqual([1, 2, 4, 5, 6, 8, 9, 10, 11]);
    expect(journeyWaitSkippable(3)).toBe(false);
    expect(journeyWaitSkippable(7)).toBe(false);
    expect(journeyWaitSkippable(JOURNEY_DONE)).toBe(false);
    expect(journeyWaitSkippable(0)).toBe(false);
  });
});
