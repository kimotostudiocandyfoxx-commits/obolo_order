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
    const p = await decideBatiPersona(llm('{"personality":"butler","self":"私","call":"{neo}さま","catchphrase":"〜でございます","trait":"きれい好き","intro":"空気の中から、そっと生まれた、きれい好き。"}', seen), '空気', 'moon');
    expect(p).toMatchObject({ personality: 'butler', self: '私', call: '{neo}さま', trait: 'きれい好き', rare: true });
    expect(seen[0].system).toBe(BATI_PERSONA_SYSTEM);
    expect(seen[0].history[0].text).toContain('空気');
    expect(BATI_PERSONA_SYSTEM).toContain('たこ焼き');
    expect(BATI_PERSONA_SYSTEM).toContain('語尾の変化は、文の半分くらいまで');
    expect(BATI_PERSONA_SYSTEM).not.toMatch(/ninja|rapper|poet|baby/);
  });

  it('an unfit seed: null (OBOLON asks again)', async () => {
    expect(await decideBatiPersona(llm('{"ok":false}'), 'なにか')).toBeNull();
  });

  it('a failed call or a bad answer: the fixed fallback, never nothing', async () => {
    expect(await decideBatiPersona(llm(new Error('down')), 'カレー')).toMatchObject({ personality: 'genki', fallback: true });
    expect(await decideBatiPersona(llm('{"personality":"pirate"}'), 'カレー')).toMatchObject({ personality: 'genki', fallback: true });
    // a retired style from the model is not taken (M-R225)
    expect(await decideBatiPersona(llm('{"personality":"ninja","self":"x","call":"{neo}","catchphrase":"x","intro":"いいかんじに生まれた。"}'), 'カレー')).toMatchObject({ fallback: true });
  });

  it('without a model: the rules (a regional food → its dialect)', async () => {
    const mock = { name: 'mock', chat: async () => '' } as LlmProvider;
    expect((await decideBatiPersona(mock, 'たこ焼き'))?.personality).toBe('kansai');
    expect((await decideBatiPersona(mock, '明太子'))?.personality).toBe('hakata');
  });
});

describe("a rare {bati}'s lines, rewritten once at birth", () => {
  const persona = { personality: 'bushi' as const, self: '拙者', call: '{neo}殿', catchphrase: '〜でござる', trait: 'がんばりや', intro: '…', rare: true };
  it('keeps a line only with the same placeholders and a length within ±40 %', () => {
    expect(rewrittenLineOk('いくよ、{name}！', '参るでござる、{name}殿！')).toBe(true);
    expect(rewrittenLineOk('いくよ、{name}！', '参るでござる！')).toBe(false);
    expect(rewrittenLineOk('いくよ、{name}！', '{self}は、どこまでも、いつまでも、参るでござるよ、{name}殿！')).toBe(false);
    // no all-hiragana / all-katakana (M-R225)
    expect(rewrittenLineOk('工房に行こう！', 'こうぼうに、いこう！')).toBe(false);
    expect(rewrittenLineOk('工房に行こう！', 'コウボウニ、イコウ！')).toBe(false);
  });
  it('one call for all the lines; a line that fails is left out (said as written)', async () => {
    const lines = ['いくよ、{name}！', '工房に行こう！'];
    const out = await rewriteBatiLines(llm('["参るでござる、{name}殿！", "工房へ、参るでござる、参るでござる、参るでござる！"]'), persona, lines);
    expect(out).toEqual({ 'いくよ、{name}！': '参るでござる、{name}殿！' });
    // at most half the sentences change over the set: the rest stay the script's words
    const four = ['工房に行こう！', 'じゃあ、話してみて！', '何回でも、いいよ！', 'いつか、聞けるよ。'];
    const all = await rewriteBatiLines(llm(JSON.stringify(['工房に参ろう！', 'では、話してみるでござる！', '何回でも、よいでござる！', 'いつか、聞けるでござる。'])), persona, four);
    expect(Object.keys(all).length).toBeLessThanOrEqual(2);
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
      bati: { personality: 'teinei', self: '僕', call: '{neo}さん', catchphrase: '〜デスね' },
    });
    expect(s).toContain('一人称は「僕」');
    expect(s).toContain('ていねいな子');
    expect(s).toContain('「ネオさん」');
    expect(s).toContain('ネオさん、すごいデス！');
    expect(s).toContain('語尾の変化は、文の半分くらいまで');
    expect(s).toContain('カードの「性格」');
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

describe('M-R227: the gal family, no repeats', () => {
  it('the prompt carries the gal family and the ratios; a repeated style is drawn again', async () => {
    expect(BATI_PERSONA_SYSTEM).toContain('ギャル系');
    expect(BATI_PERSONA_SYSTEM).toContain('35％');
    const p = await decideBatiPersona(
      { name: 'fake', chat: async () => '{"personality":"kansai","self":"オレ","call":"{neo}","catchphrase":"やで","trait":"食いしん坊","intro":"たこ焼きの湯気から生まれた。"}' },
      'たこ焼き',
      'sun',
      'food',
      { exclude: ['kansai'] },
    );
    expect(p?.personality).not.toBe('kansai');
    expect(p?.intro).toBe('たこ焼きの湯気から生まれた。');
  });
});

describe('M-R229: 「あーし」 never comes from the model', () => {
  it('the 一人称 is replaced and a rewritten line with it is not kept; the prompts say so', async () => {
    const p = await decideBatiPersona({ name: 'fake', chat: async () => '{"personality":"gal","self":"あーし","call":"{neo}っち","catchphrase":"それな","trait":"食いしん坊","intro":"タピオカから生まれた。"}' }, 'タピオカ', 'moon');
    expect(p?.self).toBe('ウチ');
    expect(rewrittenLineOk('工房に行こう！', 'あーし、工房行く！')).toBe(false);
    expect(BATI_PERSONA_SYSTEM).toContain('「あーし」は使わない');
    expect(BATI_PERSONA_SYSTEM.replace('「あーし」は使わない', '')).not.toContain('あーし');
    const chat = buildBuddySystemPrompt({ buddyName: 'ポン', persona: { cheer: 1, polite: 1, humor: 1 }, memorySummary: null, userDisplayName: 'ネオ', locale: 'ja', bati: { personality: 'gal', self: 'ウチ' } });
    expect(chat.replace('「あーし」は使わない', '')).not.toContain('あーし');
  });
});
