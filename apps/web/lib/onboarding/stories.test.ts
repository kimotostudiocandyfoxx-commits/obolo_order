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

describe('the look and the Bati (client decision 2026-10-05)', () => {
  it('day 3 generates the look, asks the NEO name, then hands over the egg', () => {
    const order = STORIES[3].steps.map((s) => s.t).filter((t) => ['look', 'name', 'egg'].includes(t));
    expect(order).toEqual(['look', 'name', 'egg']);
  });
  it('day 4 hatches and names the Bati before leaving for Saturn', () => {
    const t = STORIES[4].steps.map((s) => (s.t === 'video' ? `video:${s.motion}` : s.t));
    expect(t.indexOf('hatch')).toBeLessThan(t.indexOf('batiname'));
    expect(t.indexOf('batiname')).toBeLessThan(t.indexOf('video:4-1'));
  });
});

describe('day 9: the Eclipse (client script 2026-10-06)', () => {
  const steps = STORIES[9].steps;

  it('MONBAN asks for the 88 yen, OK leads to the payment, then the rocket', () => {
    const c = steps.findIndex((s) => s.t === 'choice' && s.key === 'eclipse');
    const ok = steps[c].t === 'choice' ? steps[c].options.find((o) => o.label === 'OK') : undefined;
    const pay = labelIndex(steps, ok!.goto!);
    expect(steps[pay + 1]).toEqual({ t: 'order', cancel: 'later' });
    expect(steps.slice(pay).some((s) => s.t === 'say' && s.text.includes('エクリプス用のロケット'))).toBe(true);
    expect(steps.slice(0, c).some((s) => s.t === 'say' && s.text.includes('月88円'))).toBe(true);
  });

  it('thinking it over (or leaving the payment) always comes back to the question', () => {
    const c = steps.findIndex((s) => s.t === 'choice' && s.key === 'eclipse');
    const later = labelIndex(steps, 'later');
    const back = steps.slice(later).find((s) => s.t === 'goto');
    expect(labelIndex(steps, (back as { id: string }).id)).toBeLessThan(c);
  });
});

describe('day 9: the Sun temple and home (client script 2026-10-06, part 2)', () => {
  const steps = STORIES[9].steps;
  it('after paying: rocket to the Sun, OBOLON, fade to white, back at HQ, see you tomorrow', () => {
    const pay = labelIndex(steps, 'pay');
    const after = steps.slice(pay);
    const order = (pred: (s: (typeof steps)[number]) => boolean) => after.findIndex(pred);
    const temple = order((s) => s.t === 'still' && s.image === 'sun-temple');
    const obolon = order((s) => s.t === 'say' && s.who === 'OBOLON' && s.text.includes('最初から'));
    const white = order((s) => s.t === 'whiteout');
    const bye = order((s) => s.t === 'say' && s.text.includes('バイバイ'));
    expect(temple).toBeGreaterThan(0);
    expect(obolon).toBeGreaterThan(temple);
    expect(white).toBeGreaterThan(obolon);
    expect(bye).toBeGreaterThan(white);
  });
});
