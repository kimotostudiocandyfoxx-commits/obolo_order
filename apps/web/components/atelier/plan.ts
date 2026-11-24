import type { AtelierKind } from '@/lib/atelier/unlock';
import { pickGenre } from '../../lib/mercury/compose';
import { contentOf } from './intent';

/**
 * R11 (client): before anything that spends mana {bati} says what it will make — a short concrete plan the member says
 * yes to (〔これで作って〕 or 「OK」「いいよ」「作って」), or changes in words. The plan's genre, mood and theme go into the
 * making itself (the song's design is asked for that genre; the words carry the mood and the theme).
 */
export type Genre = 'pop' | 'rock' | 'hiphop' | 'ballad' | 'edm';
export type Plan = {
  kind: AtelierKind;
  /** what it is about (the member's own words) */
  theme: string;
  /** a song's genre and a mood (the art's touch, the MV's air) */
  genre?: Genre;
  mood?: string;
  /** the plan in one short phrase, as {bati} says it and the card shows it */
  text: string;
  /** the words the making is asked with (theme + mood + genre) */
  words: string;
};

const GENRE_WORD: Record<Genre, string> = { pop: 'ポップ', rock: 'ロック', hiphop: 'ヒップホップ', ballad: 'バラード', edm: 'ダンス曲' };
/** a genre named outright (「ロックで」) wins over one guessed from the theme */
const GENRE_NAMED: [RegExp, Genre][] = [
  [/ロック|rock/i, 'rock'],
  [/バラード|ballad/i, 'ballad'],
  [/ヒップホップ|ラップ|hip ?hop/i, 'hiphop'],
  [/EDM|ダンス|クラブ|テクノ/i, 'edm'],
  [/ポップ|pop/i, 'pop'],
];
const MOODS: [RegExp, string][] = [
  [/明る|あかる|楽し|たのし|ハッピー/, '明るい'],
  [/元気|げんき|アップテンポ|はげし|激し/, '元気な'],
  [/しっとり|切な|せつな|さみし|寂し|泣/, 'しっとりした'],
  [/やさし|優し|ほっこり|あったか|温か/, 'やさしい'],
  [/ゆったり|のんびり|チル|落ち着|おちつ|静か|しずか/, 'ゆったりした'],
  [/かっこ|クール|おしゃれ/, 'かっこいい'],
  [/ふしぎ|不思議|幻想|ミステリ/, 'ふしぎな'],
];
/** style words taken out of the theme (they become the genre / the mood) */
const STYLE = /(ロック|バラード|ヒップホップ|ラップ|EDM|ダンス曲?|クラブ|テクノ|ポップ|明るい?|あかるい?|楽しい?|元気な?|しっとり(した)?|切ない|やさしい|優しい|ゆったり(した)?|のんびり(した)?|チル|かっこいい|クールな?|ふしぎな?|不思議な?)(な|で|の|に|っぽい|感じ|かんじ|系)*/g;

const genreOf = (t: string): Genre | undefined => GENRE_NAMED.find(([re]) => re.test(t))?.[1];
const moodOf = (t: string): string | undefined => MOODS.find(([re]) => re.test(t))?.[1];
const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** the theme in the member's words, the style words and the kind's own words taken out */
export function themeOf(words: string): string {
  const t = contentOf(words)
    .replace(STYLE, '')
    .replace(/^(曲|歌|うた|絵|映像|MV)(を|で|の)?|(の|な)?(曲|歌|うた|絵|映像|MV)$/g, '')
    .replace(/^[、。,.\s　をのでにがは]+|[、。,.\s　をのでにがは]+$/g, '')
    .trim();
  return clip(t, 24);
}

/**
 * the plan for words asked (`before`: the plan being changed — a change keeps what it does not name: 「ロックにして」
 * keeps the theme and the mood)
 */
export function planFor(kind: AtelierKind, said: string, before?: Plan | null): Plan {
  const theme = themeOf(said) || before?.theme || '';
  if (kind === 'song') {
    const genre = genreOf(said) ?? before?.genre ?? (pickGenre(said) as Genre);
    const mood = moodOf(said) ?? before?.mood ?? (genre === 'ballad' ? 'しっとりした' : genre === 'rock' ? '元気な' : '明るい');
    const what = theme ? `「${theme}」の歌` : 'きみの歌';
    return { kind, theme, genre, mood, text: `${what}を、${mood}${GENRE_WORD[genre]}で`, words: theme ? `${theme}。${mood}${GENRE_WORD[genre]}` : `${mood}${GENRE_WORD[genre]}の歌` };
  }
  const mood = moodOf(said) ?? before?.mood;
  const air = mood ? `${mood.replace(/な$|した$/, '')}感じで` : '';
  if (kind === 'art') return { kind, theme, mood, text: `「${theme || said}」の絵を、${air || 'やわらかい色で'}描く`, words: [theme || said, mood && `${mood}感じ`].filter(Boolean).join('、') };
  if (kind === 'video') return { kind, theme, mood, text: `「${theme || said}」の映像を、${air}いちばん新しい曲にのせて`, words: [theme || said, mood && `${mood}感じ`].filter(Boolean).join('、') };
  if (kind === 'bati') return { kind, theme, mood, text: `「${theme || said}」のかっこうに着がえる`, words: said };
  if (kind === 'look') return { kind, theme, mood, text: `きみの姿を「${theme || said}」に変える`, words: said };
  return { kind, theme, mood, text: theme || said, words: said };
}

/** the few ideas offered under {bati}'s question when the ask was vague (tapping one answers it) */
export const IDEA_CHIPS: Partial<Record<AtelierKind, string[]>> = {
  song: ['明るいポップ', 'しっとりバラード', '元気なロック'],
  art: ['夜の海とクジラ', 'ふわふわの動物', '星空の街'],
  video: ['夜空をとぶ', '海辺をさんぽ', 'ネオンの街'],
  look: ['もっとかっこよく', 'ふんわりかわいく', '宇宙っぽく'],
  bati: ['魔法使い', 'パジャマ', '宇宙飛行士'],
};

/** the plan card's buttons */
export const YES = 'これで作って';
export const CHANGE = '変える';

const YES_WORDS = ['これで作って', 'それで作って', 'おねがいします', 'お願いします', 'おねがい', 'お願い', 'よろしく', 'オッケー', 'おっけー', 'オーケー', 'ok', 'okay', 'おけ', 'いいよ', 'いいね', 'いいです', 'うん', 'はい', 'それで', 'これで', 'そのまま', 'ばっちり', 'だいじょうぶ', '大丈夫', 'gogo', 'go', '作って', 'つくって', 'やって', 'いこう', 'よし'];
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
