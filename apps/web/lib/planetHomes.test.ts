import { HOME_PLANETS } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { newHomePlanets, planetHomeIsNew, PLANET_HOMES_ENV, showsNewHome } from './planetHomes';

const q = (s: string) => new URLSearchParams(s);

describe('M-R326: the switch from the live planet screens to the new homes (client 2026-11-28: one at a time, Pluto first)', () => {
  it('nothing set: Pluto shows the new home (PLANET_HOMES_ON_BY_DEFAULT), the other seven keep their screen of before', () => {
    for (const p of HOME_PLANETS) expect(planetHomeIsNew(p, {}), p).toBe(p === 'pluto');
    expect(newHomePlanets({})).toEqual(['pluto']);
    // this build (the tests, and production: no variable is set)
    expect(newHomePlanets(PLANET_HOMES_ENV)).toEqual(['pluto']);
    for (const p of HOME_PLANETS) expect(showsNewHome(p, q('')), p).toBe(p === 'pluto');
  });

  it('NEXT_PUBLIC_PLANET_HOMES=new: every planet shows the new home; any other value leaves the list of the code', () => {
    expect(newHomePlanets({ all: 'new' })).toEqual([...HOME_PLANETS]);
    expect(newHomePlanets({ all: ' NEW ' })).toEqual([...HOME_PLANETS]);
    for (const v of ['', 'old', '1', 'true', 'on']) expect(newHomePlanets({ all: v })).toEqual(['pluto']);
  });

  it('per planet: _NEW turns planets on too, _OLD keeps planets back (Pluto too; both lists: kept back)', () => {
    expect(newHomePlanets({ only: 'saturn, jupiter' })).toEqual(['saturn', 'jupiter', 'pluto']);
    expect(newHomePlanets({ except: 'pluto' })).toEqual([]);
    expect(showsNewHome('pluto', q(''), [], { except: 'PLUTO' })).toBe(false);
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
    // Venus not switched: the screen of before, whatever the query
    expect(showsNewHome('venus', q('booth=1'), [], {})).toBe(false);
  });
});
