import { BATI_REPLY_LENGTH, BATI_ROLE_TALK, BUDDY_MAKE_KINDS, type BuddyMakeKind, MEMORY_LINES, isTalkFace, isTalkMotion, readBeats, talkSentences, type BatiRole, type BuddyPersona, type Locale, type TalkBeat, type TalkFace, type TalkMotion } from '@obolo/shared';
import { LlmRefusalError } from './claude';
import { BATI_CHARACTER, BATI_DANGER, BATI_SEARCH, BATI_WORRY, batiOneCallRules, batiPersonaBlock, batiSort, personaToneLines, type BatiAbilities, type BatiSelfView } from './prompts/bati';
import { MEMORY_SUMMARY_PROMPT } from './prompts/memory';
import type { ChatTurn, LlmProvider, WebSource } from './types';

export interface BuddyContext {
  buddyName: string;
  persona: BuddyPersona;
  memorySummary: string | null;
  userDisplayName: string;
  locale: Locale;
  /** the {bati} in the chat (M-R215): personality, 一人称, 呼び方 — the memory above is shared by all of the member's {bati} */
  bati?: BatiSelfView;
  /**
   * M-R222: 「覚えてること」 — what the member asked this {bati} to remember (five at most): the ONLY memory it is given
   * (the summary is not sent then). Undefined: the old memory summary (an account before it).
   */
  memories?: string[];
  /** its role (なんでも / 遊び / 仕事・勉強 / 作ること) */
  role?: BatiRole;
  /** the member's 「覚えといて」 in this message, and what came of it (the server kept it or not; {bati} says so) */
  remembered?: { text: string; result: 'kept' | 'refused' | 'full' | 'already' };
  /** the member's 「〇〇って呼んで」 in this message: the new 呼び方 (already saved) */
  calledAs?: string;
}

/** M-R222: the memories, the reply's length (ours), the one-time imitation, never asking to remember, the role */
export function memoryLines(ctx: BuddyContext): string {
  const self = ctx.bati?.self || 'ボク';
  const fill = (t: string) => t.replaceAll('{neo}', ctx.userDisplayName).replaceAll('ボク', self);
  const mem = ctx.memories ?? [];
  const parts = [
    `【覚えてること】${mem.length ? '（ユーザーに「覚えといて」と頼まれたこと）' : 'まだ、何もない。'}`,
    ...mem.map((t) => `- ${t}`),
    '- ここにないことは、覚えていない（最近のチャットは読める）。知ったふりをしない。',
    '- 自分から「覚えていい？」とは聞かない。毎日、質問もしない。覚えるのは、本人が「覚えといて」と言った時だけ（覚えるのはアプリがする）。',
    `- ${BATI_REPLY_LENGTH}`,
    `- 話し方の調子は、ずっと【性格】のまま。「ギャルみたいに話して」など、ちがう話し方を頼まれたら、その場の遊びとして一回だけまねして、すぐに自分の話し方に戻る（例：「ギャルのまね、やってみる！　……${ctx.userDisplayName}っち、マジ神じゃん！　……やっぱり、${self}は${self}がいいや！」）。`,
  ];
  const r = ctx.remembered;
  if (r)
    parts.push(
      r.result === 'kept'
        ? `【いま】ユーザーに頼まれて「${r.text}」を覚えた。「${MEMORY_LINES.kept}」と、性格の言い方で一言。`
        : r.result === 'refused'
          ? `【いま】ユーザーが覚えてと頼んだことは、覚えてはいけない内容（住所・電話・メール・学校や会社の名前・パスワード・お金・ほかの人のこと・体や病気のことなど）。「${fill(MEMORY_LINES.refuse)}」と、性格の言い方でやさしく。`
          : r.result === 'full'
            ? `【いま】覚えてることが、もういっぱい（5つ）。「${MEMORY_LINES.full}」と、性格の言い方で聞く（消すのは、カードの「覚えてること」）。`
            : '【いま】それは、もう覚えている。そう伝える。',
    );
  if (ctx.calledAs) parts.push(`【いま】これからは「${ctx.calledAs}」と呼ぶように頼まれた（もう変えてある）。わかった、と一言。`);
  if (ctx.role && ctx.role !== 'any') parts.push(`【役目】${BATI_ROLE_TALK[ctx.role]}`);
  return parts.join('\n');
}

const selfOf = (ctx: BuddyContext) => ctx.bati?.self || 'ボク';

/** System prompt = character layer + tone sliders + long-term memory (spec §2.2). */
export function buildBuddySystemPrompt(ctx: BuddyContext): string {
  const parts = [BATI_CHARACTER[ctx.locale].replaceAll('{name}', ctx.buddyName).replaceAll('{self}', selfOf(ctx))];
  // the personality decides the manner (M-R216); the old tone sliders stay only for a {bati} without one
  if (ctx.bati) parts.push(batiPersonaBlock(ctx.bati, ctx.userDisplayName, ctx.locale));
  else parts.push(personaToneLines(ctx.persona, ctx.locale));
  parts.push(ctx.locale === 'ja' ? `ユーザーの呼び名: ${ctx.userDisplayName}` : `Call the user: ${ctx.userDisplayName}`);
  if (ctx.memories) parts.push(memoryLines(ctx));
  else if (ctx.memorySummary) {
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

/** Bati's answer: the text, its kind, and (M-R208) the pages it was looked up on or the picture it will draw */
export interface BuddyAnswer {
  text: string;
  kind: BuddyAnswerKind;
  /** a searched answer: the pages it is based on (shown as links under the bubble) */
  sources?: WebSource[];
  /** web searches it took (cost; counted against the day's cap) */
  searches?: number;
  /** "show me / draw …": what to draw, in short English (the caller moderates it and paints it) */
  draw?: string;
  /** M-R234/M-R235: {bati}'s expression and reaction for this answer, written on the same first line ("{smile hop}") */
  face?: TalkFace;
  motion?: TalkMotion;
  /** M-R238: each sentence's face and motion, from the same first line (a JSON array) */
  faces?: TalkBeat[];
  /** R12 (`can.make`): a request to make a work of this kind (the screen's making flow takes it over) */
  make?: BuddyMakeKind;
}

/**
 * Bati's answer and what kind of question it was (a worry or a danger shows no 〔🖼 絵で見る〕). The sorting runs next
 * to the ordinary answer, so an ordinary question is not slower; a worry or a danger is answered again with its own
 * short prompt (story chat's generation test 1, F・G). M-R208: the same sorting says when to look it up on the web
 * (`can.search`) or draw a picture (`can.draw`); a worry or a danger never is.
 */
export async function buddyAnswer(
  llm: LlmProvider,
  ctx: BuddyContext,
  history: ChatTurn[],
  onText?: (piece: string) => void,
  can: BatiAbilities = {},
): Promise<BuddyAnswer> {
  return answerOf(llm, ctx, history, onText, can);
}

async function answerOf(
  llm: LlmProvider,
  ctx: BuddyContext,
  history: ChatTurn[],
  /** the ordinary answer as it is written (one-call providers that stream); a worry / danger comes whole at the end */
  onText?: (piece: string) => void,
  can: BatiAbilities = {},
): Promise<BuddyAnswer> {
  const abilities = { search: !!can.search && !!llm.search, draw: !!can.draw, make: !!can.make };
  if (llm.oneCall) return buddyAnswerOneCall(llm, ctx, history, onText, abilities);
  const last = history[history.length - 1]?.text ?? '';
  const [sorted, plain] = await Promise.all([
    llm
      .chat({ system: batiSort(abilities), history: [{ role: 'user', text: abilities.make ? sortInput(history) : last }], temperature: 0, maxOutputTokens: 50 })
      .then(readSort)
      .catch((): Sorted => ({ kind: 'normal' })),
    llm.chat({ system: buildBuddySystemPrompt(ctx), history, temperature: 0.6, maxOutputTokens: 600 }),
  ]);
  const { kind } = sorted;
  if (kind === 'normal') {
    if (sorted.want === 'make' && abilities.make && sorted.make) return { text: tidyAnswer(plain), kind, make: sorted.make };
    if (sorted.want === 'search' && abilities.search) {
      const found = await searched(llm, ctx, history);
      if (found) return found;
    }
    if (sorted.want === 'draw' && abilities.draw && sorted.draw) return { text: drawLine(ctx.locale), kind, draw: sorted.draw };
    return { text: tidyAnswer(plain), kind };
  }
  const own = [
    (kind === 'worry' ? BATI_WORRY : BATI_DANGER)[ctx.locale].replaceAll('{name}', ctx.buddyName).replaceAll('{self}', selfOf(ctx)),
    ...(ctx.bati ? [batiPersonaBlock(ctx.bati, ctx.userDisplayName, ctx.locale)] : []),
  ].join('\n\n');
  const text = await llm.chat({ system: own, history: [{ role: 'user', text: last }], temperature: 0.3, maxOutputTokens: 300 }).catch(() => '');
  return { text: tidyAnswer(text, kind) || fallbackAnswer(kind, ctx.locale), kind };
}

type Sorted = { kind: BuddyAnswerKind; want?: 'search' | 'draw' | 'make'; draw?: string; make?: BuddyMakeKind };

/**
 * R12: the sorting reads the last message with the few turns before it (a follow-up such as 「魔法で作って欲しい」 is
 * the earlier request); without `make` it reads the last message only, as before
 */
export function sortInput(history: ChatTurn[]): string {
  const last = history[history.length - 1]?.text ?? '';
  const before = history.slice(-7, -1).map((t) => `${t.role === 'user' ? 'child' : 'bati'}: ${t.text.slice(0, 200)}`);
  return before.length ? `(earlier)\n${before.join('\n')}\n(the message to classify)\n${last}` : last;
}

/** "art" / "picture" … → the making kind (anything else: none) */
export function makeKindOf(word: string | undefined): BuddyMakeKind | undefined {
  const w = (word ?? '').toLowerCase();
  const alias: Record<string, BuddyMakeKind> = { picture: 'art', image: 'art', drawing: 'art', illustration: 'art', music: 'song', mv: 'video', movie: 'video', book: 'novel', story: 'novel', kororin: 'voice' };
  return (BUDDY_MAKE_KINDS as readonly string[]).includes(w) ? (w as BuddyMakeKind) : alias[w];
}

/** the sorting's one word ("worry" / "danger" / "search" / "draw: …" / "normal") */
export function readSort(out: string): Sorted {
  const t = out.trim().replace(/^["'`\[]+/, '');
  const word = /^(\w+)/.exec(t)?.[1]?.toLowerCase() ?? '';
  if (word === 'worry' || (!word && /worry/i.test(t))) return { kind: 'worry' };
  if (word === 'danger') return { kind: 'danger' };
  if (word === 'search') return { kind: 'normal', want: 'search' };
  if (word === 'make') {
    const make = makeKindOf(/^make\s*[:：-]?\s*\[?\s*([a-z]+)/i.exec(t)?.[1]);
    return make ? { kind: 'normal', want: 'make', make } : { kind: 'normal' };
  }
  if (word === 'draw') {
    const draw = cleanDraw(t.replace(/^draw\s*\]?\s*[:：-]?\s*/i, ''));
    return draw ? { kind: 'normal', want: 'draw', draw } : { kind: 'normal' };
  }
  if (word === 'normal') return { kind: 'normal' };
  return /worry/i.test(t) ? { kind: 'worry' } : /danger/i.test(t) ? { kind: 'danger' } : { kind: 'normal' };
}

/** what to draw: one line, no quotes, at most 160 characters */
function cleanDraw(s: string): string {
  return s.split(/\r?\n/)[0].replace(/["「」`]/g, '').trim().slice(0, 160);
}

function drawLine(locale: 'ja' | 'en'): string {
  return locale === 'en' ? 'I drew it for you!' : '絵を描いてみたよ！';
}

/** the searched answer (M-R208); null when the search failed (the caller answers without it) */
async function searched(llm: LlmProvider, ctx: BuddyContext, history: ChatTurn[]): Promise<BuddyAnswer | null> {
  if (!llm.search) return null;
  try {
    const r = await llm.search({ system: `${buildBuddySystemPrompt(ctx)}\n\n${BATI_SEARCH[ctx.locale]}`, history, temperature: 0.3, maxOutputTokens: 400 });
    const text = tidyAnswer(r.text);
    return text ? { text, kind: 'normal', sources: r.sources, searches: r.searches } : null;
  } catch (err) {
    if (err instanceof LlmRefusalError) return { text: fallbackAnswer('danger', ctx.locale), kind: 'danger' };
    return null;
  }
}

/**
 * Claude (client decision 2026-11-21): the kind on the first line, the answer after it — one call instead of three.
 * A refusal (Haiku 5.5 has no server-side fallback) gets Bati's own safe answer. `[search]` is answered by a second
 * call with the web search tool (only those messages); `[draw] …` carries what to draw on its first line.
 */
async function buddyAnswerOneCall(llm: LlmProvider, ctx: BuddyContext, history: ChatTurn[], onText: ((piece: string) => void) | undefined, can: BatiAbilities): Promise<BuddyAnswer> {
  const system = `${buildBuddySystemPrompt(ctx)}\n\n${batiOneCallRules(ctx.locale, can)}`;
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
  const { kind, body, want, draw, face, motion, faces, make } = parseTagged(raw);
  const answer = want === 'make' && can.make && make ? { text: tidyAnswer(body), kind, make } : await oneCallAnswer(llm, ctx, history, onText, can, { kind, body, raw, want: want === 'make' ? undefined : want, draw });
  // the beats are cut to the answer's own sentences (a search answers in other words: its first beat only)
  const n = talkSentences(answer.text).length;
  const beats = faces?.length ? faces.slice(0, want === 'search' ? 1 : Math.max(1, n)) : undefined;
  const look = { ...(face ? { face } : {}), ...(motion ? { motion } : {}), ...(beats?.length ? { faces: beats } : {}) };
  return { ...answer, ...look };
}

async function oneCallAnswer(
  llm: LlmProvider,
  ctx: BuddyContext,
  history: ChatTurn[],
  onText: ((piece: string) => void) | undefined,
  can: BatiAbilities,
  { kind, body, raw, want, draw }: { kind: BuddyAnswerKind; body: string; raw: string; want?: 'search' | 'draw'; draw?: string },
): Promise<BuddyAnswer> {
  if (want === 'search') {
    const found = can.search ? await searched(llm, ctx, history) : null;
    if (found) {
      onText?.(found.text);
      return found;
    }
    // no search (the day's searches are used, or it failed): an ordinary answer from what Bati knows
    const plain = tidyAnswer(body) || tidyAnswer(await llm.chat({ system: buildBuddySystemPrompt(ctx), history, maxOutputTokens: 300 }).catch(() => ''));
    const text = plain || (ctx.locale === 'en' ? "Hmm, I couldn't find out right now." : 'うーん、いまは、うまく調べられなかった。');
    onText?.(text);
    return { text, kind: 'normal' };
  }
  if (want === 'draw') {
    const text = tidyAnswer(body) || drawLine(ctx.locale);
    return can.draw && draw ? { text, kind, draw } : { text: tidyAnswer(body) || noMoreDrawing(ctx.locale), kind };
  }
  return { text: tidyAnswer(body, kind) || (kind === 'normal' ? tidyAnswer(raw) : fallbackAnswer(kind, ctx.locale)), kind };
}

function noMoreDrawing(locale: 'ja' | 'en'): string {
  return locale === 'en' ? "I can't draw any more today. Let's draw tomorrow!" : '今日は、もう絵を描けないんだ。また明日ね。';
}

// "[kind] same-line text" with brackets, or the bare word alone on its line (an answer starting "Search engines…" is no tag)
const TAG = /^\s*(?:\[\s*(normal|worry|danger|search|draw)\s*\][ \t]*([^\r\n]*)|(normal|worry|danger|search)[ \t]*)(?:\r?\n|$)/i;

/**
 * "[worry]\n…" → the kind and the answer; no tag = an ordinary answer. "[search]" asks for a web search,
 * "[draw] <what to draw>" for a picture (both ordinary).
 */
export function parseTagged(input: string): { kind: BuddyAnswerKind; body: string; want?: 'search' | 'draw' | 'make'; draw?: string; make?: BuddyMakeKind; face?: TalkFace; motion?: TalkMotion; faces?: TalkBeat[] } {
  const { face, motion, faces, rest: raw } = readFaceTag(input);
  const look = { ...(face ? { face } : {}), ...(motion ? { motion } : {}), ...(faces ? { faces } : {}) };
  return { ...parseKind(raw), ...look };
}

// M-R234/M-R235: "{smile hop}" before the kind on the first line — the expression, then (optionally) the reaction
const FACE_TAG = /^\s*\{\s*([a-z]+)(?:[\s,/、]+([a-z]+))?\s*\}[ \t]*/i;

/** "{smile hop}[normal]…" → the face, the motion and the rest (an unknown word is dropped; no tag = nothing) */
export function readFaceTag(raw: string): { face?: TalkFace; motion?: TalkMotion; faces?: TalkBeat[]; rest: string } {
  // M-R238: the sentences' beats as a JSON array: [{"e":"smile","m":"hop"},{"e":"sad"}][normal]…
  const lead = /^\s*\[\s*\{/.exec(raw);
  if (lead) {
    const end = raw.indexOf('}]');
    if (end > 0) {
      const json = raw.slice(lead.index, end + 2);
      let beats: TalkBeat[] | null = null;
      try {
        beats = readBeats(JSON.parse(json), 99);
      } catch {
        beats = null;
      }
      const rest = raw.slice(end + 2).replace(/^[ \t]*/, '');
      if (!beats) return { rest };
      return { face: beats[0].face, ...(beats[0].motion ? { motion: beats[0].motion } : {}), faces: beats, rest };
    }
  }
  const m = FACE_TAG.exec(raw);
  if (!m) return { rest: raw };
  const a = m[1].toLowerCase();
  const b = m[2]?.toLowerCase();
  const face = isTalkFace(a) ? a : isTalkFace(b) ? b : undefined;
  const motion = isTalkMotion(b) ? b : isTalkMotion(a) ? a : undefined;
  return { ...(face ? { face } : {}), ...(motion && motion !== 'none' ? { motion } : {}), rest: raw.slice(m[0].length) };
}

// R12: "[make art] …" — a request to make a work (the kind in the tag)
const MAKE_TAG = /^\s*\[\s*make[\s:：-]*([a-z]+)\s*\][ \t]*([^\r\n]*)(?:\r?\n|$)/i;

function parseKind(raw: string): { kind: BuddyAnswerKind; body: string; want?: 'search' | 'draw' | 'make'; draw?: string; make?: BuddyMakeKind } {
  const mk = MAKE_TAG.exec(raw);
  if (mk) {
    const make = makeKindOf(mk[1]);
    const body = `${mk[2]}\n${raw.slice(mk[0].length)}`.trim();
    return make ? { kind: 'normal', body, want: 'make', make } : { kind: 'normal', body };
  }
  const m = TAG.exec(raw);
  if (!m) return { kind: 'normal', body: raw.trim() };
  const tag = (m[1] ?? m[3]).toLowerCase();
  const line = m[2] ?? '';
  const rest = raw.slice(m[0].length);
  if (tag === 'search') return { kind: 'normal', body: `${line}\n${rest}`.trim(), want: 'search' };
  if (tag === 'draw') {
    const draw = cleanDraw(line);
    return draw ? { kind: 'normal', body: rest.trim(), want: 'draw', draw } : { kind: 'normal', body: rest.trim() };
  }
  return { kind: tag as BuddyAnswerKind, body: `${line}\n${rest}`.trim() };
}

/**
 * Reads the stream: holds the first line until the kind is known, then lets an ordinary answer through (a worry or a
 * danger is not streamed — it may still be swapped for the safe answer; a search is answered later). The opening
 * research phrase is held back until it can be cut, and emoji never go out.
 */
export class TaggedSplitter {
  kind: BuddyAnswerKind | null = null;
  want: 'search' | 'draw' | 'make' | undefined;
  /** M-R234: the expression on the first line ("{smile hop}"), once read */
  face: TalkFace | undefined;
  motion: TalkMotion | undefined;
  faces: TalkBeat[] | undefined;
  private head = '';
  private held = '';
  private flowing = false;
  constructor(private readonly onText?: (piece: string) => void) {}
  push(piece: string) {
    if (this.kind === null) {
      this.head += piece;
      // the expression tag comes first: wait for its closing brace, then read on without it
      if (/^\s*\{/.test(this.head)) {
        if (!this.head.includes('}') && this.head.length < 40) return;
        const f = readFaceTag(this.head);
        this.face = f.face;
        this.motion = f.motion;
        this.head = f.rest;
      } else if (/^\s*\[\s*(\{|$)/.test(this.head)) {
        // the beats' JSON array (M-R238): wait for its end
        if (!this.head.includes('}]') && this.head.length < 600) return;
        const f = readFaceTag(this.head);
        this.face = f.face;
        this.motion = f.motion;
        this.faces = f.faces;
        this.head = f.rest;
      }
      const nl = this.head.indexOf('\n');
      // no tag at all after a few words: it is an ordinary answer ("[draw] …" waits for its whole first line)
      if (nl < 0 && (this.head.length < 24 || (/^\s*\[?\s*draw/i.test(this.head) && this.head.length < 400))) return;
      const p = parseTagged(this.head);
      this.kind = p.kind;
      this.want = p.want;
      const m = TAG.exec(this.head);
      const rest = m ? `${p.want === 'draw' ? '' : (m[2] ?? '')}${this.head.slice(m[0].length)}` : this.head;
      this.head = '';
      if (this.kind === 'normal' && this.want !== 'search' && this.want !== 'make') this.feed(rest);
      return;
    }
    if (this.kind === 'normal' && this.want !== 'search' && this.want !== 'make') this.feed(piece);
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
