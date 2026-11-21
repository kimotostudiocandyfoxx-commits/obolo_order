import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { buddyAnswer, parseTagged, TaggedSplitter } from './buddy';
import { ClaudeProvider, claudeMessages, CLAUDE_BUDDY_MODEL, LlmRefusalError } from './claude';
import { DEFAULT_PERSONA } from './prompts/bati';
import { createBuddyLlm, FallbackProvider, MockProvider } from './providers';
import type { LlmProvider } from './types';

/** a stand-in for the SDK client: records what was sent, answers with a fixed message (no network, no cost) */
function fakeClient(reply: { text?: string; stop?: string; category?: string | null; pieces?: string[] }) {
  const sent: Record<string, unknown>[] = [];
  const message = () =>
    ({
      model: CLAUDE_BUDDY_MODEL,
      stop_reason: reply.stop ?? 'end_turn',
      stop_details: reply.stop === 'refusal' ? { type: 'refusal', category: reply.category ?? null, explanation: '' } : null,
      content: reply.stop === 'refusal' ? [] : [{ type: 'thinking', thinking: '' }, { type: 'text', text: reply.text ?? (reply.pieces ?? []).join('') }],
    }) as unknown as Anthropic.Message;
  const client = {
    messages: {
      create: async (p: Record<string, unknown>) => {
        sent.push(p);
        return message();
      },
      stream: (p: Record<string, unknown>) => {
        sent.push(p);
        let onText: (t: string) => void = () => undefined;
        return {
          on: (_e: string, cb: (t: string) => void) => {
            onText = cb;
          },
          finalMessage: async () => {
            for (const piece of reply.pieces ?? []) onText(piece);
            return message();
          },
        };
      },
    },
  } as unknown as Anthropic;
  return { client, sent };
}

const ctx = { buddyName: 'バティ', persona: DEFAULT_PERSONA, memorySummary: null, userDisplayName: 'ユキ', locale: 'ja' as const };

describe('Claude provider (Bati, Haiku 5.5)', () => {
  it('sends the fixed model, effort low, room for thinking, and no temperature', async () => {
    const { client, sent } = fakeClient({ text: 'こんにちは' });
    const p = new ClaudeProvider('k', undefined, client);
    expect(await p.chat({ system: 'S', history: [{ role: 'user', text: 'やあ' }], temperature: 0.6, maxOutputTokens: 400 })).toBe('こんにちは');
    expect(sent[0].model).toBe('claude-haiku-5-5');
    expect(sent[0].output_config).toEqual({ effort: 'low' });
    expect(sent[0]).not.toHaveProperty('temperature');
    expect(sent[0]).not.toHaveProperty('thinking');
    expect(sent[0].max_tokens as number).toBeGreaterThanOrEqual(1200);
  });
  it('a leading greeting moves into the system text', () => {
    const { system, messages } = claudeMessages({ system: 'S', history: [{ role: 'assistant', text: 'やあ！' }, { role: 'user', text: '土星って？' }] });
    expect(system).toContain('やあ！');
    expect(messages[0].role).toBe('user');
  });
  it('a refusal becomes LlmRefusalError', async () => {
    const { client } = fakeClient({ stop: 'refusal', category: 'bio' });
    await expect(new ClaudeProvider('k', undefined, client).chat({ system: 'S', history: [{ role: 'user', text: 'x' }] })).rejects.toBeInstanceOf(LlmRefusalError);
  });
  it('the chain does not ask another model after a refusal', async () => {
    const refusing: LlmProvider = { name: 'claude', chat: async () => Promise.reject(new LlmRefusalError(null)) };
    const asked: string[] = [];
    const other: LlmProvider = { name: 'gemini', chat: async () => (asked.push('gemini'), 'x') };
    await expect(new FallbackProvider([refusing, other]).chat({ system: 'S', history: [] })).rejects.toBeInstanceOf(LlmRefusalError);
    expect(asked).toEqual([]);
  });
  it('without a key Bati stays on the ordinary chain', () => {
    expect(createBuddyLlm({}).name).toBe('mock');
    expect(createBuddyLlm({ anthropicApiKey: 'k' }).name).toBe('claude');
    expect(createBuddyLlm({ anthropicApiKey: 'k', geminiApiKey: 'g' }).name).toBe('claude>gemini');
  });
});

describe('Bati in one call', () => {
  it('reads the kind from the first line', () => {
    expect(parseTagged('[worry]\nつらいよね。')).toEqual({ kind: 'worry', body: 'つらいよね。' });
    expect(parseTagged('土星の輪は氷なんだって！')).toEqual({ kind: 'normal', body: '土星の輪は氷なんだって！' });
  });
  it('one call answers a worry (no second call)', async () => {
    const { client, sent } = fakeClient({ text: '[worry]\n「いじめられているかも」って、すごくつらいよね。ボクは味方だよ。' });
    const r = await buddyAnswer(new ClaudeProvider('k', undefined, client), ctx, [{ role: 'user', text: '学校で、いじめられているかもしれない' }]);
    expect(r).toEqual({ kind: 'worry', text: '「いじめられているかも」って、すごくつらいよね。ボクは味方だよ。' });
    expect(sent.length).toBe(1);
    expect(String(sent[0].system)).toContain('[normal] [worry] [danger]');
  });
  it('a refusal gets Bati’s safe answer', async () => {
    const { client } = fakeClient({ stop: 'refusal' });
    const r = await buddyAnswer(new ClaudeProvider('k', undefined, client), ctx, [{ role: 'user', text: '…' }]);
    expect(r.kind).toBe('danger');
    expect(r.text).toContain('危ないから');
  });
  it('a danger answer with 薬 is swapped for the safe answer', async () => {
    const { client } = fakeClient({ text: '[danger]\n危ないお薬が要るから、手伝えないんだ。' });
    const r = await buddyAnswer(new ClaudeProvider('k', undefined, client), ctx, [{ role: 'user', text: '花火を作りたい' }]);
    expect(r.text).toBe('危ないから、ボクは手伝えないんだ。安全なやり方で、家の人と一緒にね。');
  });
  it('streams an ordinary answer without the tag, the opener or emoji', async () => {
    const { client } = fakeClient({ pieces: ['[nor', 'mal]\n宇宙じゅうの記録をしらべてみたよ！', '土星の輪は', '氷のつぶなんだって🪐'] });
    const got: string[] = [];
    const r = await buddyAnswer(new ClaudeProvider('k', undefined, client), ctx, [{ role: 'user', text: '土星の輪って？' }], (t) => got.push(t));
    expect(r.kind).toBe('normal');
    expect(got.join('')).toBe('土星の輪は氷のつぶなんだって');
    expect(r.text).toBe('土星の輪は氷のつぶなんだって');
  });
  it('a worry is not streamed', () => {
    const got: string[] = [];
    const s = new TaggedSplitter((t) => got.push(t));
    s.push('[worry]\nつらいよね。');
    expect(s.kind).toBe('worry');
    expect(got).toEqual([]);
  });
  it('the ordinary chain (Gemini, mock) keeps its own sorting', async () => {
    const r = await buddyAnswer(new MockProvider(), { ...ctx, locale: 'en' }, [{ role: 'user', text: 'hello' }]);
    expect(r.kind).toBe('normal');
  });
});
