import { describe, expect, it } from 'vitest';
import { AFTER_DAYS } from '../onboarding/after';
import { DAY3 } from '../onboarding/day3';
import { DAY4 } from '../onboarding/day4';
import { DAY5 } from '../onboarding/day5';
import { DAY6 } from '../onboarding/day6';
import { DAY7 } from '../onboarding/day7';
import { DAY8 } from '../onboarding/day8';
import type { Step } from '../onboarding/script';
import { stageOf } from '../onboarding/stage';
import { AMBIENT, ambientFor, PLATE_AMBIENT, plateKey, planetOf, PLANETS, SCENE_AMBIENT, STILL_AMBIENT, stillKey } from './ambient';

/** every still shown under a row scene (day 3 on, the members' days), with its scene */
function rowStills(steps: Step[]): [string, string][] {
  const out: [string, string][] = [];
  let scene: string | null = null;
  for (const s of steps) {
    if (s.t === 'scene') scene = s.id;
    const image = s.t === 'still' || s.t === 'arrive' ? s.image : null;
    if (image && scene && stageOf(scene) === 'row') out.push([scene, image]);
  }
  return out;
}

const DAYS: Record<string, Step[]> = { d3: DAY3, d4: DAY4, d5: DAY5, d6: DAY6, d7: DAY7, d8: DAY8, m1: AFTER_DAYS[0], m2: AFTER_DAYS[1], m3: AFTER_DAYS[2] };
const isHex = (c: string) => /^#[0-9a-f]{6}$/i.test(c);

describe('ambient table', () => {
  it('every planet has an entry with a sky and a front', () => {
    for (const p of PLANETS) {
      expect(AMBIENT[p], p).toBeDefined();
      expect(AMBIENT[p].sky.length, p).toBeGreaterThan(0);
      expect(AMBIENT[p].front.length, p).toBeGreaterThan(0);
    }
  });

  for (const [day, steps] of Object.entries(DAYS)) {
    it(`${day}: every place of a row scene is on a planet with an ambient`, () => {
      const stills = rowStills(steps);
      expect(stills.length).toBeGreaterThan(0);
      for (const [scene, image] of stills) {
        const p = planetOf(scene, image);
        expect(p, `${scene} ${image}`).not.toBeNull();
        expect(AMBIENT[p!], `${scene} ${image} → ${p}`).toBeDefined();
        expect(STILL_AMBIENT[stillKey(image)!], `${image} has no STILL_AMBIENT entry`).toBeDefined();
      }
    });
  }

  it('the spec planets are the ones the story uses', () => {
    const used = new Set(Object.values(DAYS).flatMap((s) => rowStills(s).map(([sc, im]) => planetOf(sc, im))));
    for (const p of ['moon', 'saturn', 'jupiter', 'mercury', 'mars', 'venus', 'sun', 'uranus', 'neptune']) expect(used.has(p as never), p).toBe(true);
  });

  it('layers are well formed (colours, alphas, at most 6 sky layers after the merge)', () => {
    const all = [
      ...PLANETS.map((p) => ambientFor(p)),
      ...Object.entries(STILL_AMBIENT).map(([k, v]) => ambientFor(v.planet, k)),
      ...Object.entries(SCENE_AMBIENT).map(([k, v]) => ambientFor(v.planet ?? 'moon', null, k)),
    ];
    for (const a of all) {
      expect(a.sky.length).toBeLessThanOrEqual(6);
      for (const l of [...a.sky, ...a.front]) {
        expect(isHex(l.color), l.kind).toBe(true);
        expect(l.alpha).toBeGreaterThan(0);
        expect(l.alpha).toBeLessThanOrEqual(1);
      }
      expect(a.skyMask.y).toBeGreaterThan(0);
      expect(a.skyMask.y).toBeLessThanOrEqual(1);
    }
  });

  it('lookups: plates count as their still, night stills get stars, stand-ins keep the planet’s air', () => {
    expect(stillKey('/onboarding/plate-moon-night.jpg')).toBe('moon-night');
    expect(stillKey('s/moon-temple')).toBe('moon-temple');
    expect(ambientFor('venus', 's/venus-night').sky.some((l) => l.kind === 'stars')).toBe(true);
    expect(planetOf('M-PLUTO-S001', 's/uranus-field')).toBe('pluto');
    const pluto = ambientFor('pluto', 's/uranus-field', 'M-PLUTO-S001');
    expect(pluto.sky.some((l) => l.kind === 'ring')).toBe(false);
    expect(pluto.skyMask).toEqual(STILL_AMBIENT['uranus-field'].skyMask);
  });

  it('plates: their own positions, or none of the still’s', () => {
    expect(plateKey('/onboarding/s/plate-saturn-inside.jpg')).toBe('plate-saturn-inside');
    expect(plateKey('s/saturn-inside')).toBeNull();
    expect(ambientFor('moon', '/onboarding/s/plate-moon-temple.jpg').regions).toEqual(PLATE_AMBIENT['plate-moon-temple'].regions);
    // a plate with no entry (uranus-shop has none of its own): the still's planet and sky rule, no painted objects
    const shop = ambientFor('uranus', '/onboarding/s/plate-uranus-shop.jpg');
    expect(shop.skyMask).toEqual(STILL_AMBIENT['uranus-shop'].skyMask);
    const sat = ambientFor('saturn', '/onboarding/s/plate-saturn-night.jpg');
    expect(sat.regions).toBeUndefined();
    expect(sat.sky.some((l) => l.kind === 'ring')).toBe(false);
    for (const [k, v] of Object.entries(PLATE_AMBIENT)) expect(STILL_AMBIENT[k.replace(/^plate-/, '')]?.planet, k).toBe(v.planet);
  });
});
