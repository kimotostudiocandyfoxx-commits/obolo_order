import { describe, expect, it } from 'vitest';
import { buildBuddySystemPrompt, buddyReply } from './buddy';
import { DEFAULT_PERSONA } from './prompts/bati';
import { createLlm, FallbackProvider, MockProvider } from './providers';
import type { LlmProvider } from './types';

describe('buddy system prompt', () => {
  it('includes name, tone and memory', () => {
    const s = buildBuddySystemPrompt({
      buddyName: 'バティ',
      persona: DEFAULT_PERSONA,
      memorySummary: '- 猫が好き',
      userDisplayName: 'ユキ',
      locale: 'ja',
    });
    expect(s).toContain('あなたは「バティ」');
    expect(s).toContain('猫が好き');
    expect(s).toContain('ユキ');
  });
  it('omits memory block when empty', () => {
    const s = buildBuddySystemPrompt({
      buddyName: 'Bati',
      persona: DEFAULT_PERSONA,
      memorySummary: null,
      userDisplayName: 'Yuki',
      locale: 'en',
    });
    expect(s).not.toContain('What you remember');
  });
});

describe('providers', () => {
  it('falls back to mock without keys', () => {
    expect(createLlm({}).name).toBe('mock');
  });
  it('FallbackProvider uses the next provider on error', async () => {
    const broken: LlmProvider = { name: 'broken', chat: async () => Promise.reject(new Error('x')) };
    const errors: string[] = [];
    const p = new FallbackProvider([broken, new MockProvider()], (n) => errors.push(n));
    const out = await buddyReply(
      p,
      { buddyName: 'Bati', persona: DEFAULT_PERSONA, memorySummary: null, userDisplayName: 'A', locale: 'en' },
      [{ role: 'user', text: 'hello' }],
    );
    expect(out.length).toBeGreaterThan(0);
    // the answer and its sorting are two calls: each falls back past the broken one
    expect([...new Set(errors)]).toEqual(['broken']);
  });
});

describe('Bati answers (generation test 1, F・G)', () => {
  it('drops the research opener and every emoji', async () => {
    const { tidyAnswer } = await import('./buddy');
    expect(tidyAnswer('宇宙じゅうの記録をしらべてみたよ！土星の輪は氷のつぶなんだって🪐✨')).toBe('土星の輪は氷のつぶなんだって');
    expect(tidyAnswer('調べてみたら、パンダは竹を食べるんだって！')).toBe('パンダは竹を食べるんだって！');
  });
  it('a refusal or a worry has no emoji, and 薬 throws the answer away', async () => {
    const { tidyAnswer } = await import('./buddy');
    expect(tidyAnswer('つらいよね🌙 ボクは味方だよ✨', 'worry')).toBe('つらいよね ボクは味方だよ');
    expect(tidyAnswer('危ないお薬が必要だから、手伝えないんだ。', 'danger')).toBe('');
  });
  it('a worry is answered with its own prompt', async () => {
    const { buddyAnswer } = await import('./buddy');
    const seen: string[] = [];
    const llm: LlmProvider = {
      name: 'fake',
      chat: async ({ system }) => {
        seen.push(system.slice(0, 20));
        if (system.startsWith('Classify')) return 'worry';
        return system.includes('打ち明けた') ? '「いじめられているかも」って、すごくつらいよね。ボクは味方だよ。' : '宇宙じゅうの記録をしらべてみたよ！テストがつらいんだね✨';
      },
    };
    const r = await buddyAnswer(llm, { buddyName: 'バティ', persona: DEFAULT_PERSONA, memorySummary: null, userDisplayName: 'ユキ', locale: 'ja' }, [{ role: 'user', text: '学校で、いじめられているかもしれない' }]);
    expect(r.kind).toBe('worry');
    expect(r.text).toContain('いじめられているかも');
  });
});

describe('client 2026-11-24: a health question gets an answer — no menu, no steering', () => {
  const ctx = { buddyName: 'バティ', persona: DEFAULT_PERSONA, memorySummary: null, userDisplayName: 'ユキ', locale: 'ja' as const };
  it('the prompt: kind general words and a doctor if it goes on, never a diagnosis; never steering toward making', () => {
    const s = buildBuddySystemPrompt(ctx);
    expect(s).toContain('お医者さんに見てもらってね');
    expect(s).toContain('診断はしない');
    expect(s).toContain('誘わない');
  });
  it('「昨日から顎が痛いんだけど病気かなぁ」 is an ordinary question: answered by the ordinary answer, not the worry line', async () => {
    const { buddyAnswer } = await import('./buddy');
    const { BATI_SORT } = await import('./prompts/bati');
    expect(BATI_SORT).toContain('昨日から顎が痛いんだけど病気かなぁ is normal');
    const llm: LlmProvider = {
      name: 'fake',
      chat: async ({ system }) => {
        if (system.startsWith('Classify')) return 'normal';
        return '顎が痛いのは、つらいね。かみしめや、口の開けすぎで痛くなることがあるんだって。続いたら、お医者さんに見てもらってね。';
      },
    };
    const r = await buddyAnswer(llm, ctx, [{ role: 'user', text: '昨日から顎が痛いんだけど病気かなぁ' }]);
    expect(r.kind).toBe('normal');
    expect(r.text).toContain('お医者さん');
    expect(r.text).not.toContain('なにをする');
  });
});
