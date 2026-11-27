import { MADE_ON_MOON } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { moonOnly, planetIsMoonOnly, serverPlanetHomes } from './moon-only';

const code = (fn: () => void): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return ((e as { getResponse?: () => { error?: { code?: string } } }).getResponse?.().error?.code ?? (e as { code?: string }).code ?? String(e)) as string;
  }
};

describe('story 2026-11-27: the posting doors of before close when a planet has its new home (the server flag, off by default)', () => {
  it('nothing set: nothing is refused (production today)', () => {
    expect(serverPlanetHomes({})).toEqual({ all: undefined, only: undefined, except: undefined });
    for (const p of ['saturn', 'jupiter', 'mercury', 'mars', 'venus'] as const) {
      expect(planetIsMoonOnly(p, serverPlanetHomes({}))).toBe(false);
      expect(code(() => moonOnly(p, false, serverPlanetHomes({})))).toBeNull();
    }
    // this process (the tests, and production until the flag is set)
    expect(code(() => moonOnly('saturn'))).toBeNull();
  });

  it('PLANET_HOMES=new: a post made on the planet is refused with MADE_ON_MOON; the Moon’s own call passes', () => {
    const env = serverPlanetHomes({ PLANET_HOMES: 'new' });
    expect(JSON.stringify(code(() => moonOnly('saturn', false, env)))).toContain(MADE_ON_MOON);
    expect(code(() => moonOnly('saturn', true, env))).toBeNull();
    expect(JSON.stringify(code(() => moonOnly('venus', false, env)))).toContain(MADE_ON_MOON);
  });

  it('per planet, as on the web: _NEW turns planets on, _OLD keeps planets back', () => {
    const only = serverPlanetHomes({ PLANET_HOMES_NEW: 'saturn, jupiter' });
    expect(planetIsMoonOnly('saturn', only)).toBe(true);
    expect(planetIsMoonOnly('mercury', only)).toBe(false);
    const back = serverPlanetHomes({ PLANET_HOMES: 'new', PLANET_HOMES_OLD: 'venus' });
    expect(planetIsMoonOnly('venus', back)).toBe(false);
    expect(planetIsMoonOnly('mars', back)).toBe(true);
  });
});
