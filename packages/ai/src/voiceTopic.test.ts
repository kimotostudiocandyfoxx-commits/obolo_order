import { describe, expect, it } from 'vitest';
import { spellFrom } from '@obolo/shared';
import { MockProvider } from './providers';
import type { ChatRequest, LlmProvider } from './types';
import { readVoiceTopic, VOICE_TOPIC_SYSTEM, voiceTopicTags } from './voiceTopic';
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
