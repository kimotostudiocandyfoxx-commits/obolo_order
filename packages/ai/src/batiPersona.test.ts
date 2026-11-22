import { describe, expect, it } from 'vitest';
import { BATI_PERSONA_SYSTEM, decideBatiPersona, rewriteBatiLines, rewrittenLineOk } from './batiPersona';
import { moderateLookWish } from './moderation';
import { batiRestylePrompt } from './images';
import { buildBuddySystemPrompt } from './buddy';
import type { ChatRequest, LlmProvider } from './types';

const llm = (answer: string | Error, seen: ChatRequest[] = []): LlmProvider => ({
  name: 'fake',
  chat: async (req) => {
    seen.push(req);
    if (answer instanceof Error) throw answer;
    return answer;
  },
});

describe("{bati}'s birth: the personality from the seed (M-R217)", () => {
  it('reads the JSON the model gave (a rare one is marked rare)', async () => {
    const seen: ChatRequest[] = [];
    const p = await decideBatiPersona(llm('{"personality":"ninja","self":"それがし","call":"{neo}どの","catchphrase":"〜ニン","intro":"空気の中から、そっと生まれた。"}', seen), '空気', 'moon');
    expect(p).toMatchObject({ personality: 'ninja', self: 'それがし', call: '{neo}どの', rare: true });
    expect(seen[0].system).toBe(BATI_PERSONA_SYSTEM);
    expect(seen[0].history[0].text).toContain('空気');
    expect(BATI_PERSONA_SYSTEM).toContain('たこ焼き');
  });

  it('an unfit seed: null (OBOLON asks again)', async () => {
    expect(await decideBatiPersona(llm('{"ok":false}'), 'なにか')).toBeNull();
  });

  it('a failed call or a bad answer: the fixed fallback, never nothing', async () => {
    expect(await decideBatiPersona(llm(new Error('down')), 'カレー')).toMatchObject({ personality: 'genki', fallback: true });
    expect(await decideBatiPersona(llm('{"personality":"pirate"}'), 'カレー')).toMatchObject({ personality: 'genki', fallback: true });
  });

  it('without a model: the rules (a regional food → its dialect)', async () => {
    const mock = { name: 'mock', chat: async () => '' } as LlmProvider;
    expect((await decideBatiPersona(mock, 'たこ焼き'))?.personality).toBe('kansai');
    expect((await decideBatiPersona(mock, '明太子'))?.personality).toBe('hakata');
  });
});

describe("a rare {bati}'s lines, rewritten once at birth", () => {
  const persona = { personality: 'bushi' as const, self: '拙者', call: '{neo}殿', catchphrase: '〜でござる', intro: '…', rare: true };
  it('keeps a line only with the same placeholders and a length within ±40 %', () => {
    expect(rewrittenLineOk('いくよ、{name}！', '参るでござる、{name}殿！')).toBe(true);
    expect(rewrittenLineOk('いくよ、{name}！', '参るでござる！')).toBe(false);
    expect(rewrittenLineOk('いくよ、{name}！', '{self}は、どこまでも、いつまでも、参るでござるよ、{name}殿！')).toBe(false);
  });
  it('one call for all the lines; a line that fails is left out (said as written)', async () => {
    const lines = ['いくよ、{name}！', '工房に行こう！'];
    const out = await rewriteBatiLines(llm('["参るでござる、{name}殿！", "工房へ、参るでござる、参るでござる、参るでござる！"]'), persona, lines);
    expect(out).toEqual({ 'いくよ、{name}！': '参るでござる、{name}殿！' });
    expect(await rewriteBatiLines(llm(new Error('x')), persona, lines)).toEqual({});
  });
});

describe("{bati}'s look (M-R215)", () => {
  it('refuses lookalikes of real people and other works, sexual and violent looks', async () => {
    expect((await moderateLookWish('ピカチュウみたいにして')).categories).toEqual(['other_work']);
    expect((await moderateLookWish('有名な歌手にそっくり')).categories).toEqual(['real_person']);
    expect((await moderateLookWish('セクシーな水着')).categories).toEqual(['sexual']);
    expect((await moderateLookWish('ナイフを持たせて')).categories).toEqual(['violent']);
    expect((await moderateLookWish('水彩画のタッチで、魔法使いの帽子')).flagged).toBe(false);
  });
  it('the rules are in every dress-up prompt, and the born look keeps who it is', () => {
    const p = batiRestylePrompt('リボン', 0, true);
    expect(p).toContain('must not resemble any real, existing person');
    expect(p).toContain('second picture');
  });
});

describe("the chat prompt carries {bati}'s personality", () => {
  it('the manner, the 一人称 and the 呼び方 (the memory is the member\'s, shared by all their {bati})', () => {
    const s = buildBuddySystemPrompt({
      buddyName: 'ポン',
      persona: { cheer: 80, polite: 30, humor: 65 },
      memorySummary: 'たこ焼きが好き',
      userDisplayName: 'ネオ',
      locale: 'ja',
      bati: { personality: 'keigo', self: 'わたくし', call: '{neo}さま', catchphrase: '〜です' },
    });
    expect(s).toContain('一人称は「わたくし」');
    expect(s).toContain('敬語の子');
    expect(s).toContain('「ネオさま」');
    expect(s).toContain('はい！ 参ります、ネオさま！');
    expect(s).toContain('たこ焼きが好き');
  });
});

import { memoryLines } from './buddy';

describe("what {bati} remembers, in the chat (M-R222)", () => {
  const ctx = {
    buddyName: 'ポン',
    persona: { cheer: 80, polite: 30, humor: 65 },
    memorySummary: '古い要約',
    userDisplayName: 'ネオ',
    locale: 'ja' as const,
    bati: { personality: 'genki' as const, self: 'ボク' },
    memories: ['金曜が曲の締め切り'],
  };
  it('the memories are the only memory; the length is ours; an imitation is once; it never asks to remember', () => {
    const s = buildBuddySystemPrompt(ctx);
    expect(s).toContain('金曜が曲の締め切り');
    expect(s).not.toContain('古い要約');
    expect(s).toContain('「くわしく」「もっと教えて」');
    expect(s).toContain('一回だけまねして');
    expect(s).toContain('自分から「覚えていい？」とは聞かない');
  });
  it("tells {bati} what came of the member's 「覚えといて」 and 「〇〇って呼んで」", () => {
    expect(memoryLines({ ...ctx, remembered: { text: 'x', result: 'kept' } })).toContain('覚えた！');
    expect(memoryLines({ ...ctx, remembered: { text: 'x', result: 'refused' } })).toContain('大事なことは、ネオがしまっておいて！');
    expect(memoryLines({ ...ctx, remembered: { text: 'x', result: 'full' } })).toContain('どれか忘れてもいい？');
    expect(memoryLines({ ...ctx, calledAs: 'ネオっち' })).toContain('「ネオっち」と呼ぶ');
  });
});
