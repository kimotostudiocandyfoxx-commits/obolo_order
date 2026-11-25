import { contextWindow } from '@obolo/shared';
import type { AtelierKind } from '@/lib/atelier/unlock';
import { detect, isBare, KIND_WORD } from './intent';
import type { Msg } from './work';

/**
 * R12 (client: "going back a few messages it forgets — it doesn't remember the message from two turns ago"). The
 * Moon atelier's talk is the memory: every line in it — what was asked, what {bati} said (also the app's own lines:
 * questions, the not-yet line, the spell), what was made — goes to {bati} with the next message (the last 20 turns,
 * bounded by size), and a making request carries over the turns until something is made.
 */
export type Turn = { role: 'user' | 'buddy'; text: string };

/** the kinds that are made (a card); a lookup or a picture search is answered and done */
const MAKING: AtelierKind[] = ['look', 'bati', 'voice', 'art', 'song', 'video', 'radio', 'novel', 'game'];

/** how a made card is told to {bati} (a line, not the card itself) */
function workLine(w: Extract<Msg, { who: 'work' }>['work']): string {
  const what = KIND_WORD[w.kind] ?? w.kind;
  const name = w.title || w.prompt || '';
  if (w.status === 'failed') return `（${what}は、うまく作れなかった）`;
  if (w.status === 'making') return `（${what}「${name.slice(0, 60)}」を作っているところ）`;
  return `（${what}「${name.slice(0, 60)}」ができた）`;
}

/**
 * the talk's recent turns for {bati}, oldest first: the member's words, {bati}'s lines, a line for each card made;
 * the message being sent now is not in it. Consecutive lines of one side are joined (one turn).
 */
export function historyOf(msgs: readonly Msg[], maxMessages?: number, maxChars?: number): Turn[] {
  const out: Turn[] = [];
  for (const m of msgs) {
    const t: Turn | null =
      m.who === 'me'
        ? { role: 'user', text: m.text }
        : m.who === 'bati'
          ? m.text
            ? { role: 'buddy', text: m.plan ? `${m.text}（スペル：${m.plan.tags.map((x) => x.ja).join('・')}）` : m.text }
            : m.pic
              ? { role: 'buddy', text: `（絵を見せた${m.pic.title ? `：${m.pic.title}` : ''}）` }
              : null
          : { role: 'buddy', text: workLine(m.work) };
    if (!t || !t.text.trim()) continue;
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.text = `${last.text}\n${t.text}`.slice(-1200);
    else out.push({ role: t.role, text: t.text.slice(0, 1200) });
  }
  // the first turn {bati} gets is the member's (a greeting before it is only the app's opening)
  while (out.length && out[0].role === 'buddy') out.shift();
  return contextWindow(out, maxMessages, maxChars);
}

/**
 * the making request still open in the talk (newest first, back to the last card made): its kind and what it should
 * be — 「ヤッホー画像を作って欲しいんだけど空飛ぶクジラが…」, then 「魔法で作って欲しい」 → art, 「空飛ぶクジラが…」.
 * A request that named only the kind (「画像を作りたい」) takes the description from an earlier one of the same kind.
 */
export function recentRequest(msgs: readonly Msg[], lookBack = 20): { what: AtelierKind; content: string } | null {
  let what: AtelierKind | null = null;
  let content = '';
  const recent = msgs.slice(-lookBack);
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    // something was made since: that request is done
    if (m.who === 'work' && m.work.status !== 'failed') break;
    if (m.who !== 'me') continue;
    const it = detect(m.text, false);
    if (it.kind === 'make' && MAKING.includes(it.what)) {
      if (what && it.what !== what) break;
      what = it.what;
      if (!isBare(it.content)) {
        content = it.content;
        break;
      }
      continue;
    }
  }
  if (!what) return null;
  return { what, content };
}
