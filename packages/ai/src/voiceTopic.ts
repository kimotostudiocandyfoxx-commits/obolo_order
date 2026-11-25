import { PLANET_VOICE_MOODS, PLANET_VOICE_TOPICS, VOICE_MOODS_MAX, voiceTags, voiceTagsOfWords, type WorkTags } from '@obolo/shared';
import type { LlmProvider } from './types';

/**
 * Planets 2-1 Saturn (M-R316): a voice kororin's hidden topic and moods, read from the words blown in (the post's text:
 * what was typed, or what the speech-to-text heard before it was posted). One short call on the ordinary text model
 * (the cheap chain the words check already uses), temperature 0, a tiny JSON answer. Kept to the vocabulary by
 * voiceTags (unknown topic → 雑談). Offline (the mock): the word rules. A failure answers null — the caller keeps no
 * tags and the admin backfill asks again.
 */
export const VOICE_TOPIC_SYSTEM =
  'You sort a short Japanese voice post by a teenager into a topic and moods for a hidden index (the user never sees them). ' +
  `Reply with JSON only: {"topic":"<one of: ${PLANET_VOICE_TOPICS.join(' / ')}>","moods":["<0 to ${VOICE_MOODS_MAX} of: ${PLANET_VOICE_MOODS.join(' / ')}>"]}. ` +
  'topic 雑談 when nothing else fits. Only words from the lists, no explanation.';

export function readVoiceTopic(out: string): WorkTags | null {
  const m = /\{[\s\S]*\}/.exec(out ?? '');
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as { topic?: unknown; moods?: unknown };
    if (typeof j.topic !== 'string') return null;
    return voiceTags(j.topic, j.moods);
  } catch {
    return null;
  }
}

export async function voiceTopicTags(words: string, llm?: LlmProvider): Promise<WorkTags | null> {
  const w = (words ?? '').trim().slice(0, 600);
  if (!w) return voiceTags(null, []);
  if (!llm || llm.name === 'mock') return voiceTagsOfWords(w);
  try {
    const out = await llm.chat({ system: VOICE_TOPIC_SYSTEM, history: [{ role: 'user', text: w }], temperature: 0, maxOutputTokens: 60 });
    return readVoiceTopic(out);
  } catch {
    return null;
  }
}
