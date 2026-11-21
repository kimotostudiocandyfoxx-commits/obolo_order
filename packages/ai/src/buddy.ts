import type { BuddyPersona, Locale } from '@obolo/shared';
import { LlmRefusalError } from './claude';
import { BATI_CHARACTER, BATI_DANGER, BATI_ONE_CALL, BATI_SORT, BATI_WORRY, personaToneLines } from './prompts/bati';
import { MEMORY_SUMMARY_PROMPT } from './prompts/memory';
import type { ChatTurn, LlmProvider } from './types';

export interface BuddyContext {
  buddyName: string;
  persona: BuddyPersona;
  memorySummary: string | null;
  userDisplayName: string;
  locale: Locale;
}

/** System prompt = character layer + tone sliders + long-term memory (spec §2.2). */
export function buildBuddySystemPrompt(ctx: BuddyContext): string {
  const parts = [BATI_CHARACTER[ctx.locale].replaceAll('{name}', ctx.buddyName), personaToneLines(ctx.persona, ctx.locale)];
  parts.push(ctx.locale === 'ja' ? `ユーザーの呼び名: ${ctx.userDisplayName}` : `Call the user: ${ctx.userDisplayName}`);
  if (ctx.memorySummary) {
    parts.push(
      ctx.locale === 'ja'
        ? `【これまでの会話で覚えていること】\n${ctx.memorySummary}`
        : `[What you remember from earlier conversations]\n${ctx.memorySummary}`,
    );
  }
  parts.push(ctx.locale === 'ja' ? '必ず日本語で返事をする。' : 'Always reply in English.');
  return parts.join('\n\n');
}

export async function buddyReply(llm: LlmProvider, ctx: BuddyContext, history: ChatTurn[]): Promise<string> {
  return (await buddyAnswer(llm, ctx, history)).text;
}

export type BuddyAnswerKind = 'normal' | 'worry' | 'danger';

/**
 * Bati's answer and what kind of question it was (a worry or a danger shows no 〔🖼 絵で見る〕). The sorting runs next
 * to the ordinary answer, so an ordinary question is not slower; a worry or a danger is answered again with its own
 * short prompt (story chat's generation test 1, F・G).
 */
export async function buddyAnswer(
  llm: LlmProvider,
  ctx: BuddyContext,
  history: ChatTurn[],
  /** the ordinary answer as it is written (one-call providers that stream); a worry / danger comes whole at the end */
  onText?: (piece: string) => void,
): Promise<{ text: string; kind: BuddyAnswerKind }> {
  if (llm.oneCall) return buddyAnswerOneCall(llm, ctx, history, onText);
  const last = history[history.length - 1]?.text ?? '';
  const [kind, plain] = await Promise.all([
    llm
      .chat({ system: BATI_SORT, history: [{ role: 'user', text: last }], temperature: 0, maxOutputTokens: 20 })
      .then((o): BuddyAnswerKind => (/worry/i.test(o) ? 'worry' : /danger/i.test(o) ? 'danger' : 'normal'))
      .catch((): BuddyAnswerKind => 'normal'),
    llm.chat({ system: buildBuddySystemPrompt(ctx), history, temperature: 0.6, maxOutputTokens: 600 }),
  ]);
  if (kind === 'normal') return { text: tidyAnswer(plain), kind };
  const own = (kind === 'worry' ? BATI_WORRY : BATI_DANGER)[ctx.locale].replaceAll('{name}', ctx.buddyName);
  const text = await llm.chat({ system: own, history: [{ role: 'user', text: last }], temperature: 0.3, maxOutputTokens: 300 }).catch(() => '');
  return { text: tidyAnswer(text, kind) || fallbackAnswer(kind, ctx.locale), kind };
}

/**
 * Claude (client decision 2026-11-21): the kind on the first line, the answer after it — one call instead of three.
 * A refusal (Haiku 5.5 has no server-side fallback) gets Bati's own safe answer.
 */
async function buddyAnswerOneCall(llm: LlmProvider, ctx: BuddyContext, history: ChatTurn[], onText?: (piece: string) => void): Promise<{ text: string; kind: BuddyAnswerKind }> {
  const system = `${buildBuddySystemPrompt(ctx)}\n\n${BATI_ONE_CALL[ctx.locale]}`;
  const req = { system, history, maxOutputTokens: 400 };
  const split = new TaggedSplitter(onText);
  let raw: string;
  try {
    raw = llm.stream && onText ? await llm.stream(req, (p) => split.push(p)) : await llm.chat(req);
  } catch (err) {
    if (err instanceof LlmRefusalError) {
      const kind = split.kind ?? 'danger';
      return { text: fallbackAnswer(kind === 'normal' ? 'danger' : kind, ctx.locale), kind: kind === 'normal' ? 'danger' : kind };
    }
    throw err;
  }
  const { kind, body } = parseTagged(raw);
  return { text: tidyAnswer(body, kind) || (kind === 'normal' ? tidyAnswer(raw) : fallbackAnswer(kind, ctx.locale)), kind };
}

const TAG = /^\s*\[?\s*(normal|worry|danger)\s*\]?[ \t]*(?:\r?\n|$)/i;

/** "[worry]\n…" → the kind and the answer; no tag = an ordinary answer */
export function parseTagged(raw: string): { kind: BuddyAnswerKind; body: string } {
  const m = TAG.exec(raw);
  if (!m) return { kind: 'normal', body: raw.trim() };
  return { kind: m[1].toLowerCase() as BuddyAnswerKind, body: raw.slice(m[0].length).trim() };
}

/**
 * Reads the stream: holds the first line until the kind is known, then lets an ordinary answer through (a worry or a
 * danger is not streamed — it may still be swapped for the safe answer). The opening research phrase is held back
 * until it can be cut, and emoji never go out.
 */
export class TaggedSplitter {
  kind: BuddyAnswerKind | null = null;
  private head = '';
  private held = '';
  private flowing = false;
  constructor(private readonly onText?: (piece: string) => void) {}
  push(piece: string) {
    if (this.kind === null) {
      this.head += piece;
      const nl = this.head.indexOf('\n');
      // no tag at all after a few words: it is an ordinary answer
      if (nl < 0 && this.head.length < 24) return;
      const { kind } = parseTagged(this.head);
      this.kind = kind;
      const rest = TAG.test(this.head) ? this.head.replace(TAG, '') : this.head;
      this.head = '';
      if (kind === 'normal') this.feed(rest);
      return;
    }
    if (this.kind === 'normal') this.feed(piece);
  }
  private feed(piece: string) {
    if (!this.onText) return;
    if (this.flowing) {
      const out = piece.replace(EMOJI, '').replace(/\uFE0F/g, '');
      if (out) this.onText(out);
      return;
    }
    this.held += piece;
    if (this.held.length < 24 && !/[。！？!?]/.test(this.held)) return;
    this.flowing = true;
    const out = tidyAnswer(this.held);
    this.held = '';
    if (out) this.onText(out);
  }
}

const EMOJI = /\p{Extended_Pictographic}/gu;

/** the habits the prompt alone did not stop: the research opener, emoji, 薬 in a refusal */
export function tidyAnswer(text: string, kind: BuddyAnswerKind = 'normal'): string {
  let t = text.trim().replace(/^(宇宙じゅうの記録を)?(しら|調)べ(て(み|き)た|たら)(よ|ら|けど)?[！!、。]?\s*/, '').replace(/^宇宙じゅうの記録[^。！!]*[。！!]\s*/, '');
  // no emoji at all (story chat, after generation test 1)
  t = t.replace(EMOJI, '').replace(/\uFE0F/g, '');
  if (kind !== 'normal' && /薬/.test(t)) return '';
  return t.replace(/\s{2,}/g, ' ').trim();
}

function fallbackAnswer(kind: BuddyAnswerKind, locale: 'ja' | 'en'): string {
  if (locale === 'en') return kind === 'worry' ? "That sounds really hard. I'm on your side. Please tell someone in your family, a teacher or an adult you trust." : "That's dangerous, so I can't help with it. Let's do it the safe way, with your family.";
  return kind === 'worry' ? 'それは、すごくつらいよね。ボクは味方だよ。家の人や、学校の先生、信じられる大人にも話してね。' : '危ないから、ボクは手伝えないんだ。安全なやり方で、家の人と一緒にね。';
}

/** Condense existing memory + recent turns into an updated bullet list. */
export async function summarizeMemory(
  llm: LlmProvider,
  locale: Locale,
  existing: string | null,
  turns: ChatTurn[],
): Promise<string> {
  const transcript = turns.map((t) => `${t.role === 'user' ? 'USER' : 'BUDDY'}: ${t.text}`).join('\n');
  const input = `${locale === 'ja' ? '既存の記憶' : 'Existing memory'}:\n${existing || '-'}\n\n${
    locale === 'ja' ? '新しい会話' : 'New conversation'
  }:\n${transcript}`;
  const out = await llm.chat({
    system: MEMORY_SUMMARY_PROMPT[locale],
    history: [{ role: 'user', text: input }],
    temperature: 0.2,
    maxOutputTokens: 600,
  });
  return out.slice(0, 4000);
}
