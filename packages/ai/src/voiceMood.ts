import { pickVoiceSound, VOICE_MOODS, VOICE_SOUND_FALLBACK, type VoiceSoundPick } from '@obolo/shared';
import type { LlmProvider } from './types';

/**
 * Client 2026-11-27 (shared/voiceSound.ts): the small sound mixed under a ダチ voice message is picked from its words.
 * One short call to the chat provider's cheapest model (the same one the moderation uses: Flash-Lite first), a
 * one-word answer; with no model, a failure or an answer that names no single mood, the word rules decide, and when
 * they cannot either it is the weakest うれしい — never "none" (the member can still choose なし).
 */
const SYSTEM = `You label the mood of one short Japanese voice message between friends. Reply with exactly one word from this list and nothing else:
ureshii (happy, glad, thankful, praising)
wakuwaku (excited, looking forward, inviting, let's do it)
otsukare (good work, take a rest, caring after effort, welcome back)
bikkuri (surprised, shocked, "really?!")
shinmiri (sad, lonely, sorry, missing someone, quiet feelings)
omoshiro (funny, joking, laughing, silly)
oyasumi (good night, going to sleep)
unknown (cannot tell, plain information, a question with no feeling)`;

export async function pickVoiceMood(llm: LlmProvider | undefined | null, text: string): Promise<VoiceSoundPick> {
  const words = text.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!words) return VOICE_SOUND_FALLBACK;
  if (!llm || llm.name === 'mock') return pickVoiceSound(words);
  try {
    const answer = await llm.chat({ system: SYSTEM, history: [{ role: 'user', text: words }], temperature: 0, maxOutputTokens: 8 });
    return pickVoiceSound(words, answer);
  } catch {
    // the model could not be asked: the rules (a voice message never waits on its sound)
    return pickVoiceSound(words);
  }
}

/** the moods the prompt names (a test keeps the prompt and the list together) */
export const VOICE_MOOD_PROMPT_MOODS = VOICE_MOODS.filter((m) => SYSTEM.includes(`${m} (`));
