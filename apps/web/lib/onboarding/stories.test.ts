import { JOURNEY_PAYMENT } from '@obolo/shared';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasMotion } from './media';
import { labelIndex, type Step } from './script';
import { DEFAULT_SKIP_LABEL, PREVIEW_ONLY, STORIES } from './stories';

const all = { ...STORIES, ...PREVIEW_ONLY };
const kinds = (steps: Step[]) => steps.map((s) => s.t);

describe('all day scripts', () => {
  for (const [day, story] of Object.entries(all)) {
    it(`day ${day}: labels resolve, ends with end, every picture exists`, () => {
      const steps = story.steps;
      for (const s of steps) {
        if (s.t === 'goto') expect(() => labelIndex(steps, s.id)).not.toThrow();
        if (s.t === 'pause') expect(() => labelIndex(steps, s.resume)).not.toThrow();
        if (s.t === 'age') expect(() => labelIndex(steps, s.skip)).not.toThrow();
        if (s.t === 'choice') for (const o of s.options) if (o.goto) expect(() => labelIndex(steps, o.goto!)).not.toThrow();
        if (s.t === 'still') expect(existsSync(`public/onboarding/${s.image}.jpg`), s.image).toBe(true);
        // days 1–3 are built for real (later days still show placeholders for motions not made yet)
        if (Number(day) <= 3 && (s.t === 'video' || s.t === 'loop')) expect(hasMotion(s.motion), String(s.motion)).toBe(true);
      }
      expect(steps[steps.length - 1]).toEqual({ t: 'end' });
    });
  }

  it('the first journey is seven days; every countdown says 明日まで待てない', () => {
    expect(Object.keys(STORIES).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(Object.values(STORIES).every((d) => d.skipLabel === DEFAULT_SKIP_LABEL)).toBe(true);
    expect(DEFAULT_SKIP_LABEL).toBe('明日まで待てない');
    expect(STORIES[JOURNEY_PAYMENT].steps.some((s) => s.t === 'order')).toBe(true);
  });
});

describe('day 1 (story 2026-10-14)', () => {
  const steps = STORIES[1].steps;
  it('asks the name, then the age (optional), then hands over the riddle book, the letter and the gem', () => {
    const t = kinds(steps);
    expect(t.indexOf('name')).toBeLessThan(t.indexOf('age'));
    expect(t.indexOf('age')).toBeLessThan(t.indexOf('riddles'));
    expect(t.indexOf('riddles')).toBeLessThan(t.indexOf('letter'));
    expect(steps.some((s) => s.t === 'caption' && s.text === 'マナジェムを手に入れた')).toBe(true);
  });
  it('declining OBOLON still reaches the riddles', () => {
    const decline = labelIndex(steps, 'decline');
    expect(steps.slice(decline).some((s) => s.t === 'riddles')).toBe(true);
  });
  it('has no guide KIMORIN on day 1', () => {
    expect(steps.some((s) => s.t === 'say' && s.who === 'KIMORIN')).toBe(false);
    expect(steps.some((s) => s.t === 'say' && /案内人/.test(s.text))).toBe(false);
  });
});

describe('day 2: KIMORIN, then the Moon (story 2026-10-14)', () => {
  const steps = STORIES[2].steps;
  it('KIMORIN appears behind you at the gate, as an invited guest', () => {
    const first = steps.findIndex((s) => s.t === 'say' && s.who === 'KIMORIN');
    expect(steps[first]).toMatchObject({ text: '待ちなさい。' });
    expect(steps.some((s) => s.t === 'say' && s.text.includes('天才発明家'))).toBe(true);
  });
  it('「やめておく」 really ends the day and comes back to the same choice', () => {
    const c = steps.findIndex((s) => s.t === 'choice' && s.key === 'go');
    const pause = steps.findIndex((s) => s.t === 'pause');
    expect(pause).toBeGreaterThan(c);
    const p = steps[pause] as { resume: string };
    expect(labelIndex(steps, p.resume)).toBe(c - 1);
  });
  it('the look, the NEO name, saving, then the Bati is born and named — all on day 2', () => {
    const t = kinds(steps);
    expect(t.indexOf('look')).toBeLessThan(t.indexOf('neoname'));
    expect(t.indexOf('neoname')).toBeLessThan(t.indexOf('egg'));
    expect(t.indexOf('egg')).toBeLessThan(t.indexOf('hatch'));
    expect(t.indexOf('hatch')).toBeLessThan(t.indexOf('batiname'));
    const save = steps.find((s) => s.t === 'choice' && s.key === 'save');
    expect(save).toMatchObject({ prompt: expect.stringContaining('プロフィールとして保存') });
  });
  it('KIMORIN wears the sunglasses look after the dragon', () => {
    const dragon = steps.findIndex((s) => s.t === 'sprite' && s.image === 'kimorin-dragon');
    const after = steps.slice(dragon + 1).filter((s): s is Extract<Step, { t: 'sprite' }> => s.t === 'sprite');
    expect(after.some((s) => [s.image].flat().includes('kimorin-1'))).toBe(false);
    expect(after.some((s) => [s.image].flat().includes('kimorin-sun'))).toBe(true);
  });
});

describe('day 3: Bluena and Saturn (story 2026-10-14)', () => {
  const steps = STORIES[3].steps;
  it('MONBAN only speaks through Bluena’s square screen', () => {
    let open = false;
    for (const s of steps) {
      if (s.t === 'screen') open = s.open;
      if (s.t === 'say' && s.who === 'MONBAN') expect(open).toBe(true);
    }
    expect(steps.some((s) => s.t === 'say' && s.who === 'OBOLON' && s.text.includes('地球と、月と、太陽'))).toBe(true);
  });
  it('kororin (or skip), then the ring, then riddle 2, then the letter from Jupiter', () => {
    const t = kinds(steps);
    expect(t.indexOf('kororin')).toBeGreaterThan(0);
    expect(t.indexOf('seal')).toBeGreaterThan(t.indexOf('kororin'));
    expect(steps.find((s) => s.t === 'seal')).toEqual({ t: 'seal', n: 2 });
    expect(steps.findIndex((s) => s.t === 'letter')).toBeGreaterThan(t.indexOf('seal'));
    const skip = labelIndex(steps, 'skip');
    expect(steps.slice(skip).some((s) => s.t === 'seal')).toBe(true);
  });
});

describe('the Eclipse day (7)', () => {
  const steps = STORIES[7].steps;
  it('MONBAN asks for the 88 yen, OK leads to the payment', () => {
    const c = steps.findIndex((s) => s.t === 'choice' && s.key === 'eclipse');
    const ok = steps[c].t === 'choice' ? steps[c].options.find((o) => o.label === 'OK') : undefined;
    const pay = labelIndex(steps, ok!.goto!);
    expect(steps[pay + 1]).toEqual({ t: 'order', cancel: 'later' });
  });
});
