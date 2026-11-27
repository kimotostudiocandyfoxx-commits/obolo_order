import { describe, expect, it } from 'vitest';
import { batiCharacterPrompt, foodNameOf, lookPick4Prompt, lookStepPrompt } from './prompts/lookSteps';
import type { LlmProvider } from './types';

const llm = (answer: string | Error): LlmProvider => ({
  name: 'fake',
  chat: async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  },
});

describe('the food’s name out of the answer as said', () => {
  it('the model’s name when it is part of what was said', async () => {
    expect(await foodNameOf(llm('カレー'), 'ゼロ時零分カレーだよ。')).toBe('カレー');
    expect(await foodNameOf(llm('「チーズバーガー」。'), 'やっぱりチーズバーガーかな')).toBe('チーズバーガー');
  });
  it('an invented, empty or failed answer falls back on the rules', async () => {
    expect(await foodNameOf(llm('ラーメン'), 'ゼロ時零分カレーだよ。')).toBe('カレー');
    expect(await foodNameOf(llm('NONE'), 'カレーだよ')).toBe('カレー');
    expect(await foodNameOf(llm(new Error('down')), 'えっと、いちごが好きです')).toBe('いちご');
    expect(await foodNameOf(undefined, 'おにぎり')).toBe('おにぎり');
  });
});

describe('the pictures’ words', () => {
  it('a newborn {bati} is the food itself, 2D anime, with no gender sign drawn', () => {
    const p = batiCharacterPrompt('カレー');
    expect(p).toContain('IS "カレー" itself');
    expect(p).toContain('2D Japanese anime');
    expect(p).toContain('no gender sign');
    expect(p).not.toMatch(/♀|♂|\bowl\b|creature's body shape/);
  });
  it('a step changes only what was said, from the picture it has now', () => {
    const p = lookStepPrompt('bati', '翼を生やして', false, 'pure chroma-key blue (#0000FF)');
    expect(p).toContain('Edit the first image');
    expect(p).toContain('"翼を生やして"');
    expect(p).toContain('chroma-key blue');
    expect(lookStepPrompt('self', 'この翼みたいにして', true)).toContain('never copy a face');
  });
  it('the four first pictures differ in heads (2 / 3 / 5 / 7)', () => {
    const heads = [0, 1, 2, 3].map((i) => /exactly (\d) heads tall/.exec(lookPick4Prompt(i, { photo: true }))?.[1]);
    expect(heads).toEqual(['2', '3', '5', '7']);
    expect(lookPick4Prompt(0, { photo: false, wish: '銀色の髪の旅人' })).toContain('銀色の髪の旅人');
  });
});
