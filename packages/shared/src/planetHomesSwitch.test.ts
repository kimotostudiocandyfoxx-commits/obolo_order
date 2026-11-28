import { describe, expect, it } from 'vitest';
import { HOME_PLANETS } from './planetHomeConfig';
import { PLANET_HOMES_ON_BY_DEFAULT, planetHomeIsNew } from './planetHomesSwitch';

describe('client 2026-11-28: the new homes one planet at a time, from one list in the code (web and API alike)', () => {
  it('the list: Pluto only (it has no screen of before)', () => {
    expect([...PLANET_HOMES_ON_BY_DEFAULT]).toEqual(['pluto']);
  });

  it('nothing set: Pluto shows the new home, the other seven keep their screen of before', () => {
    for (const p of HOME_PLANETS) expect(planetHomeIsNew(p, {}), p).toBe(p === 'pluto');
    for (const v of [undefined, null, '']) expect(planetHomeIsNew('pluto', { all: v, only: v, except: v })).toBe(true);
  });

  it('the variables still work as documented: _NEW adds, _OLD takes back (Pluto too), all=new is everyone', () => {
    expect(HOME_PLANETS.filter((p) => planetHomeIsNew(p, { only: 'saturn' }))).toEqual(['saturn', 'pluto']);
    expect(planetHomeIsNew('pluto', { except: 'pluto' })).toBe(false);
    expect(planetHomeIsNew('pluto', { all: 'new', except: 'Pluto' })).toBe(false);
    expect(HOME_PLANETS.filter((p) => planetHomeIsNew(p, { all: 'new' }))).toEqual([...HOME_PLANETS]);
  });
});
