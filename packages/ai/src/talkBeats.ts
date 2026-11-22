import { brightBeat, readBeats, ruleBeats, talkSentences, type TalkBeat } from '@obolo/shared';
import { TALK_BEATS_PROMPT } from './prompts/bati';
import type { LlmProvider } from './types';

/**
 * M-R238: your own / a dachi's words → each sentence's expression and motion, with one small call (Haiku 5.5) on
 * sending. When the model cannot be had in time (or answers nonsense), the rules (ruleBeats) decide. `self`: only the
 * bright faces.
 */
export async function talkBeats(llm: LlmProvider | null | undefined, text: string, opts: { self?: boolean; timeoutMs?: number } = {}): Promise<TalkBeat[]> {
  const n = talkSentences(text).length;
  const rules = ruleBeats(text, opts.self);
  if (!llm || !n) return rules;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raw = await Promise.race([
      llm.chat({ system: TALK_BEATS_PROMPT, history: [{ role: 'user', text: text.slice(0, 600) }], temperature: 0, maxOutputTokens: 200 }),
      new Promise<never>((_, no) => (timer = setTimeout(() => no(new Error('slow')), opts.timeoutMs ?? 4000))),
    ]).finally(() => clearTimeout(timer));
    const json = /\[[\s\S]*\]/.exec(raw)?.[0];
    const beats = json ? readBeats(JSON.parse(json), n) : null;
    if (!beats) return rules;
    // one per sentence: a short answer is filled from the rules
    const full = Array.from({ length: n }, (_, k) => beats[k] ?? rules[k]);
    return opts.self ? full.map(brightBeat) : full;
  } catch {
    return rules;
  }
}
