import { JOURNEY_DONE, JOURNEY_EIGHT_KEY, JOURNEY_PAYMENT, LAP2_DONE, lap2Applies, lap2Done, planetIsOpen } from '@obolo/shared';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planetLockOf } from '@/components/PlanetLock';
import { SHOP_LOCKED_NOTE } from '@/components/after/AfterScreens';
import { ticketOpen } from '@/components/onboarding/StoryExtras';
import { AFTER_DAYS } from './after';
import { DAY11 } from './day11';
import { DAY10, DAY8, DAY9, M_END } from './outer';
import { SCENE_DAY } from './sceneDays';
import { labelIndex, type Step } from './script';
import { STORIES, STORIES_NEW_HOMES } from './stories';

const says = (steps: Step[]) => steps.flatMap((s) => (s.t === 'say' ? [`${s.who}「${s.text}」`] : []));
const scenes = (steps: Step[]) => steps.flatMap((s) => (s.t === 'scene' ? [s.id] : []));
const notes = (steps: Step[]) => steps.flatMap((s) => (s.t === 'notice' ? [s.text] : []));

describe('M-R341: days 8–10 are the outer planets, before becoming Obolo Order; day 11 is the Eclipse', () => {
  it('the order: 8 Pluto, 9 Neptune, 10 Uranus, 11 the Sun (with the end, M-END, after the Eclipse)', () => {
    expect(scenes(STORIES[8].steps)).toEqual(['M-PLUTO-S001', 'M-PLUTO-S002']);
    expect(scenes(STORIES[9].steps)).toEqual(['M-NEPTUNE-S001', 'M-NEPTUNE-S002']);
    expect(scenes(STORIES[10].steps)).toEqual(['M-URANUS-S001', 'M-URANUS-S002']);
    expect(scenes(STORIES[11].steps).slice(0, 1)).toEqual(['D08-S001']);
    expect(scenes(STORIES[11].steps).slice(-2)).toEqual(['D08-S011', 'M-END-S001']);
    expect(STORIES[11].steps).toBe(DAY11);
    // one version of these days for both states of the planets' switch
    for (const d of [8, 9, 10, 11]) expect(STORIES_NEW_HOMES[d].steps).toBe(STORIES[d].steps);
    expect([SCENE_DAY('M-PLUTO-S002'), SCENE_DAY('M-NEPTUNE-S001'), SCENE_DAY('M-URANUS-S002'), SCENE_DAY('M-END-S001'), SCENE_DAY('D08-S003'), SCENE_DAY('D07V-S004')]).toEqual([8, 9, 10, 11, 11, 7]);
  });

  for (const [day, steps] of [[8, DAY8], [9, DAY9], [10, DAY10], [11, DAY11]] as const) {
    it(`day ${day}: labels resolve, pictures, sprites and music exist, the caption says the day, ends with end`, () => {
      for (const s of steps) {
        if (s.t === 'goto') expect(() => labelIndex(steps, s.id)).not.toThrow();
        if (s.t === 'branch') for (const l of [...Object.values(s.cases), s.otherwise]) expect(() => labelIndex(steps, l)).not.toThrow();
        if (s.t === 'choice') for (const o of s.options) if (o.goto) expect(() => labelIndex(steps, o.goto!)).not.toThrow();
        if (s.t === 'still' || s.t === 'arrive') expect(existsSync(`public/onboarding/${s.image}.jpg`), s.image).toBe(true);
        if (s.t === 'sprite') for (const n of [s.image ?? []].flat()) if (n && !n.startsWith('@')) expect(existsSync(`public/onboarding/${n}.webp`), n).toBe(true);
        if (s.t === 'bgm' && s.track) expect(existsSync(`public/onboarding/bgm-${s.track}.m4a`), s.track).toBe(true);
      }
      const ls = steps.flatMap((s) => (s.t === 'label' ? [s.id] : []));
      expect(new Set(ls).size).toBe(ls.length);
      expect(steps.find((s) => s.t === 'caption')).toEqual({ t: 'caption', text: `${day}日目` });
      expect(steps[steps.length - 1]).toEqual({ t: 'end' });
    });
  }

  it('the residents: クロコパトラ on Pluto, オニモンク on Neptune, MONBAN on Uranus — and the mornings are KIMORIN’s on the Moon', () => {
    expect(says(DAY8)).toContain('クロコパトラ「冥王星は、物語の星。」');
    expect(says(DAY8).some((l) => l.startsWith('たこ焼きブラザー'))).toBe(false);
    expect(says(DAY9)).toContain('オニモンク「ようこそ、ようこそ。わしは、オニモンク。この都の、遊びの番人じゃ。」');
    expect(says(DAY10)).toContain('MONBAN「天王星は…俺の…受け持ちだ…。」');
    expect(says(DAY10).some((l) => l.startsWith('クロコパトラ'))).toBe(false);
    expect(says(DAY8).filter((l) => !l.includes('母に言いましたが'))[0]).toBe('KIMORIN「おはようございます。……今日は、冥王星だそうです。」');
    expect(says(DAY9).filter((l) => !l.includes('母に言いましたが'))[0]).toBe('KIMORIN「おはようございます。……今日は、海王星。海の底だそうです。」');
    expect(says(DAY10).filter((l) => !l.includes('母に言いましたが'))[0]).toBe('KIMORIN「おはようございます。……今日は、天王星。最後の星だそうです。」');
    for (const d of [DAY8, DAY9, DAY10]) expect(d.find((s) => s.t === 'still')).toMatchObject({ image: 's/moon-temple' });
    // the next day is told: Neptune after Pluto, Earth after Uranus
    expect(says(DAY8)).toContain('クロコパトラ「次は、海王星ですわ。」');
    expect(says(DAY10)).toContain('MONBAN「明日は…地球へ帰れ…。OBOLONが…待っている…。」');
    expect(notes(DAY10)).toContain('明日は、地球へ帰ります。天王星で、グッズを作ってお店に並べる、ダチのお店やobolo商店を見て回ることは、このあとも自由にできます');
  });

  it('the Eclipse day starts on Uranus with MONBAN (not Venus), and ends with the letter from the HQ', () => {
    expect(DAY11.find((s) => s.t === 'caption')).toEqual({ t: 'caption', text: '11日目' });
    expect(says(DAY11)[0]).toBe('MONBAN「起きたか…。星めぐりは…ひと巡りだ…。」');
    expect(says(DAY11).some((l) => l.startsWith('ボスG'))).toBe(false);
    expect(says(DAY11)).toContain('OBOLON「これで、、、どの星へも、好きな順で、行ける。」');
    expect(says(DAY11)).not.toContain('OBOLON「錠の星は、、、一つずつ、開く。」');
    const end = DAY11.findIndex((s) => s.t === 'scene' && s.id === 'M-END-S001');
    // the end plays only after the Eclipse: a resident's day ends (its own 'end') before it
    const stay = DAY11.findIndex((s) => s.t === 'choice' && s.key === 'f_d08_decide');
    const pay = labelIndex(DAY11, 'pay');
    expect(DAY11.slice(stay, pay).some((s) => s.t === 'end')).toBe(true);
    expect(pay).toBeLessThan(end);
    expect(DAY11.slice(end + 1, end + 1 + M_END.length - 1)).toEqual(M_END.slice(1));
    expect(notes(M_END).slice(-1)[0]).toContain('どの星へも、好きな順で行けます');
  });

  it('the star map: a lock comes off each morning (Pluto, then Neptune, then Uranus); all gold on the Eclipse day', () => {
    expect(DAY8.find((s) => s.t === 'ticket')).toMatchObject({ flip: true, unlock: 'pluto' });
    expect(DAY9.find((s) => s.t === 'ticket')).toMatchObject({ flip: true, unlock: 'neptune' });
    expect(DAY10.find((s) => s.t === 'ticket')).toMatchObject({ flip: true, unlock: 'uranus' });
    expect(DAY11.filter((s) => s.t === 'ticket' && s.flip).every((s) => s.t === 'ticket' && s.unlock === 'all')).toBe(true);
    expect(ticketOpen(undefined)).toEqual({ open: [], fresh: null });
    expect(ticketOpen('pluto')).toEqual({ open: ['pluto'], fresh: 'pluto' });
    expect(ticketOpen('neptune')).toEqual({ open: ['pluto', 'neptune'], fresh: 'neptune' });
    expect(ticketOpen('uranus')).toEqual({ open: ['pluto', 'neptune', 'uranus'], fresh: 'uranus' });
    expect(ticketOpen('all')).toEqual({ open: ['pluto', 'neptune', 'uranus'], fresh: null });
  });

  it('Uranus: goods are made and shown by everyone; ordering the real thing waits for Obolo Order (〔購入〕 with a lock)', () => {
    expect(DAY10.some((s) => s.t === 'l2' && s.what === 'm-goods')).toBe(true);
    expect(DAY10.some((s) => s.t === 'l2' && s.what === 'm-publish-goods')).toBe(true);
    expect(DAY10.some((s) => s.t === 'l2' && s.what === 'm-shop-locked')).toBe(true);
    expect(DAY10.some((s) => s.t === 'l2' && s.what === 'm-shop')).toBe(false);
    expect(says(DAY10)).toContain('MONBAN「マナじゃない…本物の、お金だ…。だから…注文できるのは…Obolo Orderになってからだ…。」');
    expect(SHOP_LOCKED_NOTE).toBe('本物のグッズの注文は、Obolo Orderになってからできます。見て回るのと、お店に並べるのは、いまもできます');
    // the days after joining of before keep the open 〔購入〕 (their members are Obolo Order)
    expect(AFTER_DAYS[0].some((s) => s.t === 'l2' && s.what === 'm-shop')).toBe(true);
  });

  it('the 〔推しになった〕 notes of days 8–10 wait for the planet’s new home (switch off in this build: none)', () => {
    for (const d of [DAY8, DAY9, DAY10]) expect(notes(d).some((t) => t.includes('推しになった'))).toBe(false);
  });
});

describe('M-R341: who may go where, and the accounts of the eight-day journey', () => {
  it('the three planets open on their day for everyone — an Obolo Order or not; done journeys have all three', () => {
    expect(planetLockOf('pluto', 7)).toEqual({ locked: true, note: '旅の8日目にひらく' });
    expect(planetLockOf('pluto', 8).locked).toBe(false);
    expect(planetLockOf('neptune', 8)).toEqual({ locked: true, note: '旅の9日目にひらく' });
    expect(planetLockOf('uranus', 9)).toEqual({ locked: true, note: '旅の10日目にひらく' });
    expect(planetLockOf('uranus', 10).locked).toBe(false);
    for (const p of ['pluto', 'neptune', 'uranus', 'venus', 'saturn']) {
      expect(planetLockOf(p, JOURNEY_PAYMENT).locked).toBe(false);
      expect(planetLockOf(p, JOURNEY_DONE).locked).toBe(false);
    }
    expect(planetIsOpen('venus', 3)).toBe(true);
  });
  it('the days after joining stay only for the accounts migration 0064 marked; everyone else has none', () => {
    expect(lap2Applies({})).toBe(false);
    expect(lap2Done({})).toBe(LAP2_DONE);
    expect(lap2Done({ 'd10.f_m_uranus_done': 'true' })).toBe(LAP2_DONE);
    const before = { [JOURNEY_EIGHT_KEY]: '1' };
    expect(lap2Applies(before)).toBe(true);
    expect(lap2Done(before)).toBe(0);
    expect(lap2Done({ ...before, 'l2.done': '2', 'l2.at': '2026-11-20T00:00:00Z' })).toBe(2);
    // their days are the ones of before, word for word (天王星 with クロコパトラ, 冥王星 with たこ焼きブラザー, 海王星 + the end)
    expect(scenes(AFTER_DAYS[0])).toEqual(['M-URANUS-S001', 'M-URANUS-S002']);
    expect(says(AFTER_DAYS[0])).toContain('クロコパトラ「あら。ようこそ、{neo}。わたくし、クロコパトラ。この町のマダムですわ。」');
    expect(says(AFTER_DAYS[1])).toContain('たこ焼きブラザー「冥王星は、物語の星だZE。」');
  });
});
