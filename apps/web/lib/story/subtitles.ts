import { talkPlain } from '@obolo/shared';

/**
 * The story's words for the talk: the script writes its exclamations as ASCII 「!!」 (「歌うんだZE!!　聞いてみるZE!!」),
 * which the talk reads as its shout mark (`!!…!!`, M-R243) — the words between two of them turned bold and the marks
 * vanished, and the line no longer split at its sentence end (review of M-R251, D04-S005: two phrases side by side in one
 * subtitle). Shown as the full-width 「！！」 instead: the same words, no mark, a sentence end again.
 */
export const storyWords = (text: string) => text.replace(/!{2,}/g, (m) => '！'.repeat(m.length));

/**
 * A subtitle's pieces (client review of M-R251, D04-S005: "one line at a time"): one sentence each — never two side by
 * side — and a sentence longer than `max` plain characters cut after its 「、」 and packed up to `max` (two lines at
 * 390 px). The marks (**…**, ^^…^^, !!…!!, [[金:…]]) stay whole inside a piece; spaces and line breaks at a piece's
 * ends are dropped. `from` / `len` count the plain characters (talkPlain), where the piece starts in the line and how
 * many it holds, so the words still come with the voice.
 */
const MARK_ANY = /\[\[(?:金|赤|かわいい|しんみり):.+?\]\]|(\*\*|\^\^|!!).+?\1/g;
export function subtitlePieces(marked: string, max = 30): { text: string; from: number; len: number }[] {
  // tokens: a whole mark, or one character
  const toks: string[] = [];
  let k = 0;
  for (const m of marked.matchAll(MARK_ANY)) {
    toks.push(...[...marked.slice(k, m.index)]);
    toks.push(m[0]);
    k = m.index! + m[0].length;
  }
  toks.push(...[...marked.slice(k)]);
  const plainLen = (t: string) => [...talkPlain(t)].length;
  const TAIL = /^[。！？!?」』）)～〜ー♪☆★⭐︎]$/u;
  // sentences: cut after an end mark, unless what follows still belongs to it (more marks, a closing bracket)
  const sentences: string[] = [];
  let cur = '';
  for (let i = 0; i < toks.length; i++) {
    cur += toks[i];
    const next = toks[i + 1];
    if (toks[i].length === 1 && /[。！？!?][」』）)]*$/.test(cur) && (next == null || !TAIL.test(next))) {
      sentences.push(cur);
      cur = '';
    }
  }
  if (cur) sentences.push(cur);
  // a long sentence: cut after 「、」, then packed up to max
  const bits: string[] = [];
  for (const snt of sentences) {
    if (plainLen(snt.trim()) <= max) {
      bits.push(snt);
      continue;
    }
    const parts = snt.match(/(?:\[\[[^\]]*\]\]|\*\*.+?\*\*|\^\^.+?\^\^|!!.+?!!|[^、，])+[、，]?|[、，]/g) ?? [snt];
    const packs: string[] = [];
    for (const b of parts) {
      const last = packs[packs.length - 1];
      // a pause of bare 「、、、」 never stands alone: it goes with the words after it
      if (last != null && (plainLen((last + b).trim()) <= max || /^[、，\s\u3000]+$/.test(last))) packs[packs.length - 1] = last + b;
      else packs.push(b);
    }
    // a piece still too long (no 「、」 to cut at, no marks inside): cut into even parts, after a kana where it can
    for (const pk of packs) {
      const chars = [...pk];
      if (plainLen(pk.trim()) <= max || talkPlain(pk) !== pk) {
        bits.push(pk);
        continue;
      }
      const n = Math.ceil(chars.length / max);
      const size = Math.ceil(chars.length / n);
      let at = 0;
      while (at < chars.length) {
        let end = Math.min(chars.length, at + size);
        // prefer ending after a particle-like kana (は・が・を・に・で・と・も・の) within 4 characters back
        for (let k = end; k > end - 4 && k > at + 4 && end < chars.length; k--) if (/[はがをにでとものへ]/.test(chars[k - 1])) { end = k; break; }
        bits.push(chars.slice(at, end).join(''));
        at = end;
      }
    }
  }
  const out: { text: string; from: number; len: number }[] = [];
  let from = 0;
  for (const b of bits) {
    const len = plainLen(b);
    const lead = b.match(/^[\s\u3000]*/)![0];
    const text = b.trim().replace(/^\u3000+|\u3000+$/g, '');
    if (text) out.push({ text, from: from + [...lead].length, len: plainLen(text) });
    from += len;
  }
  return out;
}

