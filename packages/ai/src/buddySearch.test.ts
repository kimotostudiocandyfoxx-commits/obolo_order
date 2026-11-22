import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { buddyAnswer, parseTagged, readSort, TaggedSplitter } from './buddy';
import { ClaudeProvider, claudeSources, CLAUDE_BUDDY_MODEL, pickSources } from './claude';
import { batiChatPicturePrompt } from './images';
import { DEFAULT_PERSONA } from './prompts/bati';
import { FallbackProvider } from './providers';
import type { ChatRequest, LlmProvider } from './types';

const ctx = { buddyName: 'バティ', persona: DEFAULT_PERSONA, memorySummary: null, userDisplayName: 'ユキ', locale: 'ja' as const };

/** a stand-in SDK client: each create() answers with the next message in line (no network, no cost) */
function fakeClient(replies: { text?: string; stop?: string; content?: unknown[]; searches?: number }[]) {
  const sent: Record<string, unknown>[] = [];
  let k = 0;
  const message = (r: (typeof replies)[number]) =>
    ({
      model: CLAUDE_BUDDY_MODEL,
      stop_reason: r.stop ?? 'end_turn',
      stop_details: null,
      usage: { server_tool_use: { web_search_requests: r.searches ?? 0, web_fetch_requests: 0 } },
      content: r.content ?? [{ type: 'text', text: r.text ?? '', citations: null }],
    }) as unknown as Anthropic.Message;
  const client = {
    messages: {
      create: async (p: Record<string, unknown>) => (sent.push(p), message(replies[Math.min(k++, replies.length - 1)])),
      stream: (p: Record<string, unknown>) => {
        sent.push(p);
        const r = replies[Math.min(k++, replies.length - 1)];
        let onText: (t: string) => void = () => undefined;
        return {
          on: (_e: string, cb: (t: string) => void) => void (onText = cb),
          finalMessage: async () => (onText(r.text ?? ''), message(r)),
        };
      },
    },
  } as unknown as Anthropic;
  return { client, sent };
}

const searchedContent = [
  { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'はやぶさ2 今' } },
  {
    type: 'web_search_tool_result',
    tool_use_id: 's1',
    content: [
      { type: 'web_search_result', url: 'https://www.jaxa.jp/hayabusa2', title: 'はやぶさ2 | JAXA', encrypted_content: 'x', page_age: null },
      { type: 'web_search_result', url: 'https://ja.wikipedia.org/wiki/はやぶさ2', title: 'はやぶさ2 - Wikipedia', encrypted_content: 'x', page_age: null },
    ],
  },
  { type: 'text', text: 'はやぶさ2は、いまも別の小惑星に向かって飛んでいるんだって！', citations: [{ type: 'web_search_result_location', url: 'https://ja.wikipedia.org/wiki/はやぶさ2', title: 'はやぶさ2 - Wikipedia', cited_text: '…', encrypted_index: 'i' }] },
];

describe('Bati looks things up (M-R208)', () => {
  it('Claude: [search] → a second call with the web search tool; sources cited first, three at most', async () => {
    const { client, sent } = fakeClient([{ text: '[search]' }, { content: searchedContent, searches: 1 }]);
    const got: string[] = [];
    const r = await buddyAnswer(new ClaudeProvider('k', undefined, client), ctx, [{ role: 'user', text: 'はやぶさ2は、いまどこ？' }], (t) => got.push(t), { search: true, draw: true });
    expect(r.kind).toBe('normal');
    expect(r.text).toBe('はやぶさ2は、いまも別の小惑星に向かって飛んでいるんだって！');
    expect(r.sources?.map((s) => s.domain)).toEqual(['ja.wikipedia.org', 'jaxa.jp']);
    expect(r.searches).toBe(1);
    expect(got.join('')).toBe(r.text);
    expect(sent.length).toBe(2);
    expect(sent[0]).not.toHaveProperty('tools');
    expect(sent[1].tools).toEqual([{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }]);
  });
  it('a larger model gets the dynamic-filtering tool', async () => {
    const { client, sent } = fakeClient([{ content: searchedContent }]);
    await new ClaudeProvider('k', 'claude-sonnet-5-5', client).search({ system: 'S', history: [{ role: 'user', text: 'x' }] });
    expect((sent[0].tools as { type: string }[])[0].type).toBe('web_search_20260209');
  });
  it('a worry is never searched, even when searching is allowed', async () => {
    const { client, sent } = fakeClient([{ text: '[worry]\n「眠れない」って、つらいよね。ボクは味方だよ。' }]);
    const r = await buddyAnswer(new ClaudeProvider('k', undefined, client), ctx, [{ role: 'user', text: '最近ずっと眠れない' }], undefined, { search: true, draw: true });
    expect(r.kind).toBe('worry');
    expect(r.sources).toBeUndefined();
    expect(sent.length).toBe(1);
  });
  it('the day’s searches used: the rules say so, and a stray [search] is answered without one', async () => {
    const { client, sent } = fakeClient([{ text: '[search]' }, { text: '土星の輪は氷なんだって。' }]);
    const r = await buddyAnswer(new ClaudeProvider('k', undefined, client), ctx, [{ role: 'user', text: '土星の輪は？' }], undefined, { search: false, draw: true });
    expect(String(sent[0].system)).toContain('もう調べものはできない');
    expect(r.text).toBe('土星の輪は氷なんだって。');
    expect(sent.every((p) => !('tools' in p))).toBe(true);
  });
  it('a failed search falls back to an ordinary answer', async () => {
    const llm: LlmProvider = { name: 'x', oneCall: true, chat: async (q: ChatRequest) => (q.system.includes('[search]') ? '[search]' : 'ふつうの答えだよ。'), search: async () => Promise.reject(new Error('down')) };
    const r = await buddyAnswer(llm, ctx, [{ role: 'user', text: '今日の天気は？' }], undefined, { search: true });
    expect(r).toEqual({ kind: 'normal', text: 'ふつうの答えだよ。' });
  });
  it('the Gemini chain: the sorting says "search", the grounded answer replaces the plain one', async () => {
    const llm: LlmProvider = {
      name: 'gemini',
      chat: async (q) => (q.system.startsWith('Classify') ? 'search' : 'ふつうの答え。'),
      search: async () => ({ text: '調べた答えだよ。', sources: [{ title: 'NHK', url: 'https://www.nhk.or.jp/a', domain: 'nhk.or.jp' }], searches: 1 }),
    };
    const r = await buddyAnswer(llm, ctx, [{ role: 'user', text: '今日のニュースは？' }], undefined, { search: true });
    expect(r.text).toBe('調べた答えだよ。');
    expect(r.sources?.[0].domain).toBe('nhk.or.jp');
    const off = await buddyAnswer(llm, ctx, [{ role: 'user', text: '今日のニュースは？' }], undefined, { search: false });
    expect(off.text).toBe('ふつうの答え。');
  });
  it('the chain searches with the first provider that can', async () => {
    const a: LlmProvider = { name: 'a', chat: async () => 'x', search: async () => Promise.reject(new Error('503')) };
    const b: LlmProvider = { name: 'b', chat: async () => 'x', search: async () => ({ text: 'b', sources: [], searches: 1 }) };
    expect((await new FallbackProvider([a, b]).search({ system: 'S', history: [] })).text).toBe('b');
  });
  it('sources: unique, http(s) only; a Gemini redirect shows the site named in its title', () => {
    expect(pickSources([{ url: 'javascript:x', title: 'bad' }, { url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc', title: 'nasa.gov' }, { url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc', title: 'nasa.gov' }])).toEqual([
      { url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc', title: 'nasa.gov', domain: 'nasa.gov' },
    ]);
    expect(claudeSources({ content: [] } as unknown as Anthropic.Message)).toEqual([]);
  });
});

describe('Bati draws a picture (M-R208)', () => {
  it('Claude: [draw] on the first line carries what to draw; the reply line streams', async () => {
    const { client, sent } = fakeClient([{ text: '[draw] a giant panda eating bamboo\nパンダの絵を描いてみたよ！' }]);
    const got: string[] = [];
    const r = await buddyAnswer(new ClaudeProvider('k', undefined, client), ctx, [{ role: 'user', text: 'パンダの絵を見せて' }], (t) => got.push(t), { search: true, draw: true });
    expect(r).toEqual({ kind: 'normal', text: 'パンダの絵を描いてみたよ！', draw: 'a giant panda eating bamboo' });
    expect(got.join('')).toBe('パンダの絵を描いてみたよ！');
    expect(sent.length).toBe(1);
  });
  it('no drawing left today: the kind answer, no picture', async () => {
    const r = await buddyAnswer({ name: 'x', oneCall: true, chat: async () => '[draw] a cat' }, ctx, [{ role: 'user', text: '猫の絵' }], undefined, { draw: false });
    expect(r.draw).toBeUndefined();
    expect(r.text).toContain('もう絵を描けない');
  });
  it('the Gemini chain reads "draw: …" from the sorting', async () => {
    const llm: LlmProvider = { name: 'gemini', chat: async (q) => (q.system.startsWith('Classify') ? 'draw: a red fox in the snow' : 'x') };
    const r = await buddyAnswer(llm, ctx, [{ role: 'user', text: 'キツネってどんな見た目？' }], undefined, { draw: true });
    expect(r.draw).toBe('a red fox in the snow');
  });
  it('reading the tags and the sorting', () => {
    expect(parseTagged('[search]')).toEqual({ kind: 'normal', body: '', want: 'search' });
    expect(parseTagged('Search engines find pages.').want).toBeUndefined();
    expect(parseTagged('[normal] 土星だよ。').body).toBe('土星だよ。');
    expect(readSort('worry')).toEqual({ kind: 'worry' });
    expect(readSort('draw: a dangerous-looking volcano')).toEqual({ kind: 'normal', want: 'draw', draw: 'a dangerous-looking volcano' });
    const s = new TaggedSplitter(() => undefined);
    s.push('[search]\n');
    expect(s.want).toBe('search');
  });
  it('the picture prompt keeps it child-safe', () => {
    expect(batiChatPicturePrompt('a "panda"\nnow')).toContain('Do not draw real people');
  });
});
