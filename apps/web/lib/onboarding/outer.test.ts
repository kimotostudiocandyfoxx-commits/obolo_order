import { JOURNEY_DONE, JOURNEY_EIGHT_KEY, JOURNEY_PAYMENT, LAP2_DONE, lap2Applies, lap2Done, planetIsOpen } from '@obolo/shared';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planetLockOf } from '@/components/PlanetLock';
import { SHOP_LOCKED_NOTE } from '@/components/after/AfterScreens';
import { STAMPS, stampsOn, ticketOpen } from '@/components/onboarding/StoryExtras';
import { AFTER_DAYS } from './after';
import { DAY11 } from './day11';
import { DAY10, DAY10_BEFORE, DAY10_NEW_HOME, DAY8, DAY8_BEFORE, DAY8_NEW_HOME, DAY9, DAY9_BEFORE, DAY9_NEW_HOME, HOME_NOTES, M_END } from './outer';
import { TICKET } from '@/components/story/Ticket';
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
    // switch off (this build): the stills-versions; the Eclipse day has one version
    expect([STORIES[8].steps, STORIES[9].steps, STORIES[10].steps]).toEqual([DAY8_BEFORE, DAY9_BEFORE, DAY10_BEFORE]);
    expect([DAY8, DAY9, DAY10]).toEqual([DAY8_BEFORE, DAY9_BEFORE, DAY10_BEFORE]);
    expect([STORIES_NEW_HOMES[8].steps, STORIES_NEW_HOMES[9].steps, STORIES_NEW_HOMES[10].steps]).toEqual([DAY8_NEW_HOME, DAY9_NEW_HOME, DAY10_NEW_HOME]);
    expect(STORIES_NEW_HOMES[11].steps).toBe(STORIES[11].steps);
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
    // M-R343: someone who became Obolo Order early has 〔購入〕 without the lock and MONBAN's other line
    const early = DAY10.find((s) => s.t === 'branch' && s.key === 'f_join_early');
    expect(early).toMatchObject({ cases: { true: 'u-look-order' }, otherwise: 'u-look-lock' });
    const order = DAY10.slice(labelIndex(DAY10, 'u-look-order'), labelIndex(DAY10, 'u-skip'));
    expect(order.some((s) => s.t === 'l2' && s.what === 'm-shop')).toBe(true);
    expect(says(order)).toEqual(['MONBAN「お前は…もうOrderだ…。注文も…できる…。」']);
    const lock = DAY10.slice(labelIndex(DAY10, 'u-look-lock'), labelIndex(DAY10, 'u-look-order'));
    expect(lock.some((s) => s.t === 'l2' && s.what === 'm-shop-locked')).toBe(true);
    expect(lock.some((s) => s.t === 'l2' && s.what === 'm-shop')).toBe(false);
    expect(says(DAY10)).toContain('MONBAN「マナじゃない…本物の、お金だ…。だから…注文できるのは…Obolo Orderになってからだ…。」');
    expect(SHOP_LOCKED_NOTE).toBe('本物のグッズの注文は、Obolo Orderになってからできます。見て回るのと、お店に並べるのは、いまもできます');
    // the days after joining of before keep the open 〔購入〕 (their members are Obolo Order)
    expect(AFTER_DAYS[0].some((s) => s.t === 'l2' && s.what === 'm-shop')).toBe(true);
  });

  it('M-R343: the 〔推しになった〕 note and the arrival stamp are on both versions of days 8–10', () => {
    const who = ['クロコパトラ', 'オニモンク', 'MONBAN'];
    const planet = ['pluto', 'neptune', 'uranus'] as const;
    [[DAY8_BEFORE, DAY8_NEW_HOME], [DAY9_BEFORE, DAY9_NEW_HOME], [DAY10_BEFORE, DAY10_NEW_HOME]].forEach((pair, k) => {
      for (const d of pair) {
        expect(notes(d).filter((t) => t === `${who[k]}が、{neo}の推しになった｜推しは、どの星でも、{neo}の島に遊びに来ます`)).toHaveLength(1);
        const st = d.findIndex((s) => s.t === 'ticket' && s.stamp === planet[k]);
        // pressed on arrival: after 〔〇〇に着いた〕, before the resident speaks
        expect(st).toBeGreaterThan(d.findIndex((s) => s.t === 'arrive'));
        expect(st).toBeLessThan(d.findIndex((s) => s.t === 'say' && s.who === (k === 2 ? 'MONBAN' : who[k])));
      }
    });
    expect(stampsOn(7)).toEqual(['saturn', 'jupiter', 'mercury', 'mars']);
    expect(stampsOn(8)).toEqual(['saturn', 'jupiter', 'mercury', 'mars', 'venus']);
    expect(stampsOn(10)).toEqual(['saturn', 'jupiter', 'mercury', 'mars', 'venus', 'pluto', 'neptune']);
    expect(stampsOn(11)).toHaveLength(8);
    expect(STAMPS.map((s) => s.id)).toEqual(['saturn', 'jupiter', 'mercury', 'mars', 'venus', 'pluto', 'neptune', 'uranus']);
  });

  it('M-R343: days 8–10 on the new homes — the resident’s place, then {neo}’s own place (door); the same lines as the stills-version', () => {
    const homes = (d: Step[]) => d.flatMap((s) => (s.t === 'home' ? [`${s.planet}:${s.place}:${s.until ?? 'next'}`] : []));
    expect(homes(DAY8_NEW_HOME)).toEqual(['pluto:host:next', 'pluto:neo:door']);
    expect(homes(DAY9_NEW_HOME)).toEqual(['neptune:host:next', 'neptune:neo:door']);
    expect(homes(DAY10_NEW_HOME)).toEqual(['uranus:host:next', 'uranus:neo:door']);
    for (const [before, now] of [[DAY8_BEFORE, DAY8_NEW_HOME], [DAY9_BEFORE, DAY9_NEW_HOME], [DAY10_BEFORE, DAY10_NEW_HOME]]) {
      expect(homes(before)).toEqual([]);
      expect(says(now)).toEqual(says(before));
      expect(scenes(now)).toEqual(scenes(before));
      const ls = now.flatMap((s) => (s.t === 'label' ? [s.id] : []));
      expect(new Set(ls).size).toBe(ls.length);
      expect(now[now.length - 1]).toEqual({ t: 'end' });
    }
    // the resident's place comes with the line that points at it, {neo}'s with the line that names it
    const at = (d: Step[], k: number) => d.slice(0, d.findIndex((s) => s.t === 'home' && s.place === (k ? 'neo' : 'host'))).reverse().find((s) => s.t === 'say');
    expect(at(DAY8_NEW_HOME, 0)).toMatchObject({ text: '空の灯りは、ぜんぶ、どなたかの物語ですのよ。' });
    expect(at(DAY8_NEW_HOME, 1)).toMatchObject({ text: 'こちらが、{neo}の図書館。公開なさった本が、ここに並びますわ。お書きになるのは、月の工房ですわ。' });
    expect(at(DAY10_NEW_HOME, 1)).toMatchObject({ who: 'MONBAN', text: 'お前の店だ…。形を選んで…絵をのせて…ハンドルを回すだけだ…。作るのは…月の工房だ…。' });
    // Neptune has no line that names {neo}'s arcade before it is made: its place opens after the making, before the goodbye
    const n = DAY9_NEW_HOME.findIndex((s) => s.t === 'home' && s.place === 'neo');
    expect(DAY9_NEW_HOME[n]).toMatchObject({ sent: { key: 'f_m_neptune_publish', value: 'send' } });
    expect(DAY9_NEW_HOME.slice(n).find((s) => s.t === 'say')).toMatchObject({ who: 'オニモンク', text: 'よう遊んだのう。明日は、天王星じゃ。最後の星じゃな。' });
    // the note about the screens of before (〔本の空〕〔my図書館〕, the balloon) is the stills-version's only
    expect(notes(DAY8_BEFORE).some((t) => t.includes('〔本の空〕〔my図書館〕'))).toBe(true);
    expect(notes(DAY8_NEW_HOME).some((t) => t.includes('〔本の空〕〔my図書館〕'))).toBe(false);
  });

  it('days 8–10 on the new homes carry the notes days 4–7 have: who comes around, the pinch and ♡, the door — right before {neo}’s place', () => {
    for (const [planet, now, before] of [['pluto', DAY8_NEW_HOME, DAY8_BEFORE], ['neptune', DAY9_NEW_HOME, DAY9_BEFORE], ['uranus', DAY10_NEW_HOME, DAY10_BEFORE]] as const) {
      const at = now.findIndex((s) => s.t === 'home' && s.place === 'neo');
      expect(now.slice(at - 3, at)).toEqual(HOME_NOTES[planet].map((text) => ({ t: 'notice', text })));
      const [around, sky, door] = HOME_NOTES[planet];
      expect(around).toContain('ダチと推しの');
      expect(around).toContain('88時間');
      expect(sky).toMatch(/^2本の指でつまむと、空から.+♡を押すと、/);
      expect(door).toMatch(/^\{neo\}の.+の扉をタップする$/);
      // the stills-version has no home to pinch or door to tap
      for (const t of HOME_NOTES[planet]) expect(notes(before)).not.toContain(t);
    }
  });

  it('D08-S011: the completion screen after the Eclipse day says the first journey is over; the other days have none', () => {
    expect(STORIES[11].doneText).toBe('最初の旅、おわり。ここから先は、どの星へも自由に');
    for (const d of [1, 2, 3, 7, 8, 9, 10]) expect(STORIES[d].doneText).toBeUndefined();
  });

  it('the ticket: the eight-slot picture, one table for its file, shape, slots and words', () => {
    expect(TICKET.art).toBe('/onboarding/s/ticket-8stars.jpg');
    expect(existsSync(`public${TICKET.art}`)).toBe(true);
    // the slots in the visiting order, left to right, evenly spaced along the bottom
    expect(TICKET.slots.map((s) => s.id)).toEqual(STAMPS.map((s) => s.id));
    const xs = TICKET.slots.map((s) => s.x);
    for (let k = 1; k < xs.length; k++) {
      expect(xs[k] - xs[k - 1]).toBeGreaterThan(9.5);
      expect(xs[k] - xs[k - 1]).toBeLessThan(11.5);
    }
    expect(TICKET.row.y).toBeGreaterThan(70);
    expect(TICKET.aspect).toBeGreaterThan(1.5);
  });

  it('M-R343: day 9 ends with オニモンク’s goodbye and the note that Uranus opens tomorrow', () => {
    expect(says(DAY9).slice(-1)).toEqual(['オニモンク「よう遊んだのう。明日は、天王星じゃ。最後の星じゃな。」']);
    expect(notes(DAY9).slice(-1)).toEqual(['天王星は、明日ひらきます。海王星で、ゲームを作って公開する、館を見て回ることは、このあとも自由にできます']);
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
