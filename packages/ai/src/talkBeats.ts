import { brightBeat, readBeats, ruleBeats, talkPlain, talkSentences, type TalkBeat } from '@obolo/shared';
import { TALK_BEATS_PROMPT } from './prompts/bati';
import type { LlmProvider } from './types';

/**
 * M-R238: your own / a dachi's words → each sentence's expression and motion, with one small call (Haiku 5.5) on
 * sending. When the model cannot be had in time (or answers nonsense), the rules (ruleBeats) decide. `self`: only the
 * bright faces.
 */
export async function talkBeats(llm: LlmProvider | null | undefined, text: string, opts: { self?: boolean; timeoutMs?: number } = {}): Promise<TalkBeat[]> {
  return (await talkBeatsMarked(llm, text, opts)).faces;
}

/**
 * M-R238 + M-R243: the faces, motions, entrances and shapes of each sentence, and the words with at most one mark per
 * sentence (**bold** / ^^larger^^ / !!shout!!) — kept only when the marks change nothing but the marks.
 */
export async function talkBeatsMarked(llm: LlmProvider | null | undefined, text: string, opts: { self?: boolean; timeoutMs?: number } = {}): Promise<{ faces: TalkBeat[]; marked?: string }> {
  const parts = talkSentences(text);
  const n = parts.length;
  const rules = ruleBeats(text, opts.self);
  if (!llm || !n) return { faces: rules };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raw = await Promise.race([
      llm.chat({ system: TALK_BEATS_PROMPT, history: [{ role: 'user', text: text.slice(0, 600) }], temperature: 0, maxOutputTokens: 400 }),
      new Promise<never>((_, no) => (timer = setTimeout(() => no(new Error('slow')), opts.timeoutMs ?? 4000))),
    ]).finally(() => clearTimeout(timer));
    const json = /\[[\s\S]*\]/.exec(raw)?.[0];
    const arr = json ? (JSON.parse(json) as unknown[]) : null;
    // spoken words with no punctuation at all (M-R244): the call may cut them into sentences, adding only 。！？、
    const PUNCT = /[。、！？!?…\s]/g;
    if (arr && n === 1 && !/[。！？!?]/.test(text) && arr.length > 1) {
      const ts = arr.map((o) => (typeof (o as { t?: unknown })?.t === 'string' ? (o as { t: string }).t : ''));
      if (ts.every(Boolean) && talkPlain(ts.join('')).replace(PUNCT, '') === text.replace(PUNCT, '')) {
        const b = readBeats(arr, arr.length) ?? [];
        return { faces: opts.self ? b.map(brightBeat) : b, marked: ts.join('') };
      }
    }
    const beats = arr ? readBeats(arr, n) : null;
    if (!beats) return { faces: rules };
    // one per sentence: a short answer is filled from the rules
    const full = Array.from({ length: n }, (_, k) => beats[k] ?? rules[k]);
    // the marked sentences, used only if each is the same words as written (and one mark at most)
    const squash = (x: string) => x.replace(/\s/g, '');
    const marked = (arr ?? []).slice(0, n).map((o, k) => {
      const t = typeof (o as { t?: unknown })?.t === 'string' ? (o as { t: string }).t : '';
      return t && squash(talkPlain(t)) === squash(parts[k]) && (t.match(/\*\*|\^\^|!!|\[\[/g) ?? []).length <= 3 ? t : null;
    });
    const ok = marked.length === n && marked.every((t) => t != null) && marked.some((t, k) => t !== parts[k]);
    // the marks go into the words as written (their spaces between the sentences kept)
    let out = '';
    let at = 0;
    if (ok)
      for (let k = 0; k < n; k++) {
        const i = text.indexOf(parts[k], at);
        if (i < 0) return { faces: opts.self ? full.map(brightBeat) : full };
        out += text.slice(at, i) + marked[k];
        at = i + parts[k].length;
      }
    return { faces: opts.self ? full.map(brightBeat) : full, ...(ok ? { marked: out + text.slice(at) } : {}) };
  } catch {
    return { faces: rules };
  }
}
