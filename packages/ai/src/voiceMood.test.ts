import { VOICE_MOODS } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import type { ChatRequest, LlmProvider } from './types';
import { pickVoiceMood, VOICE_MOOD_PROMPT_MOODS } from './voiceMood';

const model = (answer: string | Error, seen: ChatRequest[] = [], name = 'gemini'): LlmProvider =>
  ({
    name,
    chat: async (req: ChatRequest) => {
      seen.push(req);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  }) as unknown as LlmProvider;

describe('the sound of a ダチ voice message, from its words (client 2026-11-27)', () => {
  it('asks the text model once, tiny and at temperature 0, naming all seven moods', async () => {
    const seen: ChatRequest[] = [];
    expect(await pickVoiceMood(model('otsukare', seen), 'きょうも一日、がんばったね')).toEqual({ sound: 'otsukare' });
    expect(seen).toHaveLength(1);
    expect(seen[0].temperature).toBe(0);
    expect(seen[0].maxOutputTokens).toBeLessThanOrEqual(10);
    expect(VOICE_MOOD_PROMPT_MOODS).toEqual([...VOICE_MOODS]);
  });

  it('the model cannot tell: the word rules; they cannot either: the weakest うれしい, never none', async () => {
    expect(await pickVoiceMood(model('unknown'), 'もう寝るね、おやすみ')).toEqual({ sound: 'oyasumi' });
    expect(await pickVoiceMood(model('unknown'), '三時に駅の前で')).toEqual({ sound: 'ureshii', soft: true });
    expect(await pickVoiceMood(model('none'), '三時に駅の前で')).toEqual({ sound: 'ureshii', soft: true });
    expect(await pickVoiceMood(model('I think it is happy or sad'), '三時に駅の前で')).toEqual({ sound: 'ureshii', soft: true });
  });

  it('a failing model, no model, the mock: the rules, with the same fallback', async () => {
    expect(await pickVoiceMood(model(new Error('down')), 'えっ、まじで？！')).toEqual({ sound: 'bikkuri' });
    expect(await pickVoiceMood(model(new Error('down')), '三時に')).toEqual({ sound: 'ureshii', soft: true });
    expect(await pickVoiceMood(undefined, 'やったー！')).toEqual({ sound: 'ureshii' });
    const seen: ChatRequest[] = [];
    expect(await pickVoiceMood(model('bikkuri', seen, 'mock'), 'やったー！')).toEqual({ sound: 'ureshii' });
    expect(seen).toHaveLength(0);
  });

  it('no words (nothing was heard): the weakest うれしい, without asking', async () => {
    const seen: ChatRequest[] = [];
    expect(await pickVoiceMood(model('bikkuri', seen), '   ')).toEqual({ sound: 'ureshii', soft: true });
    expect(seen).toHaveLength(0);
  });
});
