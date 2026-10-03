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
    expect(errors).toEqual(['broken']);
  });
});
