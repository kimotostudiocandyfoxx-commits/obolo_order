import { describe, expect, it } from 'vitest';
import { spellFrom } from '@obolo/shared';
import { MockProvider } from './providers';
import type { ChatRequest, LlmProvider } from './types';
import { readVoiceTopic, SHOW_TOPIC_SYSTEM, showTopicTags, VOICE_TOPIC_SYSTEM, voiceTopicTags } from './voiceTopic';
import { spellSystem } from './prompts/spell';

const model = (answer: string | Error, seen: ChatRequest[] = []): LlmProvider =>
  ({
    name: 'gemini',
    chat: async (req: ChatRequest) => {
      seen.push(req);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  }) as unknown as LlmProvider;

describe('planets 2-1 Saturn (M-R316): a voice kororin’s topic and moods from its words', () => {
  it('asks the ordinary text model once, small and at temperature 0, with the whole vocabulary', async () => {
    const seen: ChatRequest[] = [];
    const t = await voiceTopicTags('好きな人と目が合った…！', model('```json\n{"topic":"恋バナ","moods":["ドキドキ","好きな人","うれしい"]}\n```', seen));
    expect(t).toEqual({ main: '恋バナ', moods: ['ドキドキ', '好きな人'], bpm: null });
    expect(seen).toHaveLength(1);
    expect(seen[0].temperature).toBe(0);
    expect(seen[0].maxOutputTokens).toBeLessThanOrEqual(60);
    for (const w of ['雑談', '恋バナ', '眠い', 'おやすみ', 'ツッコミ']) expect(VOICE_TOPIC_SYSTEM).toContain(w);
  });

  it('an unknown topic is 雑談; an unreadable answer or a failure is null (no tags: the backfill asks again)', async () => {
    expect((await voiceTopicTags('料理の話', model('{"topic":"料理","moods":[]}')))?.main).toBe('雑談');
    expect(await voiceTopicTags('x', model('I think it is chat'))).toBeNull();
    expect(await voiceTopicTags('x', model(new Error('quota')))).toBeNull();
    expect(readVoiceTopic('{"moods":["日常"]}')).toBeNull();
  });

  it('offline (the mock model) the word rules answer, and no words is 雑談 with no moods', async () => {
    expect((await voiceTopicTags('推しのライブ当たった！', new MockProvider()))?.main).toBe('推し');
    expect(await voiceTopicTags('   ', new MockProvider())).toEqual({ main: '雑談', moods: [], bpm: null });
  });
});

describe('M-R317: the art spell knows ゆめかわ・和モダン・レトロ・ポップ (Jupiter forests gather by style)', () => {
  it('each is the picture’s style', () => {
    for (const [said, style] of [
      ['ゆめかわな猫の絵', 'ゆめかわ'],
      ['和モダンな庭', '和モダン'],
      ['レトロな喫茶店', 'レトロ'],
      ['ポップな街の絵', 'ポップ'],
    ])
      expect(spellFrom('art', said).find((t) => t.group === 'style')?.ja, said).toBe(style);
    // a song's ポップ is still the song genre
    expect(spellFrom('song', 'ポップな曲').find((t) => t.group === 'genre')?.ja).toBe('ポップ');
    expect(spellSystem('art')).toMatch(/ゆめかわ.*和モダン.*レトロ.*ポップ/);
  });
});

describe('07: the words the five skies gather by reach the spells', () => {
  it('a game can be retro / pixel art, a novel names magic, space or adventure', () => {
    expect(spellFrom('game', 'レトロなドット絵のシューティング').filter((t) => t.group === 'style').map((t) => t.ja)).toEqual(expect.arrayContaining(['ドット絵']));
    expect(spellFrom('game', 'レトロなシューティング').map((t) => t.ja)).toContain('レトロ');
    expect(spellSystem('game')).toMatch(/ドット絵.*レトロ/);
    expect(spellSystem('novel')).toMatch(/魔法.*宇宙.*冒険/);
  });
});

describe('Venus (story 2026-11-25): a radio show’s topic from the text model, the word rules as the fallback', () => {
  it('asks once, small and at temperature 0, with the title (and the talk when there is one); the topic only', async () => {
    const seen: ChatRequest[] = [];
    const t = await showTopicTags('深夜の恋バナ相談室', '好きな人に告白したい人の話', model('{"topic":"恋バナ"}', seen));
    expect(t).toEqual({ main: '恋バナ', moods: [], bpm: null });
    expect(seen).toHaveLength(1);
    expect(seen[0].temperature).toBe(0);
    expect(seen[0].maxOutputTokens).toBeLessThanOrEqual(60);
    expect(seen[0].history[0].text).toContain('深夜の恋バナ相談室');
    expect(seen[0].history[0].text).toContain('告白');
    expect(SHOW_TOPIC_SYSTEM).toContain('雑談');
  });
  it('an unknown topic is 雑談; offline, a failure or an unreadable answer is null (the word rules stand)', async () => {
    expect((await showTopicTags('料理ラジオ', null, model('{"topic":"料理"}')))?.main).toBe('雑談');
    expect(await showTopicTags('x', null, model(new Error('quota')))).toBeNull();
    expect(await showTopicTags('x', null, model('chat'))).toBeNull();
    expect(await showTopicTags('推しラジオ', null, new MockProvider())).toBeNull();
    expect(await showTopicTags('  ', null, model('{"topic":"推し"}'))).toBeNull();
  });
});
