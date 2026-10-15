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

  it('the first journey is seven days; every countdown says 明日まで待てない (day 2: もちろん…)', () => {
    expect(Object.keys(STORIES).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(Object.entries(STORIES).every(([d, s]) => s.skipLabel === (d === '2' ? 'もちろん明日まで待てない' : DEFAULT_SKIP_LABEL))).toBe(true);
    expect(DEFAULT_SKIP_LABEL).toBe('明日まで待てない');
    expect(STORIES[JOURNEY_PAYMENT].steps.some((s) => s.t === 'order')).toBe(true);
  });
});

describe('day 1 (story 2026-10-14)', () => {
  const steps = STORIES[1].steps;
  it('asks the name (no age), and MONBAN offers the ticket; the riddles, the gem and the letter are not on day 1 (story 2026-10-15)', () => {
    const t = kinds(steps);
    expect(t).not.toContain('age');
    expect(t).not.toContain('riddles');
    expect(t).not.toContain('letter');
    const c = steps.find((s) => s.t === 'choice' && s.key === 'f_d01_ticket');
    expect(c?.t === 'choice' && c.options.map((o) => o.label)).toEqual(['切符を受け取る', '受け取らない']);
    expect(steps.some((s) => s.t === 'caption' && s.text.includes('{inviter_message}') && s.when === 'inviterMessage')).toBe(true);
  });
  it('goes from the name straight on to 「ここは、宇宙秘密結社だ。」 (client 2026-10-15)', () => {
    const n = steps.findIndex((s) => s.t === 'name');
    expect(steps.slice(n + 1, n + 3).map((s) => (s.t === 'say' ? s.text : s.t))).toEqual(['{name}か、いいな。', 'ここは、宇宙秘密結社だ。']);
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
  it('the gem and the riddle book at the launch pit, then the look, the NEO name, the Bati is born and named — all on day 2', () => {
    const t = kinds(steps);
    expect(t.indexOf('riddles')).toBeLessThan(t.indexOf('look'));
    expect(steps.findIndex((s) => s.t === 'caption' && s.text === 'マナジェムを手に入れた')).toBeLessThan(t.indexOf('riddles'));
    expect(t.indexOf('look')).toBeLessThan(t.indexOf('neoname'));
    expect(t.indexOf('neoname')).toBeLessThan(t.indexOf('egg'));
    expect(t.indexOf('egg')).toBeLessThan(t.indexOf('hatch'));
    expect(t.indexOf('hatch')).toBeLessThan(t.indexOf('batiname'));
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
  it('the kororin lesson on the real Saturn world, then riddle 2, then the letter from Jupiter', () => {
    const t = kinds(steps);
    expect(t.indexOf('saturn')).toBeGreaterThan(0);
    expect(t.indexOf('seal')).toBeGreaterThan(t.indexOf('saturn'));
    expect(steps.find((s) => s.t === 'seal')).toEqual({ t: 'seal', n: 2 });
    expect(steps.findIndex((s) => s.t === 'letter')).toBeGreaterThan(t.indexOf('seal'));
  });
});

describe('the Eclipse day (7)', () => {
  const steps = STORIES[7].steps;
  it('エクリプスを始める leads to the payment by the visitor; 今はやめておく stops at the choice', () => {
    const c = steps.findIndex((s) => s.t === 'choice' && s.key === 'f_d08_decide');
    const opts = steps[c].t === 'choice' ? steps[c].options : [];
    const pay = labelIndex(steps, opts[0].goto!);
    expect(steps.slice(pay, pay + 4).find((s) => s.t === 'order')).toEqual({ t: 'order', cancel: 'back' });
    const stop = steps.slice(c + 1).find((s) => s.t === 'pause');
    expect(stop).toEqual({ t: 'pause', resume: 'resume' });
  });
  it('the Sun temple opens riddles 2 and 1, then the film of the seven days', () => {
    const opened = steps.filter((s) => s.t === 'seal' && s.open).map((s) => (s.t === 'seal' ? s.n : 0));
    expect(opened).toEqual([2, 1]);
    expect(steps.some((s) => s.t === 'made' && s.what === 'film')).toBe(true);
  });
});
