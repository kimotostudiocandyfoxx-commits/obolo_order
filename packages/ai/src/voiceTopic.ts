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

/**
 * Story session 2026-11-25 — Venus: a radio show's hidden topic (the same vocabulary as Saturn's, so the planets gather
 * shows by what they are about), asked of the same ordinary text model the same way (one short call, temperature 0, a
 * tiny JSON answer; its cost is a small cost of the request it runs in, as a kororin's). It reads the show's title and,
 * when there is one, what is said about it / in it (`talk`). Only the topic: a show's moods are how it is spoken
 * (radioTags). null = the word rules stand (offline, a failure, an unreadable answer).
 */
export const SHOW_TOPIC_SYSTEM =
  'You sort a Japanese radio show made by a teenager into one topic for a hidden index (the user never sees it), from its title and, when given, its talk. ' +
  `Reply with JSON only: {"topic":"<one of: ${PLANET_VOICE_TOPICS.join(' / ')}>"}. ` +
  'topic 雑談 when nothing else fits. Only a word from the list, no explanation.';

export async function showTopicTags(title: string, talk?: string | null, llm?: LlmProvider): Promise<WorkTags | null> {
  const t = (title ?? '').trim().slice(0, 120);
  const said = (talk ?? '').trim().slice(0, 480);
  if (!t && !said) return null;
  if (!llm || llm.name === 'mock') return null;
  try {
    const out = await llm.chat({ system: SHOW_TOPIC_SYSTEM, history: [{ role: 'user', text: said ? `題名：${t}\n内容：${said}` : `題名：${t}` }], temperature: 0, maxOutputTokens: 40 });
    const m = /\{[\s\S]*\}/.exec(out ?? '');
    if (!m) return null;
    const j = JSON.parse(m[0]) as { topic?: unknown };
    return typeof j.topic === 'string' ? { ...voiceTags(j.topic, []), moods: [] } : null;
  } catch {
    return null;
  }
}
