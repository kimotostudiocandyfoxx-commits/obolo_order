import { spellWords, type SpellKind, type SpellTag, type SpellView } from '@obolo/shared';
import type { AtelierKind } from '@/lib/atelier/unlock';

/**
 * R11 (client): before anything that spends mana {bati} lays out the スペル (spell) it will cast — 「じゃあ、こういうスペルに
 * なるね」 and its talismans floating over the bowl, each in Japanese (the English behind them is never shown), then
 * 「このスペルで作る？　それとも、どこか変える？」. No buttons: the member says yes in words (「OK」「いいよ」「作って」) or
 * changes it in words (「ピアノも足して」「暗いのは外して」). The yes is tied to exactly that tag set, and the work is made from it.
 */
export type Genre = 'pop' | 'rock' | 'hiphop' | 'ballad' | 'edm';
export type Plan = {
  kind: AtelierKind;
  tags: SpellTag[];
  /** what the last change put on / took off (the card animates them) */
  added: SpellTag[];
  removed: SpellTag[];
  /** the song design's genre (from the genre tag) */
  genre?: Genre;
  /** the Japanese words the making is asked with (what it is about; else the whole spell) */
  words: string;
};

const GENRE: Record<string, Genre> = { pop: 'pop', rock: 'rock', ballad: 'ballad', 'hip hop': 'hiphop', 'dance, EDM': 'edm' };
/** the kinds whose making is a spell */
export const spellKindOf = (kind: AtelierKind): SpellKind | null => (kind === 'song' || kind === 'art' || kind === 'video' || kind === 'look' || kind === 'bati' ? kind : null);

/** the plan for a spell as it is now */
export function planOf(kind: AtelierKind, v: SpellView): Plan {
  const about = v.tags.filter((t) => t.group === 'theme' || t.group === 'wear');
  const genre = GENRE[v.tags.find((t) => t.group === 'genre')?.en ?? ''];
  return { kind, tags: v.tags, added: v.added, removed: v.removed, genre, words: (about.length ? spellWords(about) : spellWords(v.tags)).slice(0, 60) };
}

const YES_WORDS = ['このスペルで作って', 'このスペルで', 'これで作って', 'それで作って', 'おねがいします', 'お願いします', 'おねがい', 'お願い', 'よろしく', 'オッケー', 'おっけー', 'オーケー', 'ok', 'okay', 'おけ', 'いいよ', 'いいね', 'いいです', 'うん', 'はい', 'それで', 'これで', 'そのまま', 'ばっちり', 'だいじょうぶ', '大丈夫', 'gogo', 'go', '作って', 'つくって', 'やって', 'いこう', 'よし'];
/**
 * the member's yes to the plan in words (「OK」「いいよ」「作って」「うん、お願い！」); anything else is a change to the plan.
 * Only yes-words (and the punctuation between them): 「ロックで作って」 is a change, not a yes.
 */
export function isYes(text: string): boolean {
  let t = text.toLowerCase().replace(/[、。,.!！?？〜ー~\s　♪]/g, (c) => (c === 'ー' ? c : ''));
  if (!t) return false;
  for (let guard = 0; t && guard < 12; guard++) {
    const w = YES_WORDS.find((y) => t.startsWith(y));
    if (!w) return false;
    t = t.slice(w.length).replace(/^ー+/, '');
  }
  return !t;
}
