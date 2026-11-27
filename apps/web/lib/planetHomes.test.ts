import { HOME_PLANETS } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { newHomePlanets, planetHomeIsNew, PLANET_HOMES_ENV, showsNewHome } from './planetHomes';

const q = (s: string) => new URLSearchParams(s);

describe('M-R326: the switch from the live planet screens to the new homes (off by default)', () => {
  it('nothing set: every planet keeps its screen of before', () => {
    for (const p of HOME_PLANETS) expect(planetHomeIsNew(p, {})).toBe(false);
    expect(newHomePlanets({})).toEqual([]);
    // this build (the tests, and production until the flag is set)
    expect(newHomePlanets(PLANET_HOMES_ENV)).toEqual([]);
    for (const p of HOME_PLANETS) expect(showsNewHome(p, q(''))).toBe(false);
  });

  it('NEXT_PUBLIC_PLANET_HOMES=new: every planet shows the new home; any other value is off', () => {
    expect(newHomePlanets({ all: 'new' })).toEqual([...HOME_PLANETS]);
    expect(newHomePlanets({ all: ' NEW ' })).toEqual([...HOME_PLANETS]);
    for (const v of ['', 'old', '1', 'true', 'on']) expect(newHomePlanets({ all: v })).toEqual([]);
  });

  it('per planet: _NEW turns planets on while the switch is off, _OLD keeps planets back while it is on (both: kept back)', () => {
    expect(newHomePlanets({ only: 'saturn, jupiter' })).toEqual(['saturn', 'jupiter']);
    expect(newHomePlanets({ all: 'new', except: 'venus mars' })).toEqual(HOME_PLANETS.filter((p) => p !== 'venus' && p !== 'mars'));
    expect(planetHomeIsNew('saturn', { only: 'saturn', except: 'saturn' })).toBe(false);
    expect(planetHomeIsNew('pluto', { only: 'Pluto' })).toBe(true);
  });

  it('a door of the screen of before stays open: Venus with ?dj=1 or ?booth=1 keeps the old screen even when switched', () => {
    const env = { all: 'new' };
    expect(showsNewHome('venus', q(''), ['dj', 'booth'], env)).toBe(true);
    expect(showsNewHome('venus', q('booth=1'), ['dj', 'booth'], env)).toBe(false);
    expect(showsNewHome('venus', q('dj=1'), ['dj', 'booth'], env)).toBe(false);
    expect(showsNewHome('venus', q('other=1'), ['dj', 'booth'], env)).toBe(true);
    expect(showsNewHome('venus', q('booth=1'), ['dj', 'booth'], {})).toBe(false);
  });
});
