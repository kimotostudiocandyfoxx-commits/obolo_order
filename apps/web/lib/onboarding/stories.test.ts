import { describe, expect, it } from 'vitest';
import { hasMotion } from './media';
import { labelIndex } from './script';
import { STORIES } from './stories';

describe('all day scripts', () => {
  for (const [day, story] of Object.entries(STORIES)) {
    it(`day ${day}: labels resolve, ends with end`, () => {
      const steps = story.steps;
      for (const s of steps) {
        if (s.t === 'goto') expect(() => labelIndex(steps, s.id)).not.toThrow();
        if (s.t === 'choice') for (const o of s.options) if (o.goto) expect(() => labelIndex(steps, o.goto!)).not.toThrow();
      }
      expect(steps[steps.length - 1]).toEqual({ t: 'end' });
    });
  }

  it('day 2 follows the client script', () => {
    const d = STORIES[2];
    expect(d.auth).toBe(true);
    expect(d.skipLabel).toBe('もちろん明日まで待てへん');
    const vids = d.steps.flatMap((s) => (s.t === 'video' || s.t === 'loop' ? [s.motion] : []));
    expect(vids).toEqual(['2-1', '2-2', '2-3', 6, 7, 9, 11, 12, 13, '2-9', '2-10']);
    // every motion has been delivered
    expect(vids.filter((m) => !hasMotion(m))).toEqual([]);
  });

  it('declining on day 2 always comes back to the same question', () => {
    const steps = STORIES[2].steps;
    for (const key of ['promise', 'talk', 'trip']) {
      const c = steps.findIndex((s) => s.t === 'choice' && s.key === key);
      const back = steps.slice(c).find((s) => s.t === 'goto');
      expect(back).toBeDefined();
      expect(labelIndex(steps, (back as { id: string }).id)).toBeLessThan(c);
    }
  });
});
