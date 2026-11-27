/**
 * Client 2026-11-27: words that were heard are fixed in place — a tap on the sentence puts a caret there, 〔けす〕 takes
 * one character away per press, a long press selects a stretch and 〔まとめてけす〕 takes it away, and the mic then puts
 * the new words AT the caret (in place of the stretch), not at the end. The rules, with no DOM (components/mic/
 * VoiceText.tsx is the one component every voice input shows them with). Tests: edit.test.ts.
 *
 * Positions are UTF-16 offsets (as a string is indexed) that always fall between whole characters as a person sees
 * them: an emoji (a surrogate pair, a family joined with ZWJ, a flag), a kana with its dakuten typed apart, a letter
 * with a combining mark are each ONE press of 〔けす〕 and can never be cut in two.
 */

/** a caret (a === b) or a selected stretch (a < b) */
export type Sel = { a: number; b: number };

type Segmenter = { segment(s: string): Iterable<{ segment: string; index: number }> };
let seg: Segmenter | null | undefined;
function segmenter(): Segmenter | null {
  if (seg !== undefined) return seg;
  try {
    const S = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => Segmenter }).Segmenter;
    seg = S ? new S('ja', { granularity: 'grapheme' }) : null;
  } catch {
    seg = null;
  }
  return seg;
}

/** combining marks, variation selectors, the (semi-)voiced sound marks typed apart, emoji skin tones */
const JOINS = /^(?:\p{M}|[︀-️‍゙゚]|\uD83C[\uDFFB-\uDFFF])$/u;

/** the characters of a text as a person sees them, each with its place: [{ o: start, e: end, ch }] */
export function chars(text: string): { o: number; e: number; ch: string }[] {
  const out: { o: number; e: number; ch: string }[] = [];
  const s = segmenter();
  if (s) {
    for (const g of s.segment(text)) out.push({ o: g.index, e: g.index + g.segment.length, ch: g.segment });
    return out;
  }
  // an old browser: code points, with what joins onto the one before (marks, ZWJ sequences) kept with it
  let zwj = false;
  for (const cp of Array.from(text)) {
    const last = out[out.length - 1];
    if (last && (zwj || JOINS.test(cp))) {
      last.ch += cp;
      last.e += cp.length;
    } else out.push({ o: last ? last.e : 0, e: (last ? last.e : 0) + cp.length, ch: cp });
    zwj = cp === '‍';
  }
  return out;
}

/** every place a caret may stand: 0, after each character */
export function stops(text: string): number[] {
  return [0, ...chars(text).map((c) => c.e)];
}

/** a position moved back onto a caret stop (never inside a character) and into the text */
export function snap(text: string, at: number): number {
  const p = Math.max(0, Math.min(text.length, Math.floor(at)));
  let best = 0;
  for (const s of stops(text)) {
    if (s > p) break;
    best = s;
  }
  return best;
}

/** a selection made sound for this text: ordered, inside it, on whole characters (its end rounded out) */
export function sane(text: string, sel: Sel | null | undefined): Sel | null {
  if (!sel) return null;
  const lo = Math.min(sel.a, sel.b);
  const hi = Math.max(sel.a, sel.b);
  const a = snap(text, lo);
  // a caret stays a caret (moved back off the character it stood in)
  if (lo === hi) return { a, b: a };
  let b = snap(text, hi);
  // a far end inside a character takes the whole character
  if (b < Math.min(hi, text.length)) b = stops(text).find((s) => s > b) ?? text.length;
  return { a, b: Math.max(a, b) };
}

export type Edit = { text: string; sel: Sel };

/** 〔まとめてけす〕: the selected stretch goes; the caret stands where it was */
export function deleteRange(text: string, sel: Sel): Edit {
  const s = sane(text, sel) ?? { a: text.length, b: text.length };
  return { text: text.slice(0, s.a) + text.slice(s.b), sel: { a: s.a, b: s.a } };
}

/** 〔けす〕: the one character before the caret goes (a stretch, if one is selected, goes whole); at the start: nothing */
export function deleteBack(text: string, sel: Sel): Edit {
  const s = sane(text, sel) ?? { a: text.length, b: text.length };
  if (s.a !== s.b) return deleteRange(text, s);
  if (s.a === 0) return { text, sel: s };
  const before = [...stops(text)].reverse().find((p) => p < s.a) ?? 0;
  return { text: text.slice(0, before) + text.slice(s.a), sel: { a: before, b: before } };
}

/** a text cut to at most `max` UTF-16 units without cutting a character in two */
export function clip(text: string, max: number | undefined): string {
  if (!max || text.length <= max) return text;
  return text.slice(0, snap(text, max));
}

/**
 * New words go in AT the caret, or in place of the selected stretch; with no caret (`null`: nothing was tapped) at the
 * end. The caret then stands after them. `max`: the field's length — what does not fit is cut from the END of the
 * whole text, as the field itself would (the caret stays inside).
 */
export function insertAt(text: string, sel: Sel | null | undefined, words: string, max?: number): Edit {
  const s = sane(text, sel) ?? { a: text.length, b: text.length };
  const next = clip(text.slice(0, s.a) + words + text.slice(s.b), max);
  const at = Math.min(snap(next, s.a + words.length), next.length);
  return { text: next, sel: { a: at, b: at } };
}

/** where one character is drawn on the screen */
export type CharBox = { o: number; e: number; left: number; right: number; top: number; bottom: number };

/** the character nearest a point: on the point's own line when there is one, else on the nearest line */
export function boxAt(boxes: readonly CharBox[], x: number, y: number): CharBox | null {
  if (!boxes.length) return null;
  const dy = (b: CharBox) => (y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0);
  const dx = (b: CharBox) => (x < b.left ? b.left - x : x > b.right ? x - b.right : 0);
  let best = boxes[0];
  for (const b of boxes) {
    const d = dy(b) - dy(best) || dx(b) - dx(best);
    if (d < 0) best = b;
  }
  return best;
}

/** a tap → the caret: before the character when the tap is on its left half, after it on its right half */
export function caretAt(boxes: readonly CharBox[], x: number, y: number, length: number): number {
  const b = boxAt(boxes, x, y);
  if (!b) return length;
  return x > (b.left + b.right) / 2 ? b.e : b.o;
}

/** a long press on one character, dragged to another: the stretch from the one to the other, both whole */
export function stretch(anchor: Pick<CharBox, 'o' | 'e'>, now: Pick<CharBox, 'o' | 'e'>): Sel {
  return { a: Math.min(anchor.o, now.o), b: Math.max(anchor.e, now.e) };
}

/** PROVISIONAL wording (the story chat confirms) */
export const EDIT_WORDS = {
  /** shown once, the first time words that were heard are on the screen */
  hint: '文をタップすると、そこから直せるよ。マイクで言い直してもOK',
  del: 'けす',
  delRange: 'まとめてけす',
  /** the whole sentence away (the talk's old 〔けす〕) */
  clear: 'ぜんぶけす',
  label: '聞きとった文。タップすると、そこから直せます',
} as const;

const HINT_KEY = 'obolo.mic.editHint';
/** true the first time on this device (and marks it shown) */
export function editHintOnce(store: Pick<Storage, 'getItem' | 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): boolean {
  try {
    if (!store || store.getItem(HINT_KEY)) return false;
    store.setItem(HINT_KEY, '1');
    return true;
  } catch {
    return false;
  }
}
