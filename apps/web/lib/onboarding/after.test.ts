import { LAP2 } from '@obolo/shared';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AFTER_DAYS } from './after';
import { labelIndex } from './script';

describe('the days after joining (P05m)', () => {
  it('one step list per LAP2 day', () => {
    expect(AFTER_DAYS.length).toBe(LAP2.length);
  });
  AFTER_DAYS.forEach((steps, d) => {
    it(`day ${d + 1}: labels resolve, pictures, sprites and music exist, ends with end`, () => {
      for (const s of steps) {
        if (s.t === 'goto') expect(() => labelIndex(steps, s.id)).not.toThrow();
        if (s.t === 'branch') for (const l of [...Object.values(s.cases), s.otherwise]) expect(() => labelIndex(steps, l)).not.toThrow();
        if (s.t === 'choice') for (const o of s.options) if (o.goto) expect(() => labelIndex(steps, o.goto!)).not.toThrow();
        if (s.t === 'still' || s.t === 'arrive') expect(existsSync(`public/onboarding/${s.image}.jpg`), s.image).toBe(true);
        if (s.t === 'sprite') for (const n of [s.image ?? []].flat()) if (n && !n.startsWith('@')) expect(existsSync(`public/onboarding/${n}.webp`), n).toBe(true);
        if (s.t === 'bgm' && s.track) expect(existsSync(`public/onboarding/bgm-${s.track}.m4a`), s.track).toBe(true);
      }
      expect(steps[steps.length - 1]).toEqual({ t: 'end' });
    });
  });
  it('the planets open in the script order, each day with its scenes', () => {
    const scenes = AFTER_DAYS.map((steps) => steps.flatMap((s) => (s.t === 'scene' ? [s.id] : [])));
    expect(scenes).toEqual([['M-URANUS-S001', 'M-URANUS-S002'], ['M-PLUTO-S001', 'M-PLUTO-S002'], ['M-NEPTUNE-S001', 'M-NEPTUNE-S002', 'M-END-S001']]);
  });
});
