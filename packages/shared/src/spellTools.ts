import { z } from 'zod';
import { SpellTags, spellDefaultLabels, spellFrom, type SpellKind, type SpellTag } from './spell';
import { SongLyrics } from './lyrics';

/**
 * R12 (client 2026-11-25): the two tools {bati} carries — never shown in the talk all the time; {bati} brings them out
 * when they help, and the member can ask for them in words.
 *  - コンパス: reads a spell from something — a picture handed to {bati} (the 📎, a pasted image) → a picture spell; a
 *    YouTube link pasted in the talk → a song spell ("in the style of" tags only: never the lyrics, never the name of a
 *    singer, a band or the song itself). The read spell floats up like any spell and goes on to 「このスペルで作る？」.
 *  - スペルブック: keeps the spells the member liked (kind + tags + a name from what it is about, e.g. 「夏の海のポップ」),
 *    on the server, at most SPELL_BOOK_MAX. 「スペルブック出して」 opens it; 「夏の海のやつ使って」 brings one back as the
 *    spell; 「名前を〇〇にして」 renames; 「〇〇は捨てて」 throws one away (after a question).
 */

/** the kinds a spell book keeps (a chapter's small spell is not kept: the book's own spell is) */
export const SPELL_BOOK_KINDS = ['song', 'art', 'video', 'look', 'bati', 'novel', 'game'] as const satisfies readonly SpellKind[];
export type SpellBookKind = (typeof SPELL_BOOK_KINDS)[number];
export const SPELL_BOOK_MAX = 200;
export const SPELL_NAME_MAX = 16;

export const SaveSpellBody = z.object({
  kind: z.enum(SPELL_BOOK_KINDS),
  tags: SpellTags,
  /** none: a name from the spell's content (spellBookName) */
  name: z.string().trim().min(1).max(SPELL_NAME_MAX).optional(),
  /** R13: a song spell's second part, its lyrics with metatags (kept with the style talismans) */
  lyrics: SongLyrics.optional(),
}).refine((b) => !b.lyrics || b.kind === 'song', { message: 'lyrics only with a song spell' });
export type SaveSpellBody = z.infer<typeof SaveSpellBody>;
export const RenameSpellBody = z.object({ name: z.string().trim().min(1).max(40) });
export type RenameSpellBody = z.infer<typeof RenameSpellBody>;
export interface SavedSpell {
  id: string;
  kind: SpellBookKind;
  name: string;
  tags: SpellTag[];
  /** R13: a song spell's lyrics with metatags (none: the style talismans only — a compass reading never has lyrics) */
  lyrics?: SongLyrics;
  createdAt: string;
  /** the last time it was brought back as the spell (none: never) */
  usedAt: string | null;
}
/** POST /moon/spellbook: the spell kept (or the one already kept with the same tags: `already`) */
export type SaveSpellResult = SavedSpell & { already?: boolean };

/** POST /moon/compass: one of a photo handed to {bati} (a 📎 file of yours), a pasted image, or a YouTube link */
export const MoonCompassBody = z
  .object({
    fileId: z.string().uuid().optional(),
    image: z.object({ mime: z.string().regex(/^image\/(png|jpeg|webp|gif|heic|heif)$/), data: z.string().max(7_000_000) }).optional(),
    url: z.string().max(300).optional(),
  })
  .refine((b) => [b.fileId, b.image, b.url].filter(Boolean).length === 1, { message: 'one of fileId, image or url' })
  .refine((b) => !b.url || !!youtubeLink(b.url), { message: 'a YouTube link' });
export type MoonCompassBody = z.infer<typeof MoonCompassBody>;
/** what the compass read: a picture spell (art) or a song spell; `via`: how a song was read (the video itself, or only its title) */
export interface CompassSpell {
  kind: 'art' | 'song';
  tags: SpellTag[];
  via: 'image' | 'video' | 'title';
}

// --- the links the compass reads ---------------------------------------------------------------------------------

/**
 * a YouTube link in what was said (youtube.com/watch, youtu.be, music.youtube.com, shorts, live), as the plain watch
 * link (null: none)
 */
export function youtubeLink(text: string): string | null {
  const m = text.match(/https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^\s#]*?&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})(?![\w-])/i);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : null;
}

// --- a saved spell's name --------------------------------------------------------------------------------------

const KIND_NAME: Record<SpellBookKind, string> = { song: '曲', art: '絵', video: '映像', look: 'すがた', bati: 'きせかえ', novel: 'お話', game: 'ゲーム' };
/** an adjective before a noun: 明るいポップ, 静かなバラード (not 明るいのポップ) */
const adj = (w: string) => (/(い|しい)$/.test(w) ? w : /(か|り|気|みたい)$/.test(w) ? `${w}な` : null);

/**
 * a spell's name from what it is about: 「夏の海のポップ」 (song: what it is about + its genre), 「夜の海の水彩」 (picture:
 * + its touch), 「魔法の森のファンタジー」 (book: world + genre), 「猫のよけるゲーム」 (game: hero + genre); nothing about →
 * its mood + the head (「明るいポップ」); at most SPELL_NAME_MAX characters
 */
export function spellBookName(kind: SpellBookKind, tags: SpellTag[]): string {
  const g = (k: SpellTag['group']) => tags.filter((t) => t.group === k).map((t) => t.ja);
  let about: string[] = [];
  let head: string | undefined;
  switch (kind) {
    case 'song':
      about = g('theme');
      head = g('genre')[0];
      break;
    case 'art':
    case 'video':
      about = g('theme');
      head = g('style')[0];
      break;
    case 'look':
    case 'bati':
      about = [...g('wear'), ...g('theme')];
      head = g('style')[0];
      break;
    case 'novel':
      about = [...g('world'), ...g('hero'), ...g('theme')];
      head = g('genre')[0];
      break;
    case 'game':
      about = [...g('hero'), ...g('theme')];
      head = `${g('genre')[0] ?? ''}ゲーム`;
      break;
  }
  head ??= KIND_NAME[kind];
  about = [...new Set(about)].filter((a) => a !== head);
  const fit = (s: string) => [...s].length <= SPELL_NAME_MAX;
  if (!about.length) {
    const mood = g('mood')[0];
    const a = mood ? adj(mood) : null;
    const n = a ? `${a}${head}` : mood ? `${mood}の${head}` : head;
    return [...n].slice(0, SPELL_NAME_MAX).join('');
  }
  for (const n of [[...about.slice(0, 2), head], [about[0], head], [...about.slice(0, 2)], [about[0]]]) {
    const s = n.join('の');
    if (fit(s)) return s;
  }
  return [...about[0]].slice(0, SPELL_NAME_MAX).join('');
}

/** the name as given (「」 and the like off, at most SPELL_NAME_MAX); another spell's name gets a number (夏の海のポップ2) */
export function spellNameClean(name: string): string {
  return [...name.replace(/[「」『』"'“”]/g, '').replace(/\s+/g, ' ').trim()].slice(0, SPELL_NAME_MAX).join('');
}
export function spellNameUnique(name: string, taken: string[]): string {
  const has = new Set(taken);
  if (!has.has(name)) return name;
  for (let i = 2; i < 999; i++) {
    const tail = String(i);
    const n = [...name].slice(0, SPELL_NAME_MAX - tail.length).join('') + tail;
    if (!has.has(n)) return n;
  }
  return name;
}

// --- finding a saved spell from words --------------------------------------------------------------------------

const kana = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const norm = (s: string) => kana(s.toLowerCase().replace(/[\s　、。,.!！?？「」『』"'・ー〜~]/g, ''));
/** the words around a name: 「スペルブックの『夏の海のやつ』を使って」 → 夏の海 */
export function spellQuery(said: string): string {
  return said
    .replace(/スペルブック(の|から|に)?/g, '')
    .replace(/(を|は|の|で|が)?(使って|つかって|使いたい|つかいたい|使おう|使う|つかう|出して|だして|見せて|みせて|開いて|ひらいて|見たい|みたい|にして|で作って|でつくって|もとにして|捨てて|すてて|捨てる|すてる|捨てたい|処分して|消して|けして)(ください|ほしい|くれる|くれ|ね|よ|！|!)*.*$/, '')
    .replace(/(の)?(やつ|ヤツ|スペル|の?呪文)$/g, '')
    .replace(/[「」『』]/g, '')
    .replace(/^(あの|その|この|えっと|じゃあ|やっぱり?)/, '')
    .trim();
}
const bigrams = (s: string) => {
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) ?? 0) + 1);
  return out;
};
function dice(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const x = bigrams(a);
  const y = bigrams(b);
  let n = 0;
  for (const [k, c] of x) n += Math.min(c, y.get(k) ?? 0);
  return (2 * n) / (a.length - 1 + (b.length - 1));
}

/** how well the words name this spell (0–1): its name, then its talismans' words */
export function spellScore(query: string, s: Pick<SavedSpell, 'name' | 'tags'>): number {
  const q = norm(spellQuery(query));
  if (!q) return 0;
  const name = norm(s.name);
  if (q === name) return 1;
  if ((name.includes(q) && q.length >= 2) || (q.includes(name) && name.length >= 2)) return 0.9;
  const words = spellQuery(query)
    .split(/[のとや、\s　]+/)
    .map(norm)
    .filter((w) => w.length >= 1);
  const labels = [...s.tags.map((t) => norm(t.ja)), ...s.name.split('の').map(norm)];
  const hit = words.filter((w) => labels.some((l) => l === w || (w.length >= 2 && (l.includes(w) || w.includes(l)) && l.length >= 2)));
  const byWords = words.length ? (hit.length / words.length) * 0.82 : 0;
  return Math.max(byWords, dice(q, name) * 0.75);
}

/**
 * the saved spell the words mean (「夏の海のやつ」): the best one when it is clear, `close` when two or more are as good
 * (then {bati} asks which), none when nothing is near
 */
export function findSpell<T extends Pick<SavedSpell, 'name' | 'tags'>>(query: string, spells: T[]): { spell?: T; close: T[] } {
  const scored = spells.map((s) => ({ s, k: spellScore(query, s) })).sort((a, b) => b.k - a.k);
  const best = scored[0];
  if (!best || best.k < 0.45) return { close: [] };
  const close = scored.filter((x) => x.k >= best.k - 0.05 && x.k >= 0.45).map((x) => x.s);
  if (best.k >= 1 || close.length === 1) return { spell: best.s, close: [best.s] };
  return { close: close.slice(0, 3) };
}

/**
 * a member asking for a kind (「夏の海の曲つくって」): a saved spell of that kind that fits the words well — two of the
 * words they named are in it (the kind's defaults do not count), or the one word they named is
 */
export function bookMatch<T extends Pick<SavedSpell, 'name' | 'tags' | 'kind'>>(kind: SpellKind, said: string, spells: T[]): T | null {
  const base = new Set(spellDefaultLabels(kind));
  const asked = spellFrom(kind, said).filter((t) => !base.has(t.ja) && !(kind === 'song' && (t.group === 'tempo' || t.group === 'instrument')));
  if (!asked.length) return null;
  let best: { s: T; n: number; r: number } | null = null;
  for (const s of spells) {
    if (s.kind !== kind) continue;
    const n = asked.filter((a) => s.tags.some((t) => t.ja === a.ja || t.en.toLowerCase() === a.en.toLowerCase())).length;
    const ok = n >= 2 || (asked.length === 1 && n === 1);
    const r = n / new Set([...asked.map((a) => a.ja), ...s.tags.map((t) => t.ja)]).size;
    if (ok && (!best || r > best.r)) best = { s, n, r };
  }
  return best?.s ?? null;
}

// --- when {bati} brings the spell book out by itself ------------------------------------------------------------

/** a happy word about the work just made (「いいね」「最高」「好き」…), not a 「もっと…」 change or a no */
export function isHappy(text: string): boolean {
  const t = text.replace(/\s/g, '');
  if (!t || t.length > 40) return false;
  if (/(好き|すき|いい|良い|最高)(じゃない|じゃな|ではな|くない)|嫌い|きらい|微妙|びみょう|いまいち|イマイチ|ちがう|違う|変えて|かえて|直して|なおして|もっと|やり直|外して|足して|ほしい|欲しい/.test(t)) return false;
  return /いいね|いい感じ|いいかんじ|いいじゃん|いいよね|最高|さいこう|サイコー|好き|すき|スキ|すごい|すご|すばらし|すてき|素敵|かわいい|可愛い|かっこいい|カッコいい|きれい|綺麗|気に入|きにい|やばい|ヤバい|神|天才|うれしい|嬉しい|完璧|ばっちり|わーい|やった|エモい|上手|じょうず|nice|good|love|cool/i.test(t);
}

/** what this device remembers about {bati}'s offers (a count of the works made, and when it last offered) */
export type SpellToolMemory = { works: number; offeredAt: number | null; asks: number; suggestedAt: number | null };
export const SPELL_TOOL_MEMORY_EMPTY: SpellToolMemory = { works: 0, offeredAt: null, asks: 0, suggestedAt: null };
/** 「このスペル、スペルブックにしまっておく？」 at most once in this many works (so never for two works in a row) */
export const SPELL_OFFER_GAP = 3;
/** 「スペルブックの『…』をもとにする？」 at most once in this many asks */
export const SPELL_SUGGEST_GAP = 4;

/** {bati} asks to keep the spell: a happy word, not kept yet, and not within the last few works */
export function shouldOfferSave(m: SpellToolMemory, o: { happy: boolean; kept: boolean }): boolean {
  if (!o.happy || o.kept || m.works < 1) return false;
  return m.offeredAt == null || m.works - m.offeredAt >= SPELL_OFFER_GAP;
}
/** {bati} suggests a saved spell: not within the last few asks */
export function shouldSuggestBook(m: SpellToolMemory): boolean {
  return m.suggestedAt == null || m.asks - m.suggestedAt >= SPELL_SUGGEST_GAP;
}

// --- the member's words about the tools --------------------------------------------------------------------------

export type SpellToolIntent =
  | { tool: 'compass' }
  | { tool: 'book' }
  | { tool: 'close' }
  | { tool: 'page'; step: 1 | -1 }
  | { tool: 'save' }
  | { tool: 'rename'; name: string }
  | { tool: 'use'; query: string; named: boolean }
  | { tool: 'discard'; query: string };

const ASK_OUT = /(出して|だして|出てきて|見せて|みせて|ちょうだい|貸して|かして|使いたい|つかいたい|使わせて|使って|つかって|使う|つかう|ある？|お願い|おねがい|開いて|ひらいて|見たい|みたい|読んで|よんで)/;
/**
 * what the words ask of a tool (null: nothing). `open`: the spell book is open (its page words, 「〇〇使って」 and 「とじて」
 * mean it then)
 */
export function spellToolIntent(text: string, open = false): SpellToolIntent | null {
  const t = text.replace(/[\s、,]/g, '').trim();
  if (!t) return null;
  if (/コンパス/.test(t) && (ASK_OUT.test(t) || /^コンパス[!！。？?]*$/.test(t))) return { tool: 'compass' };
  const rename = t.match(/(?:名前|なまえ)を?[「『]?(.+?)[」』]?(?:に|って)(?:して|変えて|かえて|する|しよう|しといて|しておいて)/) ?? t.match(/[「『]?(.+?)[」』]?って(?:名前|なまえ)に(?:して|する|しよう)/);
  if (rename && rename[1] && !/スペルブック/.test(rename[1])) return { tool: 'rename', name: spellNameClean(rename[1]) };
  const discard = t.match(/^(.+?)(?:は|を|も)?(?:捨てて|すてて|捨てる|すてる|捨てたい|すてたい|処分して)/);
  if (discard && spellQuery(t)) return { tool: 'discard', query: spellQuery(t) };
  if (/スペルブック/.test(t) && /(しまって|しまっ(と|て)いて|しまっとこ|入れて|いれて|保存)/.test(t)) return { tool: 'save' };
  if (/^(それ|これ|いまの|今の|このスペル|そのスペル|スペル)?(を|は)?(しまって|しまっといて|しまっておいて|しまっとこ|しまおう|とっておいて|取っておいて|とっといて|保存して|ほぞんして)/.test(t)) return { tool: 'save' };
  if (open && /(とじて|閉じて|しめて|閉めて|もういい|おしまい)/.test(t)) return { tool: 'close' };
  if (open && /(次|つぎ|めくって|めくる|ページ|先)/.test(t) && !/(前|まえ|もど)/.test(t) && !/(使|つか)/.test(t)) return { tool: 'page', step: 1 };
  if (open && /(前|まえ|もど)/.test(t) && !/(使|つか)/.test(t)) return { tool: 'page', step: -1 };
  if (/スペルブック/.test(t) && (ASK_OUT.test(t) || /^スペルブック[!！。？?]*$/.test(t)) && !spellQuery(t)) return { tool: 'book' };
  const use = /(を|の|で)?(使って|つかって|使いたい|つかいたい|使おう|使う|つかう|もとにして|で作って|でつくって|にして)/.test(t);
  if (use && spellQuery(t)) return { tool: 'use', query: spellQuery(t), named: /スペルブック/.test(t) || open };
  return null;
}

// --- {bati}'s lines (元気な子 as written; the other styles in toolVariants.ts) --------------------------------------

export const SPELL_TOOL_LINES = {
  /** a picture / a link was read with the compass */
  compassRead: 'コンパスで読んだら、こういうスペルだったよ。',
  /** 「コンパス出して」 */
  compassOpen: '読みたいものを見せてね。写真でも、YouTubeのリンクでもいいよ。',
  /** reading (a link takes a moment) */
  compassReading: 'コンパスで、読んでみるね。',
  /** the compass could not read it */
  compassFail: 'うーん、コンパスが読めなかった……。ほかのを見せてくれる？',
  /** the kind it reads into is not open yet ({d} = days) */
  compassLocked: 'コンパスは読めるけど、その魔法はまだ使えないんだ。あと{d}日、待っててね。',
  /** a work was liked */
  bookAsk: 'このスペル、スペルブックにしまっておく？',
  bookSaved: '『{spell}』って名前で、スペルブックにしまったよ。',
  bookAlready: 'このスペルは、もうスペルブックにあるよ。『{spell}』だよ。',
  bookNothing: 'しまえるスペルが、まだないみたい。何か作ったら、しまえるよ。',
  bookFull: 'スペルブックが、いっぱいになっちゃった。どれか捨ててから、しまおう。',
  bookRenamed: '名前を『{spell}』にしたよ。',
  bookNoName: 'どのスペルの名前を変える？　先にスペルブックにしまってね。',
  bookKeepNot: 'わかった、しまわないでおくね。',
  /** 「スペルブック出して」 */
  bookOpen: 'スペルブックだよ。使いたいのがあったら、「〇〇使って」って言ってね。',
  bookEmpty: 'スペルブックは、まだからっぽ。気に入ったスペルができたら、しまっておこう。',
  bookClosed: 'スペルブック、しまったよ。',
  /** a saved spell brought back as the spell */
  bookUse: 'スペルブックから『{spell}』を出したよ。',
  bookWhich: 'どれのこと？　{list}があるよ。',
  bookNotFound: 'スペルブックに、それっぽいのが見つからなかった……。名前で言ってみて。',
  bookLocked: '『{spell}』の魔法は、まだ使えないんだ。あと{d}日、待っててね。',
  /** a kind asked for, and a saved spell fits */
  bookSuggest: 'スペルブックの『{spell}』をもとにする？',
  /** 「〇〇は捨てて」 */
  bookDropAsk: '『{spell}』を、スペルブックから捨てていい？',
  bookDropped: '『{spell}』は、捨てたよ。',
  bookDropNot: 'じゃあ、とっておくね。',
} as const;
export const SPELL_TOOL_LINE_TEXTS: string[] = Object.values(SPELL_TOOL_LINES);

/** a no to {bati}'s question (しまう？ / 捨てていい？ / もとにする？) */
export function isNo(text: string): boolean {
  const t = text.replace(/[\s、。！!？?〜ー~]/g, '');
  return /^(いや|いいえ|ううん|うーん|やめ|だめ|ダメ|いらない|しまわない|捨てない|すてない|まだ|やっぱ(り)?(いい|やめ|いらない|捨てない|しまわない)|いいや|けっこう|結構|no|ノー|べつに|別に|新しく|あたらしく|ちがう|違う)/i.test(t);
}
