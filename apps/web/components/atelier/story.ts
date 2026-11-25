import type { ScriptLine } from '@/lib/onboarding/script';
import type { Work } from './work';

/**
 * The atelier opened from a story step (`{t:'atelier', kind, lines}`, days 3–7). The day's script lines are said in the
 * chat word for word, each at its moment (see `cue`), the morning scene has taught already (no OBOLON sheet), and the
 * story goes on with what was made. The fly-or-keep choice that follows is made on the cards themselves (mode 'fly').
 */
export type StoryMode = {
  mode: 'make' | 'fly';
  /** the step's script lines, as written (said in the speaker's manner by `voice`, placeholders filled by `fill` at the moment they are said) */
  lines?: ScriptLine[];
  /** the story's fill() with its vars */
  fill: (text: string) => string;
  /** a line in its speaker's manner, before fill() ({bati}'s lines in its personality: batiLine; others as written) */
  voice: (who: string, text: string) => string;
  /** who says a line: the name shown and the face */
  speaker: (who: string) => { name: string; avatar?: string };
  /** the review page (not real=1): the works are made by stand-ins in this browser — no AI, nothing saved, nothing flown */
  test?: boolean;
  /** Bluena is in hand today (d3.f_d04_bluena) */
  bluena?: boolean;
  /** fly mode: today's cards to fly */
  works?: Work[];
  /** make mode: 〔次へ〕 — the story goes on with the works made here (a kororin's words are in `text`) */
  onDone?: (works: Work[]) => void;
  /** fly mode: a card was flown to its planet */
  onFly?: (planet: string) => void;
  /** fly mode: 〔今は飛ばさない〕 */
  onSkip?: () => void;
};

/** the moments a script line is said at, inside the chat */
export type Cue = 'open' | 'react' | 'spell' | 'fail' | 'saved' | 'sing' | 'after' | 'fix' | 'again' | 'refine' | 'compass' | 'book';

/**
 * Which moment a line belongs to. The step's lines are the script's lines for every way the scene can go (a picked
 * card, a style, a failure …); the chat says the first line of each moment as it happens. Lines for ways this chat does
 * not have (choosing yesterday's card, the mana question, the scene picker) are not said — `unplayed` lists them.
 */
export function cueOf(l: ScriptLine): Cue | null {
  const t = l.text;
  if (l.who === 'コロリン') return 'sing';
  // R12 (day 4): {bati} shows its compass as the talk opens, and keeps the art's spell in its spell book once it is made
  if (/コンパス/.test(t)) return 'compass';
  if (/スペルブック/.test(t)) return 'book';
  if (/——ここに/.test(t)) return 'spell';
  if (/焦げ|凍っ|ぶれちゃ|光らなく/.test(t)) return 'fail';
  if (/しまったよ/.test(t)) return 'saved';
  if (/何回でも/.test(t)) return 'again';
  if (/直してみるね/.test(t)) return 'refine';
  if (/どこを変える|直したい/.test(t)) return 'fix';
  if (/できたー|〔再生〕/.test(t)) return 'after';
  if (/マナ|残しておく|こんな感じ|最初の場面|定番|自分の絵から|主役が先|黒から|逃げない|足したかったら|アートの言葉だけ|窓の地球|顔になる|三つの場面|字だけのアート|地球が、歌詞/.test(t)) return null;
  if (/^じゃあ/.test(t) && !/話してみて|言ってみて|教えて|？/.test(t)) return 'react';
  if (/？|話してみて|言ってみて|教えて/.test(t)) return 'open';
  return null;
}

/** the first line for each moment */
export function cues(lines: ScriptLine[] = []): Partial<Record<Cue, ScriptLine[]>> {
  const out: Partial<Record<Cue, ScriptLine[]>> = {};
  for (const l of lines) {
    const c = cueOf(l);
    if (!c) continue;
    // the singing and what comes after the card are said in full; every other moment says its first line
    if (c === 'sing' || c === 'after') (out[c] ??= []).push(l);
    else out[c] ??= [l];
  }
  return out;
}

export function unplayed(lines: ScriptLine[] = []): ScriptLine[] {
  const used = new Set(Object.values(cues(lines)).flat());
  return lines.filter((l) => !used.has(l));
}

/** the made words in a line: 〈{neo}が吹き込んだ言葉、そのまま〉〈{neo}の言葉〉〈{neo}の場面〉 */
export function withWords(text: string, words: string): string {
  return text.replace(/〈\{neo\}(が吹き込んだ言葉、そのまま|の言葉|の場面)〉/g, words || '……');
}
