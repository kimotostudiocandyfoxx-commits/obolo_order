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

  it('the first journey is eight days (draft 21); only days 1 and 2 can skip the wait (明日まで待てない; day 2: もちろん…)', () => {
    expect(Object.keys(STORIES).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const labels = Object.fromEntries(Object.entries(STORIES).map(([d, s]) => [d, s.skipLabel]));
    expect(labels).toEqual({ 1: DEFAULT_SKIP_LABEL, 2: 'もちろん明日まで待てない', 3: undefined, 4: undefined, 5: undefined, 6: undefined, 7: undefined, 8: undefined });
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
  it('the gate (M-R207): the line of light to the gate, KIMORIN behind you, MONBAN out of the smoke, the ticket, through the gate', () => {
    const at = (f: (s: Step) => boolean) => steps.findIndex(f);
    const line = at((s) => s.t === 'still' && s.image === 's/d2-gate-near');
    const wait = at((s) => s.t === 'say' && s.text === '待ちなさい。');
    const smoke = at((s) => s.t === 'still' && s.image === 's/d2-gate-two-inside');
    const give = at((s) => s.t === 'video' && s.motion === 'd2-ticket-give');
    const through = at((s) => s.t === 'video' && s.motion === '12-a');
    const into = at((s) => s.t === 'still' && s.image === 's/d2-hall-dark-kimorin');
    expect([line, wait, smoke, give, through, into].every((x, k, a) => x > -1 && (k === 0 || x > a[k - 1]))).toBe(true);
    // no crane any more (M-R207)
    expect(steps.some((s) => s.t === 'video' && s.motion === '5-f')).toBe(false);
  });
  it('the egg: the visitor picks one, KIMORIN⭐︎ gets the other', () => {
    // M-R215: the moon egg (girl-leaning) or the sun egg (boy-leaning), f_egg = moon / sun
    const c = steps.find((s) => s.t === 'choice' && s.key === 'egg');
    expect(c?.t === 'choice' && c.options.map((o) => o.label)).toEqual(['月のたまご（女の子寄り）', '太陽のたまご（男の子寄り）']);
    expect(steps.filter((s) => s.t === 'set' && s.key === 'f_egg').map((s) => s.t === 'set' && s.value)).toEqual(['moon', 'sun']);
    const b = steps.filter((s): s is Extract<Step, { t: 'branch' }> => s.t === 'branch' && s.key === 'f_egg');
    // the gem, KIMORIN⭐︎'s egg (its pinpon and うんちピンポンくん), then the visitor's own egg hatching (M-R207: on day 2 again)
    expect(b.map((x) => x.cases.sun)).toEqual(['gem-sun', 'pinpon-earth', 'unpon-earth', 'hatch-sun']);
    // M-R218 / M-R217: the shell becomes a small egg, then the card
    const t = steps.map((s) => s.t);
    expect(steps.findIndex((s) => s.t === 'fx' && s.fx === 'shell-egg')).toBeGreaterThan(t.indexOf('hatch'));
    expect(t.indexOf('baticard')).toBeGreaterThan(t.indexOf('batiname'));
  });
  it('the gem at the launch pit, then {bati} is born, {bati}\'s magic makes the look, KIMORIN\'s dragon, the NEO name and the first chat (M-R209)', () => {
    const t = kinds(steps);
    expect(t).not.toContain('riddles');
    const scenes = steps.filter((s): s is Extract<Step, { t: 'scene' }> => s.t === 'scene').map((s) => s.id);
    expect(scenes.slice(scenes.indexOf('D03-S003'))).toEqual(['D03-S003', 'D03-S005', 'D03-S004', 'D03-S004b', 'D03-S004c', 'D03-S008', 'D03-S009']);
    expect(steps.findIndex((s) => s.t === 'caption' && s.text === 'マナジェムを手に入れた')).toBeLessThan(t.indexOf('egg'));
    expect(t.indexOf('egg')).toBeLessThan(t.indexOf('hatch'));
    expect(t.indexOf('hatch')).toBeLessThan(t.indexOf('batiname'));
    expect(t.indexOf('batiname')).toBeLessThan(t.indexOf('look'));
    expect(t.indexOf('look')).toBeLessThan(steps.findIndex((s) => s.t === 'video' && s.motion === 'd2-dragon'));
    expect(steps.findIndex((s) => s.t === 'video' && s.motion === 'd2-dragon')).toBeLessThan(t.indexOf('neoname'));
    expect(t.indexOf('neoname')).toBeLessThan(t.indexOf('batitalk'));
    // {bati} casts the look's magic (「いくよ、{name}！」); OBOLON asks for the animal
    const look = steps.find((s): s is Extract<Step, { t: 'look' }> => s.t === 'look');
    expect(look?.ask).toEqual({ t: 'say', who: 'OBOLON', text: '何の動物に、アレンジする？' });
    expect(look?.spell).toEqual({ t: 'say', who: 'バティ', text: 'いくよ、{name}！' });
    // Bluena is given on the morning of day 3 (M-R207/M-R212)
    expect(steps.some((s) => s.t === 'say' && s.text.includes('作るのは、月。しまうのは、Bluena。'))).toBe(false);
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
    // until SYS-S002 (becoming Obolo Order early), where MONBAN meets you at the Earth temple
    for (const s of steps.slice(0, steps.findIndex((x) => x.t === 'scene' && x.id === 'SYS-S002'))) {
      if (s.t === 'screen') open = s.open;
      if (s.t === 'say' && s.who === 'MONBAN') expect(open).toBe(true);
    }
  });
  it('Bluena in the morning, the first kororins made on the Moon, fly or keep, then the rocket and Saturn to look; MONBAN offers Obolo Order early (SYS-S002)', () => {
    const t = kinds(steps);
    expect(t).not.toContain('seal');
    // {bati} was born on day 2 (M-R207): no hatching on day 3; nothing is made on Saturn (M-R208)
    expect(t).not.toContain('hatch');
    expect(t).not.toContain('saturn');
    const bluena = steps.findIndex((s) => s.t === 'set' && s.key === 'f_d04_bluena');
    expect(bluena).toBeGreaterThan(-1);
    expect(steps.findIndex((s) => s.t === 'say' && s.text.includes('作るのは、月。しまうのは、Bluena。'))).toBeLessThan(t.indexOf('atelier'));
    expect(steps.find((s) => s.t === 'atelier')).toMatchObject({ kind: 'voice' });
    const fly = steps.findIndex((s) => s.t === 'choice' && s.key === 'f_d04_fly');
    expect(t.lastIndexOf('atelier')).toBeLessThan(fly);
    // the 88 minutes start when the rocket leaves the Moon after making (SYS-S001)
    expect(fly).toBeLessThan(t.indexOf('clock'));
    expect(t.indexOf('clock')).toBeLessThan(steps.findIndex((s) => s.t === 'scene' && s.id === 'D04-S005'));
    expect(steps.filter((s) => s.t === 'set' && s.key === 'f_d04_fly').map((s) => s.t === 'set' && s.value)).toEqual(['fly', 'skip']);
    // D04-S005c: the first voice message in the inviter's dachi thread (M-R212), then the way on by its answer
    const dv = t.indexOf('dachivoice');
    expect(steps[dv]).toEqual({ t: 'dachivoice', fallback: { t: 'say', who: 'MIKIE⭐︎DRILL', text: 'ようこそ。……あなたのつぶやき、聞こえたわよ。' } });
    expect(steps[dv + 1]).toMatchObject({ t: 'branch', key: 'f_d04_voice_reply', cases: { reply: 'reply' }, otherwise: 'reply-later' });
    expect(t.indexOf('ticket')).toBeGreaterThan(t.indexOf('clock'));
    const c = steps.find((s) => s.t === 'choice' && s.key === 'f_join_early');
    expect(c?.t === 'choice' && c.options.map((o) => o.label)).toEqual(['先にObolo Orderになる', '8日目に決める']);
    expect(steps.some((s) => s.t === 'scene' && s.id === 'SYS-S002')).toBe(true);
  });
});

describe('days 3–7: made on the Moon, flown, then seen on the planet (M-R208)', () => {
  const plan: [number, string, string, [string, string]][] = [
    [3, 'voice', 'f_d04_fly', ['fly', 'skip']],
    [4, 'art', 'f_d05_sent_jacket', ['send', 'keep']],
    [5, 'song', 'f_d06_sent_song', ['sail', 'keep']],
    [6, 'video', 'f_d07_sent_mv', ['send', 'keep']],
    [7, 'radio', 'f_d07v_show', ['send', 'keep']],
  ];
  for (const [day, kind, flag, values] of plan) {
    it(`day ${day}: OBOLON teaches in the Moon temple, the ${kind} is made in {bati}'s chat, ${flag} = ${values.join(' / ')}, then the rocket`, () => {
      const steps = STORIES[day].steps;
      const t = kinds(steps);
      const teach = steps.findIndex((s) => s.t === 'say' && s.who === 'OBOLON' && /お前は、ついに、.+を、作れるようになる。/.test(s.text));
      expect(teach).toBeGreaterThan(-1);
      const made = steps.findIndex((s) => s.t === 'atelier' && s.kind === kind);
      expect(made).toBeGreaterThan(teach);
      const fly = steps.findIndex((s) => s.t === 'choice' && s.key === flag);
      expect(fly).toBeGreaterThan(made);
      expect(steps.filter((s) => s.t === 'set' && s.key === flag).map((s) => s.t === 'set' && s.value)).toEqual(values);
      // the 88 minutes start as the rocket leaves the Moon, after making; no planet practice any more
      expect(t.indexOf('clock')).toBeGreaterThan(fly);
      for (const p of ['saturn', 'jupiter', 'mercury', 'mars', 'venus']) expect(t).not.toContain(p);
    });
  }
  it('the removed flags are gone (M-R208/M-R210)', () => {
    const gone = ['f_d05_tree', 'f_d05_tree_parts', 'f_d06_island', 'f_d06_island_parts', 'f_d06_island_name', 'f_d06_know', 'f_d07_studio', 'f_d07_studio_parts', 'f_d07v_dj', 'f_d07v_set_done', 'f_d05_spell', 'f_d06_spell'];
    const keys = Object.values(STORIES).flatMap((s) => s.steps.flatMap((x) => (x.t === 'set' || x.t === 'choice' || x.t === 'branch' ? [x.key] : [])));
    for (const g of gone) expect(keys).not.toContain(g);
  });
});

describe('Venus (day 7)', () => {
  const steps = STORIES[7].steps;
  it('the show made on the Moon, then the booth and the fifth stamp; the night is slept on Venus', () => {
    const booth = steps.findIndex((s) => s.t === 'scene' && s.id === 'D07V-S004');
    expect(booth).toBeGreaterThan(steps.findIndex((s) => s.t === 'atelier'));
    expect(steps.slice(booth).find((s) => s.t === 'ticket')).toEqual({ t: 'ticket', stamp: 'venus' });
    expect(steps.slice(booth).some((s) => s.t === 'still' && s.image.startsWith('s/moon'))).toBe(false);
  });
});

describe('the Sun day (8, draft 21)', () => {
  const steps = STORIES[8].steps;
  it('〔エクリプスを受ける〕 leads to the payment; 〔今は、住人のままでいる〕 ends the journey as a resident', () => {
    const c = steps.findIndex((s) => s.t === 'choice' && s.key === 'f_d08_decide');
    const opts = steps[c].t === 'choice' ? steps[c].options : [];
    expect(opts.map((o) => o.label)).toEqual(['エクリプスを受ける', '今は、住人のままでいる']);
    const pay = labelIndex(steps, opts[0].goto!);
    expect(steps.slice(pay, pay + 8).find((s) => s.t === 'order')).toMatchObject({ t: 'order', cancel: 'back' });
    expect(steps.slice(c + 1).find((s) => s.t === 'end' || s.t === 'order')?.t).toBe('end');
  });
  it('no riddles or records any more; members who joined early take the short way (f_join_early)', () => {
    expect(steps.some((s) => s.t === 'seal' || s.t === 'film')).toBe(false);
    expect(steps.some((s) => s.t === 'branch' && s.key === 'f_join_early')).toBe(true);
    expect(steps.some((s) => s.t === 'caption' && s.text === '通信：火星シアターの扉が、開いた')).toBe(true);
  });
});
