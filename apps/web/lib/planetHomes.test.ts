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

  it('story 2026-11-27: the doors of before close with the switch — Venus with ?dj=1 or ?booth=1 shows the new home too', () => {
    const env = { all: 'new' };
    expect(showsNewHome('venus', q('booth=1'), [], env)).toBe(true);
    expect(showsNewHome('venus', q('dj=1'), [], env)).toBe(true);
    // the mechanism stays for a door that must stay open one day
    expect(showsNewHome('venus', q('booth=1'), ['dj', 'booth'], env)).toBe(false);
    // switch off: the screen of before, whatever the query
    expect(showsNewHome('venus', q('booth=1'), [], {})).toBe(false);
  });
});
