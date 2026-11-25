import type { AtelierKind } from '@/lib/atelier/unlock';
import type { Work } from '@/components/atelier/work';

/**
 * R16 (client 2026-11-25): finding a work in Bluena — the kind strip at the top (すべて・曲・絵・動画・本・ゲーム・写真, only the
 * kinds you have), ★, the search box (its title and the words of its spell), and {bati} opening one by words
 * (「ブルーナの〇〇流して」「この前の〇〇の絵見せて」「〇〇の本読みたい」: the best match by title / spell, or the choice when
 * two are as near). Plain functions, no DOM: the tests drive them.
 */
export type ShelfKind = 'all' | 'song' | 'art' | 'video' | 'book' | 'game' | 'photo';
export const SHELF_KINDS: ShelfKind[] = ['all', 'song', 'art', 'video', 'book', 'game', 'photo'];
export const SHELF_WORD: Record<ShelfKind, string> = { all: 'すべて', song: '曲', art: '絵', video: '動画', book: '本', game: 'ゲーム', photo: '写真' };

/** when a work was made: today → きょう 06:49, else 11/24 06:49 */
export function madeWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() <= 0) return '';
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toDateString() === now.toDateString() ? `きょう ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** the strip's kind of a work (コロリン and ラジオ are only under すべて) */
export function shelfKindOf(k: AtelierKind): ShelfKind | null {
  if (k === 'song') return 'song';
  if (k === 'art' || k === 'image') return 'art';
  if (k === 'video') return 'video';
  if (k === 'novel') return 'book';
  if (k === 'game') return 'game';
  return null;
}

/** what Bluena's list holds (the planets' works, newest first) — the shape of lib/finds/works' Found it needs */
export type Shelved = { title: string; createdAt: string; stars: number; work: Work };

/** the chips to show: すべて, then only the kinds there are (写真 when the 📎 has a picture) */
export function kindsPresent(items: readonly Shelved[], photos = 0): ShelfKind[] {
  const have = new Set(items.map((x) => shelfKindOf(x.work.kind)).filter(Boolean) as ShelfKind[]);
  if (photos > 0) have.add('photo');
  return SHELF_KINDS.filter((k) => k === 'all' || have.has(k));
}

/**
 * what a row of Bluena's list does (client 2026-11-25): a tap always opens the work's viewer — never sends it; 〔送る〕 is
 * its own small button, there only when Bluena was opened in a talk (a ダチ talk, KIMORIN's, the Bati chat)
 */
export function rowActions(inTalk: boolean): { tap: 'view'; send: boolean } {
  return { tap: 'view', send: inTalk };
}

/** words folded for matching: width, case, katakana → hiragana, no spaces / marks */
export function fold(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s　、。,.・！!？?「」『』（）()〔〕【】"'~〜ー-]+/g, '');
}

/** everything a work can be found by: its title, what it was asked as, its spell's words, its song's title */
export function wordsOf(w: Work, title = ''): string[] {
  const out = [title, w.title ?? '', w.prompt ?? '', w.lyrics?.title ?? '', ...(w.spell ?? []).map((t) => t.ja)];
  return out.filter((x) => x && x.trim());
}

const grams = (s: string) => {
  const g: string[] = [];
  for (let i = 0; i < s.length - 1; i++) g.push(s.slice(i, i + 2));
  return g.length ? g : s ? [s] : [];
};
/** how near the words are to one text (1 = in it; else the bigram overlap, Dice) */
export function nearness(query: string, text: string): number {
  const q = fold(query);
  const t = fold(text);
  if (!q || !t) return 0;
  if (t.includes(q)) return 1;
  if (q.length >= 2 && t.length >= 2 && q.includes(t)) return 0.9;
  const a = grams(q);
  const b = grams(t);
  const pool = [...b];
  let hit = 0;
  for (const x of a) {
    const i = pool.indexOf(x);
    if (i >= 0) {
      hit++;
      pool.splice(i, 1);
    }
  }
  return (2 * hit) / (a.length + b.length);
}
/** a work's best nearness to the words (its title counts a little more than its spell) */
export function scoreOf(query: string, x: Shelved): number {
  const ws = wordsOf(x.work, x.title);
  return Math.max(0, ...ws.map((t, i) => nearness(query, t) * (i <= 1 ? 1 : 0.92)));
}

/** the list through the strip, ★ and the box */
export function filterShelf<T extends Shelved>(items: readonly T[], f: { kind?: ShelfKind; star?: boolean; q?: string }): T[] {
  const q = (f.q ?? '').trim();
  return items.filter((x) => {
    if (f.kind && f.kind !== 'all' && shelfKindOf(x.work.kind) !== f.kind) return false;
    if (f.star && !(x.stars > 0)) return false;
    if (!q) return true;
    // every word of the box is in it (or the title is near the words)
    const hay = fold(wordsOf(x.work, x.title).join(' '));
    const parts = q.split(/[\s　]+/).filter(Boolean);
    return parts.every((p) => hay.includes(fold(p))) || scoreOf(q, x) >= 0.6;
  });
}

/** {bati} asked to open a work: which kind (listen = something to hear), the words naming it, how sure it is Bluena */
export type OpenAsk = { what: ShelfKind | 'listen' | null; words: string; strong: boolean; verb: 'play' | 'see' | 'read' | 'game' };

/** words that say it is one of your own works (Bluena, the one made before …) */
const MINE = /ブルーナ|この前|このまえ|こないだ|この間|このあいだ|前に作|まえに作|まえにつく|さっき作|さっきの|昨日の|きのうの|おととい|私の|わたしの|僕の|ぼくの|自分の|じぶんの|俺の|おれの|うちの|作った|つくった|描いた|かいた/;
const VERBS: [OpenAsk['verb'], RegExp][] = [
  ['play', /流して|ながして|再生して|再生|かけて|聴かせて|聞かせて|きかせて|聴きたい|聞きたい|ききたい/],
  ['read', /読みたい|よみたい|読ませて|よませて|読んで|よんで/],
  ['game', /遊びたい|あそびたい|遊ばせて|あそばせて|遊ぶ|あそぶ/],
  ['see', /見せて|みせて|見たい|みたい|ひらいて|開いて|出して|だして/],
];
/** making, not opening (「曲を作って流して」) */
const MAKING = /作って|つくって|作りたい|つくりたい|描いて|生成|新しく|あたらしく/;
const KIND_WORDS: [ShelfKind | 'listen', RegExp][] = [
  ['video', /動画|どうが|映像|えいぞう|MV|ＭＶ|ムービー|ビデオ/i],
  ['song', /曲|きょく|歌|うた|ソング|音楽/],
  ['art', /絵|画像|がぞう|イラスト|アート/],
  ['book', /本|ほん|小説|物語|ものがたり/],
  ['game', /ゲーム/],
  ['photo', /写真|しゃしん/],
  ['listen', /ラジオ|番組|コロリン|ころりん|つぶやき/],
];
/** what is left of the words once the asking is taken off (「ブルーナの夏の海の曲流して」 → 夏の海) */
function nameIn(t: string): string {
  const q = t.match(/[「『"](.+?)[」』"]/);
  if (q) return q[1].trim();
  let s = t
    .replace(/^(ねえ|ねぇ|バティ|ねえバティ|あのね|えっと)[、,\s　]*/, '')
    .replace(new RegExp(MINE.source, 'g'), ' ')
    .replace(/(ちょっと|もう一回|もういちど|もう一度|いま|今)/g, ' ');
  for (const [, re] of VERBS) s = s.replace(new RegExp(re.source, 'g'), ' ');
  for (const [, re] of KIND_WORDS) s = s.replace(new RegExp(re.source, 'gi'), ' ');
  s = s
    .replace(/(ください|くれる|くれない|ちょうだい|ほしい|欲しい|おねがい|お願い)/g, ' ')
    .replace(/[！!？?。、,]+/g, ' ')
    .replace(/(^|\s)(の|を|が|って|は|で|に|と|な|よ|ね|か)+(?=\s|$)/g, ' ')
    .replace(/\s*(の|を|が|って|は)\s*$/g, '')
    .replace(/^\s*(の|を|が|は)\s*/g, '');
  return s.replace(/\s+/g, ' ').trim().replace(/(の|を|が|って|は)$/, '').trim();
}

export function detectOpen(text: string): OpenAsk | null {
  const t = text.trim();
  if (!t || t.length > 80 || MAKING.test(t)) return null;
  const verb = VERBS.find(([, re]) => re.test(t))?.[0];
  if (!verb) return null;
  const strong = MINE.test(t);
  const kind = KIND_WORDS.find(([, re]) => re.test(t))?.[0] ?? null;
  // 「〇〇の絵見せて」 alone is a picture search (from the web): opening Bluena needs it to say it is yours
  if (verb === 'see' && !strong) return null;
  const what: OpenAsk['what'] = kind ?? (verb === 'read' ? 'book' : verb === 'game' ? 'game' : verb === 'play' ? 'listen' : null);
  const words = nameIn(t);
  if (!words && !strong) return null;
  return { what, words, strong, verb };
}

const LISTEN: AtelierKind[] = ['song', 'radio', 'voice'];
/** the works an ask can mean (its kind) */
export function candidates<T extends Shelved>(items: readonly T[], a: OpenAsk): T[] {
  if (!a.what) return [...items];
  if (a.what === 'listen') return items.filter((x) => LISTEN.includes(x.work.kind));
  return items.filter((x) => shelfKindOf(x.work.kind) === a.what);
}

export type OpenPick<T> = { hit: T } | { choose: T[] } | { none: true };
/** the best match: one clearly nearest → it; two or more about as near → the choice (at most 4); none near → none */
export function pickOpen<T extends Shelved>(items: readonly T[], a: OpenAsk): OpenPick<T> {
  const c = candidates(items, a).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  if (!c.length) return { none: true };
  // 「この前の絵見せて」: the newest of that kind
  if (!a.words) return { hit: c[0] };
  const scored = c.map((x) => ({ x, s: scoreOf(a.words, x) })).filter((y) => y.s >= 0.45);
  scored.sort((p, q) => q.s - p.s);
  if (!scored.length) return { none: true };
  const top = scored[0].s;
  const near = scored.filter((y) => y.s >= top - 0.12);
  if (near.length === 1) return { hit: near[0].x };
  // the same title twice (an old try kept apart) — still a choice, newest first
  return { choose: near.slice(0, 4).map((y) => y.x) };
}

/** a chip's answer to the choice: the one whose title it is, or near the words typed */
export function choiceOf<T extends Shelved>(choices: readonly T[], said: string): T | null {
  const exact = choices.find((x) => fold(x.title || x.work.title || '') === fold(said));
  if (exact) return exact;
  const n = said.match(/^(\d)|^(ひとつめ|一つ目|1つ目)|^(ふたつめ|二つ目|2つ目)/);
  if (n) {
    const i = n[1] ? Number(n[1]) - 1 : n[2] ? 0 : 1;
    return choices[i] ?? null;
  }
  const best = choices.map((x) => ({ x, s: scoreOf(said, x) })).sort((p, q) => q.s - p.s)[0];
  return best && best.s >= 0.5 ? best.x : null;
}
