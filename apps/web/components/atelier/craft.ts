import { CRAFT_LINES, isCraftKind, MOON_LINES, questionsFor, spellNamedGroups, type CraftKind, type CraftQuestion, type SpellAnswer, type SpellKind } from '@obolo/shared';
import type { AtelierKind } from '@/lib/atelier/unlock';
import type { Work } from './work';

/**
 * Client 2026-11-25 — 本 and ゲーム in the Moon chat: 「会話で始めて、スペルで決めて、会話で直す」. These are the chat's
 * small rules for them (AtelierChat does the talking): which questions {bati} asks, which spell a change is, what is
 * said once something is made.
 */
export { isCraftKind };
export type CraftAsk = { kind: CraftKind; answers: SpellAnswer[]; left: CraftQuestion[] };

/** the start: what the first words said already counts as an answer; the questions still to ask (2–4) */
export function craftBegin(kind: CraftKind, content: string, bare: boolean): CraftAsk {
  const said = bare ? '' : content.trim();
  return { kind, answers: said ? [{ said }] : [], left: questionsFor(kind, said ? spellNamedGroups(kind, said) : []) };
}

/** one answer in: the next question, or (none left) the answers to distil into the spell */
export function craftAnswer(a: CraftAsk, text: string): CraftAsk {
  const [q, ...left] = a.left;
  return { ...a, answers: [...a.answers, { group: q?.group, said: text.slice(0, 200) }], left };
}

/** what the spell of a making is: a book's first spell, or (a book already there) the next chapter's small one */
export function craftSpellKind(kind: AtelierKind, prev?: Work): SpellKind | null {
  if (kind === 'novel') return prev?.kind === 'novel' && prev.ref?.bookId ? 'chapter' : 'novel';
  if (kind === 'game') return 'game';
  return null;
}

/** {bati}'s question under the spell (a chapter has its own) */
export const craftConfirmLine = (kind: AtelierKind, prev?: Work) => (craftSpellKind(kind, prev) === 'chapter' ? CRAFT_LINES.chapterSpell : MOON_LINES.confirm);
/** the word as it is cast (a book is written at once) */
export const craftStartLine = (kind: AtelierKind) => (kind === 'novel' ? CRAFT_LINES.write : MOON_LINES.start);

/** what {bati} says once a book's chapter / a game is made (the talk then waits for the next words: a change) */
export function craftDoneLines(w: Work): { text: string; vars?: Record<string, number> }[] {
  if (w.kind === 'game') return [{ text: CRAFT_LINES.gameDone }];
  const n = w.book?.chapters.length ?? 1;
  if (w.book?.done) return [{ text: CRAFT_LINES.bookEnd }];
  return [...(n === 1 ? [{ text: CRAFT_LINES.bookKept }] : []), { text: CRAFT_LINES.chapterDone, vars: { n } }];
}

/** words after a book / a game: a new one asked for (「新しい本」), or a change of this one */
export const wantsNew = (text: string) => /新し|あたらし|別の|べつの|もう一冊|もうひとつ|もう一つ/.test(text);
