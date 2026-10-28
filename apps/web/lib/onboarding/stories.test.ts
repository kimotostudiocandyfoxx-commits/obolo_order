import { JOURNEY_PAYMENT } from '@obolo/shared';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasMotion, PLANNED_MOTIONS } from './media';
import { labelIndex, type Step } from './script';
import { DEFAULT_SKIP_LABEL, PREVIEW_ONLY, STORIES } from './stories';

const all = { ...STORIES, ...PREVIEW_ONLY };
const kinds = (steps: Step[]) => steps.map((s) => s.t);
/** stills queued for Seedream (saved under public/onboarding/<dir>/<id>.jpg once painted) */
const artQueue = JSON.parse(readFileSync('../../design/story-art-queue.json', 'utf8')) as { dir: string; items: { id: string }[] };
const queuedStills = new Set(artQueue.items.map((x) => `${artQueue.dir.replace(/^onboarding\//, '')}/${x.id}`));

describe('all day scripts', () => {
  for (const [day, story] of Object.entries(all)) {
    it(`day ${day}: labels resolve, ends with end, every picture exists`, () => {
      const steps = story.steps;
      for (const s of steps) {
        if (s.t === 'goto') expect(() => labelIndex(steps, s.id)).not.toThrow();
        if (s.t === 'pause') expect(() => labelIndex(steps, s.resume)).not.toThrow();
        if (s.t === 'age') expect(() => labelIndex(steps, s.skip)).not.toThrow();
        if (s.t === 'choice') for (const o of s.options) if (o.goto) expect(() => labelIndex(steps, o.goto!)).not.toThrow();
        // a still exists, or is queued to be painted (design/story-art-queue.json)
        if (s.t === 'still') expect(existsSync(`public/onboarding/${s.image}.jpg`) || queuedStills.has(s.image), s.image).toBe(true);
        // days 1–3 are built for real: every motion exists or is planned and being made (PLANNED_MOTIONS)
        if (Number(day) <= 3 && (s.t === 'video' || s.t === 'loop' || s.t === 'bgvideo')) expect(hasMotion(s.motion) || PLANNED_MOTIONS.has(s.motion), String(s.motion)).toBe(true);
      }
      expect(steps[steps.length - 1]).toEqual({ t: 'end' });
    });
  }

  it('the first journey is eight days (draft 21); every countdown says 明日まで待てない (day 2: もちろん…)', () => {
    expect(Object.keys(STORIES).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
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
    // the inviter's own words are on the invitation card itself (set in code, only when written)
    expect(steps.some((s) => s.t === 'invitation')).toBe(true);
  });
  it('goes from the name straight on to 「ここは、宇宙秘密結社だ。」 (client 2026-10-15)', () => {
    const n = steps.findIndex((s) => s.t === 'name');
    expect(steps.slice(n + 1, n + 3).map((s) => (s.t === 'say' ? s.text : s.t))).toEqual(['{name}か、いいな。', 'ここは、宇宙秘密結社だ。']);
  });
  it('the client corrections of 2026-10-20: the gate line while it opens, the temple title, MONBAN before the ticket', () => {
    const g = steps.findIndex((s) => s.t === 'bgvideo' && s.motion === 11);
    expect(steps[g + 1]).toMatchObject({ t: 'say', text: '門をくぐり、地球の神殿に行け…。' });
    const v12 = steps.find((s) => s.t === 'video' && s.motion === 12);
    expect(v12?.t === 'video' && v12.captions?.[0].text).toBe('地球の神殿に着いた');
    const k = steps.findIndex((s) => s.t === 'say' && s.text === 'それより先はObolo Orderしか知ることができない。');
    expect(steps[k + 1]).toMatchObject({ t: 'say', text: 'ただ、お前はObolo Orderに招待されてここに来た。' });
    expect(steps[k + 2]).toMatchObject({ t: 'say', text: 'だから知る権利がある。' });
    // the loops behind MONBAN no longer fade to black where they loop
    expect(steps.some((s) => s.t === 'loop' && (s.motion === 9 || s.motion === 28))).toBe(false);
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
  it('the gate: the plane, MONBAN takes the ticket, through the gate, then KIMORIN behind you (client 2026-10-22)', () => {
    const at = (f: (s: Step) => boolean) => steps.findIndex(f);
    const plane = at((s) => s.t === 'video' && s.motion === 'd2-plane');
    const close = at((s) => s.t === 'video' && s.motion === 'd1-monban');
    const give = at((s) => s.t === 'video' && s.motion === 'd2-ticket-give');
    const through = at((s) => s.t === 'video' && s.motion === '12-a');
    const wait = at((s) => s.t === 'say' && s.text === '待ちなさい。');
    const smoke = at((s) => s.t === 'still' && s.image === 's/d2-gate-inside');
    const into = at((s) => s.t === 'still' && s.image === 's/d2-hall-dark-kimorin');
    expect([plane, close, give, through, wait, smoke, into].every((x, k, a) => x > -1 && (k === 0 || x > a[k - 1]))).toBe(true);
  });
  it('the egg: the visitor picks one, KIMORIN⭐︎ gets the other', () => {
    const c = steps.find((s) => s.t === 'choice' && s.key === 'egg');
    expect(c?.t === 'choice' && c.options.map((o) => o.label)).toEqual(['太陽と月のたまご', '地球と月のたまご']);
    const b = steps.filter((s): s is Extract<Step, { t: 'branch' }> => s.t === 'branch' && s.key === 'egg');
    expect(b.map((x) => x.cases['太陽と月のたまご'])).toEqual(['gem-sun', 'hatch-sun', 'pinpon-earth']);
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
    const dragon = steps.findIndex((s) => s.t === 'video' && s.motion === 'd2-dragon');
    expect(dragon).toBeGreaterThan(-1);
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
  it('riddle 2 on MONBAN\'s call from the rocket, then the kororin lesson on the real Saturn world (story 49a3048)', () => {
    const t = kinds(steps);
    expect(steps.find((s) => s.t === 'seal')).toEqual({ t: 'seal', n: 2 });
    expect(t.indexOf('seal')).toBeGreaterThan(t.indexOf('clock'));
    expect(t.indexOf('saturn')).toBeGreaterThan(t.indexOf('seal'));
    expect(t.indexOf('ticket')).toBeGreaterThan(t.indexOf('saturn'));
  });
});

describe('Venus (day 7, draft 21)', () => {
  const steps = STORIES[7].steps;
  it('the easy DJ, then the fifth stamp', () => {
    const v = steps.findIndex((s) => s.t === 'venus');
    expect(v).toBeGreaterThan(0);
    expect(steps.slice(v).find((s) => s.t === 'ticket')).toEqual({ t: 'ticket', stamp: 'venus' });
  });
});

describe('the Sun day (8, draft 21)', () => {
  const steps = STORIES[8].steps;
  it('record I for everyone, then 〔エクリプスを受ける〕 leads to the payment; 〔今は、住人のままでいる〕 ends the journey as a resident', () => {
    const c = steps.findIndex((s) => s.t === 'choice' && s.key === 'f_d08_decide');
    const record1 = steps.findIndex((s) => s.t === 'film' && s.id === 'record1');
    expect(record1).toBeGreaterThan(0);
    expect(record1).toBeLessThan(c);
    const opts = steps[c].t === 'choice' ? steps[c].options : [];
    expect(opts.map((o) => o.label)).toEqual(['エクリプスを受ける', '今は、住人のままでいる']);
    const pay = labelIndex(steps, opts[0].goto!);
    expect(steps.slice(pay, pay + 4).find((s) => s.t === 'order')).toEqual({ t: 'order', cancel: 'back' });
    expect(steps.slice(c + 1).find((s) => s.t === 'end' || s.t === 'order')?.t).toBe('end');
  });
  it('riddles 2 and 4 open for everyone, riddle 1 and records II・III only after the Eclipse', () => {
    const opened = steps.filter((s) => s.t === 'seal' && s.open).map((s) => (s.t === 'seal' ? s.n : 0));
    expect(opened).toEqual([2, 4, 1]);
    const pay = labelIndex(steps, 'pay');
    expect(steps.findIndex((s) => s.t === 'film' && s.id === 'record23')).toBeGreaterThan(pay);
    expect(steps.some((s) => s.t === 'made' && s.what === 'film')).toBe(false);
  });
});
