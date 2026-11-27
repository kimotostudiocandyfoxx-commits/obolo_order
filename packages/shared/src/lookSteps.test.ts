import { describe, expect, it } from 'vitest';
import { afterLookStep, BATI_BIRTH_MODEL, canLookStep, eggMark, EMPTY_LOOK_STEPS, foodNameByRules, LOOK_STEP_MAX, LOOK_STEP_MODEL, LookStepBody, lookStepChoices, lookStepsLeft, lookStepsMana, lookStepView, type LookStepState } from './lookSteps';
import { CUT_CHECK_USD, DEFAULT_COST_RATES, estimateJpy, MAKE_COST, MAKE_COST_ESTIMATE, manaFor10, pictureUsd } from './manaPrice';

describe('the step counter (進化 / 変身 あと◯回)', () => {
  it('counts down from 8 and stops at 0', () => {
    expect(LOOK_STEP_MAX).toBe(8);
    let s: LookStepState = EMPTY_LOOK_STEPS;
    const left: number[] = [lookStepsLeft(s.used)];
    for (let k = 0; k < LOOK_STEP_MAX; k++) {
      expect(canLookStep(s)).toBe(true);
      s = afterLookStep(s, `u${k}`);
      left.push(lookStepsLeft(s.used));
    }
    expect(left).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 0]);
    expect(s).toEqual({ used: 8, fixed: false, url: 'u7' });
    expect(canLookStep(s)).toBe(false);
    expect(() => afterLookStep(s, 'u8')).toThrow('LOOK_STEPS_DONE');
  });
  it('a decided round takes no more steps', () => {
    expect(canLookStep({ used: 2, fixed: true })).toBe(false);
    expect(() => afterLookStep({ used: 2, fixed: true }, 'x')).toThrow();
  });
  it('odd numbers never give more than 8 or less than 0', () => {
    expect(lookStepsLeft(-3)).toBe(8);
    expect(lookStepsLeft(99)).toBe(0);
    expect(lookStepsLeft(Number.NaN)).toBe(8);
    expect(lookStepView({ used: 3, fixed: false }, 'worn')).toEqual({ used: 3, left: 5, fixed: false, url: 'worn' });
    expect(lookStepView({ used: 3, fixed: false, url: 'now' }, 'worn').url).toBe('now');
  });
  it('the two choices stay after every step; after the 8th only deciding is left', () => {
    expect(lookStepChoices({ used: 0, fixed: false })).toEqual({ decide: false, again: false, last: false });
    for (let u = 1; u < 8; u++) expect(lookStepChoices({ used: u, fixed: false })).toEqual({ decide: true, again: true, last: false });
    expect(lookStepChoices({ used: 8, fixed: false })).toEqual({ decide: true, again: false, last: true });
    expect(lookStepChoices({ used: 4, fixed: true })).toEqual({ decide: false, again: false, last: false });
  });
});

describe('the mana of the steps', () => {
  it('one step is 0.6 mana on FLUX.2 klein 4B — the picture, the word check and the cut-out check — by the price rule', () => {
    expect(LOOK_STEP_MODEL).toBe('runware:400@4');
    expect(MAKE_COST.lookStep).toBe(0.6);
    expect(MAKE_COST_ESTIMATE.lookStep.usd).toBeCloseTo(pictureUsd(LOOK_STEP_MODEL, true) + 0.0005 + CUT_CHECK_USD, 9);
    expect(MAKE_COST.lookStep).toBe(manaFor10(estimateJpy(MAKE_COST_ESTIMATE.lookStep, DEFAULT_COST_RATES)));
    expect(lookStepsMana(8, MAKE_COST.lookStep)).toBe(4.8);
    expect(lookStepsMana(3, MAKE_COST.lookStep)).toBe(1.8);
  });
  it('the four first pictures, the birth picture and the confirmation come from their models’ costs', () => {
    expect(BATI_BIRTH_MODEL).toBe('bytedance:seedream@5.0-flash');
    for (const k of ['lookPick4', 'batiBirth', 'profileLook'] as const) expect(MAKE_COST[k]).toBe(manaFor10(estimateJpy(MAKE_COST_ESTIMATE[k], DEFAULT_COST_RATES)));
    // four pictures, each cut out and checked
    expect(MAKE_COST.lookPick4).toBe(2.2);
    expect(MAKE_COST_ESTIMATE.lookPick4.usd).toBeCloseTo(4 * (pictureUsd('runware:400@4', true) + CUT_CHECK_USD) + 0.0005, 9);
    expect(MAKE_COST.batiBirth).toBe(3.6);
    expect(MAKE_COST.profileLook).toBe(28.1);
  });
  it('the whole of day 2 fits the 88-mana gem', () => {
    const all = MAKE_COST.batiBirth + 8 * MAKE_COST.lookStep + MAKE_COST.lookPick4 + 8 * MAKE_COST.lookStep + MAKE_COST.profileLook;
    expect(Math.round(all * 10) / 10).toBe(43.5);
    expect(all).toBeLessThan(88);
  });
});

describe('♀ / ♂ by the egg', () => {
  it('the moon egg is ♀, the sun egg is ♂', () => {
    expect(eggMark('moon')).toBe('♀');
    expect(eggMark('sun')).toBe('♂');
    // the old 地球と月 egg reads as the moon; nothing chosen yet reads as the moon too
    expect(eggMark('earth')).toBe('♀');
    expect(eggMark(undefined)).toBe('♀');
  });
});

describe('the food’s name out of the sentence as said (the rules’ fallback)', () => {
  it.each([
    ['ゼロ時零分カレーだよ。', 'カレー'],
    ['カレー', 'カレー'],
    ['えっと、ラーメンが好きです', 'ラーメン'],
    ['好きな食べ物はいちごかな', 'いちご'],
    ['わたしはおにぎり！', 'おにぎり'],
    ['たこ焼き', 'たこ焼き'],
    ['お寿司だよ', 'お寿司'],
    ['ハンバーグです。', 'ハンバーグ'],
  ])('%s → %s', (said, name) => expect(foodNameByRules(said)).toBe(name));
  it('never empty', () => {
    expect(foodNameByRules('だよ')).toBe('だよ');
    expect(foodNameByRules('  プリン  ')).toBe('プリン');
  });
});

describe('the step body', () => {
  it('words, a reference picture, or both', () => {
    expect(LookStepBody.parse({ who: 'bati', wish: ' 翼を生やして ' })).toEqual({ who: 'bati', wish: '翼を生やして' });
    expect(LookStepBody.parse({ who: 'self', image: { mime: 'image/jpeg', data: 'x'.repeat(200) } }).wish).toBe('');
    expect(() => LookStepBody.parse({ who: 'kimorin', wish: 'x' })).toThrow();
  });
});
