import { z } from 'zod';

/**
 * R11 (client): in this app a generation prompt is a スペル (spell). Before anything that spends mana {bati} lays the spell
 * out — 「じゃあ、こういうスペルになるね」 — as many small wooden tags (木札), each in Japanese. Behind each tag is the
 * English term the generator is given; the member never sees it. The member changes the spell in words (「ピアノも足して」
 * 「暗いのは外して」) or by taking a tag off; the yes is given to exactly that tag set (spellKey), and the server makes the
 * work from exactly that set (spellPrompt).
 * The common tags are a fixed dictionary (stable labels); free words become tags of their own (the API's model writes
 * their English; without it the words themselves stand in).
 */
export const SPELL_KINDS = ['song', 'art', 'video', 'look', 'bati'] as const;
export type SpellKind = (typeof SPELL_KINDS)[number];
export const SPELL_GROUPS = ['theme', 'genre', 'mood', 'tempo', 'instrument', 'voice', 'style', 'color', 'light', 'composition', 'camera', 'wear'] as const;
export type SpellGroup = (typeof SPELL_GROUPS)[number];

export const SpellTag = z.object({ ja: z.string().trim().min(1).max(16), en: z.string().trim().min(1).max(80), group: z.enum(SPELL_GROUPS) });
export type SpellTag = z.infer<typeof SpellTag>;
export const SpellTags = z.array(SpellTag).min(1).max(16);
/** POST /moon/spell: a spell for the words (none yet), or the spell changed by the words */
export const SpellBody = z.object({ kind: z.enum(SPELL_KINDS), said: z.string().trim().min(1).max(200), tags: z.array(SpellTag).max(16).optional() });
export type SpellBody = z.infer<typeof SpellBody>;
export interface SpellView {
  tags: SpellTag[];
  /** the tags this change put on and took off (the card drops the new ones in and lets the old ones fall away) */
  added: SpellTag[];
  removed: SpellTag[];
}

type Entry = { ja: string; en: string; group: SpellGroup; re: RegExp; for?: SpellKind[] };
const SONG: SpellKind[] = ['song'];
const PIC: SpellKind[] = ['art', 'video', 'look', 'bati'];
const e = (ja: string, en: string, group: SpellGroup, re: RegExp | string, kinds?: SpellKind[]): Entry => ({ ja, en, group, re: typeof re === 'string' ? new RegExp(re) : re, for: kinds });

/** the fixed tags (first match wins inside a group; the longer words come first) */
export const SPELL_DICTIONARY: Entry[] = [
  // a song's genre
  e('ポップ', 'pop', 'genre', /ポップ|pop/i, SONG),
  e('ロック', 'rock', 'genre', /ロック|rock/i, SONG),
  e('バラード', 'ballad', 'genre', /バラード|ballad/i, SONG),
  e('ヒップホップ', 'hip hop', 'genre', /ヒップホップ|ラップ|hip ?hop/i, SONG),
  e('ダンス', 'dance, EDM', 'genre', /ダンス|EDM|クラブ|テクノ/i, SONG),
  e('ジャズ', 'jazz', 'genre', /ジャズ/, SONG),
  e('フォーク', 'acoustic folk', 'genre', /フォーク|弾き語り/, SONG),
  e('ローファイ', 'lo-fi', 'genre', /ローファイ|lofi|lo-fi/i, SONG),
  // the mood (songs and pictures)
  e('明るい', 'bright', 'mood', /明る|あかる|ハッピー/),
  e('楽しい', 'joyful', 'mood', /楽し|たのし|わくわく|ワクワク/),
  e('元気', 'energetic', 'mood', /元気|げんき|はげし|激し/),
  e('しっとり', 'mellow', 'mood', /しっとり|おだやか|穏やか/),
  e('切ない', 'bittersweet', 'mood', /切な|せつな|さみし|寂し|泣/),
  e('やさしい', 'gentle', 'mood', /やさし|優し|ほっこり|あったか|温か/),
  e('暗い', 'dark', 'mood', /暗|くら(い|く|め)/),
  e('かっこいい', 'cool', 'mood', /かっこ|カッコ|クール/),
  e('夢みたい', 'dreamy', 'mood', /夢みたい|夢の中|幻想|ふしぎ|不思議/),
  e('静か', 'calm', 'mood', /静か|しずか|落ち着|おちつ/),
  // a song's tempo, instruments, voice
  e('ゆっくり', 'slow tempo', 'tempo', /ゆっくり|ゆったり|スロー/, SONG),
  e('ふつうの速さ', 'mid tempo', 'tempo', /ふつうの速さ|ミドルテンポ/, SONG),
  e('アップテンポ', 'upbeat tempo', 'tempo', /アップテンポ|速い|はやい|テンポよく/, SONG),
  e('エレキギター', 'electric guitar', 'instrument', /エレキ/, SONG),
  e('ギター', 'acoustic guitar', 'instrument', /ギター/, SONG),
  e('ピアノ', 'piano', 'instrument', /ピアノ/, SONG),
  e('ドラム', 'drums', 'instrument', /ドラム|太鼓/, SONG),
  e('ベース', 'bass', 'instrument', /ベース/, SONG),
  e('ストリングス', 'strings', 'instrument', /ストリングス|弦/, SONG),
  e('バイオリン', 'violin', 'instrument', /バイオリン|ヴァイオリン/, SONG),
  e('シンセ', 'synthesizer', 'instrument', /シンセ/, SONG),
  e('ウクレレ', 'ukulele', 'instrument', /ウクレレ/, SONG),
  e('サックス', 'saxophone', 'instrument', /サックス/, SONG),
  e('ベル', 'bells', 'instrument', /ベル|鈴/, SONG),
  e('手拍子', 'hand claps', 'instrument', /手拍子|クラップ/, SONG),
  e('口笛', 'whistling', 'instrument', /口笛/, SONG),
  e('やさしい歌声', 'soft vocals', 'voice', /やさしい歌声|ささやく|ウィスパー/, SONG),
  e('力強い歌声', 'powerful vocals', 'voice', /力強い歌声|力強く歌|シャウト/, SONG),
  e('女の子の声', 'female vocals', 'voice', /女の子の声|女性(の)?(声|ボーカル)/, SONG),
  e('男の子の声', 'male vocals', 'voice', /男の子の声|男性(の)?(声|ボーカル)/, SONG),
  // a picture's touch, colour, light, composition; an MV's camera; a look's clothes
  e('水彩', 'watercolor', 'style', /水彩/, PIC),
  e('油絵', 'oil painting', 'style', /油絵/, PIC),
  e('クレヨン', 'crayon drawing', 'style', /クレヨン/, PIC),
  e('絵本風', 'picture book illustration', 'style', /絵本/, PIC),
  e('アニメ風', 'anime style', 'style', /アニメ/, PIC),
  e('ドット絵', 'pixel art', 'style', /ドット/, PIC),
  e('切り絵', 'paper cut art', 'style', /切り絵/, PIC),
  e('えんぴつ画', 'pencil sketch', 'style', /鉛筆|えんぴつ/, PIC),
  e('立体', '3D render', 'style', /3D|立体/i, PIC),
  e('やわらかい色', 'soft pastel colors', 'color', /やわらかい色|パステル|淡い/, PIC),
  e('あざやかな色', 'vivid colors', 'color', /あざやか|鮮やか|カラフル/, PIC),
  e('青い色', 'blue tones', 'color', /青い色|青っぽ|ブルー/, PIC),
  e('金色', 'golden tones', 'color', /金色|ゴールド/, PIC),
  e('ピンク', 'pink tones', 'color', /ピンク/, PIC),
  e('虹色', 'rainbow colors', 'color', /虹色|レインボー/, PIC),
  e('モノクロ', 'monochrome', 'color', /モノクロ|白黒/, PIC),
  e('夕焼け', 'sunset light', 'light', /夕焼け|夕日|ゆうひ/, PIC),
  e('月明かり', 'moonlight', 'light', /月明かり/, PIC),
  e('星明かり', 'starlight', 'light', /星明かり/, PIC),
  e('朝の光', 'morning light', 'light', /朝の光|朝日/, PIC),
  e('キラキラ', 'sparkling light', 'light', /キラキラ|きらきら/, PIC),
  e('正方形', 'square composition', 'composition', /正方形|四角/, PIC),
  e('真ん中に大きく', 'centered subject', 'composition', /真ん中|まんなか/, PIC),
  e('遠くから', 'wide view', 'composition', /遠く|広く|ひろく/, PIC),
  e('アップ', 'close-up', 'composition', /アップで|大きく|近く/, PIC),
  e('ゆっくりズーム', 'slow zoom', 'camera', /ズーム/, ['video']),
  e('空を飛ぶカメラ', 'flying camera', 'camera', /飛ぶ|とぶ|空から/, ['video']),
  e('横に流れる', 'panning shot', 'camera', /流れる|パン/, ['video']),
  e('魔法使い', 'wizard robe', 'wear', /魔法使い|まほうつかい/, ['look', 'bati']),
  e('パジャマ', 'pajamas', 'wear', /パジャマ/, ['look', 'bati']),
  e('宇宙飛行士', 'astronaut suit', 'wear', /宇宙飛行士/, ['look', 'bati']),
  e('ドレス', 'dress', 'wear', /ドレス/, ['look', 'bati']),
  e('着物', 'kimono', 'wear', /着物|浴衣/, ['look', 'bati']),
  e('帽子', 'hat', 'wear', /帽子|ぼうし/, ['look', 'bati']),
  e('メガネ', 'glasses', 'wear', /メガネ|めがね|眼鏡/, ['look', 'bati']),
];

/** what a work is about: the common words (a word not here is a tag of its own) */
const THEMES: [RegExp, string, string][] = [
  [/^星空$/, '星空', 'starry sky'],
  [/^(夏|なつ)$/, '夏', 'summer'],
  [/^(冬|ふゆ)$/, '冬', 'winter'],
  [/^(春|はる)$/, '春', 'spring'],
  [/^(秋|あき)$/, '秋', 'autumn'],
  [/^(海|うみ)$/, '海', 'the sea'],
  [/^(夜|よる)$/, '夜', 'night'],
  [/^(星|ほし)$/, '星', 'stars'],
  [/^(月|つき)$/, '月', 'the moon'],
  [/^(空|そら)$/, '空', 'the sky'],
  [/^(雨|あめ)$/, '雨', 'rain'],
  [/^(雪|ゆき)$/, '雪', 'snow'],
  [/^(花|はな)$/, '花', 'flowers'],
  [/^桜$/, '桜', 'cherry blossoms'],
  [/^(森|もり)$/, '森', 'forest'],
  [/^(街|まち)$/, '街', 'the city'],
  [/^(猫|ねこ)$/, '猫', 'a cat'],
  [/^(犬|いぬ)$/, '犬', 'a dog'],
  [/^クジラ$|^くじら$/, 'クジラ', 'a whale'],
  [/^うさぎ$/, 'うさぎ', 'a rabbit'],
  [/^宇宙$/, '宇宙', 'outer space'],
  [/^(友だち|友達|ともだち)$/, '友だち', 'friendship'],
  [/^恋$/, '恋', 'love'],
  [/^(夢|ゆめ)$/, '夢', 'dreams'],
  [/^(旅|たび)$/, '旅', 'a journey'],
  [/^家族$/, '家族', 'family'],
  [/^(朝|あさ)$/, '朝', 'morning'],
  [/^学校$/, '学校', 'school'],
  [/^ネオン$/, 'ネオン', 'neon lights'],
  [/^動物$/, '動物', 'animals'],
  [/^ふわふわ$/, 'ふわふわ', 'fluffy'],
  [/^(さんぽ|散歩)$/, 'さんぽ', 'a walk'],
  [/^海辺$/, '海辺', 'the seaside'],
];

/** the groups that take one tag only (a new one replaces the old) */
const ONE: SpellGroup[] = ['genre', 'tempo', 'voice', 'style', 'composition', 'camera'];
/** moods that do not go together */
const OPPOSITE: Record<string, string[]> = { bright: ['dark', 'bittersweet'], dark: ['bright', 'joyful'], joyful: ['dark', 'bittersweet'], bittersweet: ['bright', 'joyful'], energetic: ['calm', 'mellow'], calm: ['energetic'], mellow: ['energetic'] };
const ORDER: SpellGroup[] = ['theme', 'wear', 'genre', 'style', 'mood', 'tempo', 'instrument', 'voice', 'color', 'light', 'composition', 'camera'];
const INSTRUMENTS: Record<string, string[]> = { pop: ['ピアノ', 'ドラム'], rock: ['エレキギター', 'ドラム'], ballad: ['ピアノ', 'ストリングス'], 'hip hop': ['ドラム', 'ベース'], 'dance, EDM': ['シンセ', 'ドラム'], jazz: ['ピアノ', 'サックス'], 'acoustic folk': ['ギター'], 'lo-fi': ['ピアノ', 'ドラム'] };
/** what a kind's spell always has (the dictionary's ja), when the words did not say it */
const DEFAULTS: Record<SpellKind, Partial<Record<SpellGroup, string>>> = {
  song: { genre: 'ポップ', mood: '明るい', voice: 'やさしい歌声' },
  art: { style: '水彩', color: 'やわらかい色', composition: '正方形' },
  video: { style: 'アニメ風', camera: 'ゆっくりズーム' },
  look: { style: 'アニメ風' },
  bati: { style: 'アニメ風' },
};

const byJa = (ja: string) => SPELL_DICTIONARY.find((x) => x.ja === ja)!;
const tagOf = (x: Entry): SpellTag => ({ ja: x.ja, en: x.en, group: x.group });
const fits = (x: Entry, kind: SpellKind) => !x.for || x.for.includes(kind);
const sortTags = (ts: SpellTag[]) => [...ts].sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group));
const same = (a: SpellTag, b: SpellTag) => a.en.toLowerCase() === b.en.toLowerCase() || a.ja === b.ja;

/** the dictionary tags named in the words, and the words left over */
function named(kind: SpellKind, said: string): { tags: SpellTag[]; rest: string } {
  let rest = said;
  const tags: SpellTag[] = [];
  for (const x of SPELL_DICTIONARY) {
    if (!fits(x, kind)) continue;
    const m = rest.match(x.re);
    if (!m) continue;
    if (ONE.includes(x.group) && tags.some((t) => t.group === x.group)) continue;
    tags.push(tagOf(x));
    // the word and its kana tail (明る|い, 暗|いのは) go
    rest = rest.replace(new RegExp(`(?:${x.re.source})[ぁ-ゖ]*`, x.re.flags), '、');
  }
  return { tags, rest };
}

const KIND_WORDS = /曲|歌|うた|ソング|絵|イラスト|アート|映像|動画|MV|ムービー|姿|かっこう|格好|着せかえ|服/g;
const ASKING = /(を|で|の|に)?(作って|つくって|描いて|かいて|作りたい|つくりたい|作る|つくる|お願い|おねがい|ください|して|ちょうだい|ほしい|にする|にして|足して|たして|加えて|入れて|いれて|外して|はずして|消して|抜いて|やめて|いらない|変えて|かえて)[！!。]*/g;
const FILLER = /^(もっと|ちょっと|すこし|少し|なんか|あと|それと|それから|も|は|が|を|の|で|に|と|な|感じ|かんじ|系|っぽい|みたいな?|して|する)+$/;

/** the free words (what it is about) as tags: common ones from THEMES, others as they are (their English: the words) */
function themes(rest: string): SpellTag[] {
  const chunks = rest
    .replace(KIND_WORDS, '、')
    .replace(ASKING, '、')
    .split(/[、。,.!！?？\s　]+|(?<=[\p{sc=Han}\p{sc=Katakana}ー])(?:の|と|や|で|に|を|が|は|な)(?=.)|の(?=[\p{sc=Han}\p{sc=Katakana}])/u)
    .map((c) => c.replace(/^(の|や|で|に|を|が|は|な)+|(の|と|や|で|に|を|が|は|な|も|感じ|っぽい|みたいな?|する|して|した)+$/g, '').trim())
    .filter((c) => c && !FILLER.test(c));
  const out: SpellTag[] = [];
  for (const c of chunks) {
    const t = THEMES.find(([re]) => re.test(c));
    const tag: SpellTag = t ? { ja: t[1], en: t[2], group: 'theme' } : { ja: c.slice(0, 12), en: c.slice(0, 40), group: 'theme' };
    if (!out.some((o) => same(o, tag))) out.push(tag);
  }
  return out.slice(0, 4);
}

/** a fresh spell for the words: the tags they name, what it is about, then the kind's own defaults */
export function spellFrom(kind: SpellKind, said: string): SpellTag[] {
  const n = named(kind, said);
  const tags = [...themes(n.rest), ...n.tags];
  for (const [g, ja] of Object.entries(DEFAULTS[kind]) as [SpellGroup, string][]) if (!tags.some((t) => t.group === g)) tags.push(tagOf(byJa(ja)));
  if (kind === 'song') {
    const mood = tags.find((t) => t.group === 'mood')?.en;
    if (!tags.some((t) => t.group === 'tempo')) tags.push(tagOf(byJa(mood === 'mellow' || mood === 'bittersweet' || mood === 'calm' ? 'ゆっくり' : mood === 'energetic' || mood === 'joyful' ? 'アップテンポ' : 'ふつうの速さ')));
    if (!tags.some((t) => t.group === 'instrument')) for (const ja of INSTRUMENTS[tags.find((t) => t.group === 'genre')!.en] ?? []) tags.push(tagOf(byJa(ja)));
  }
  return sortTags(tags).slice(0, 14);
}

const REMOVE = /外して|はずして|消して|けして|なくして|抜いて|ぬいて|取って|とって|いらない|やめて|なしで|なしに|なし$|じゃなくて|ではなく/;

/**
 * the spell changed by the member's words: 「〇〇は外して」 takes the tags it names off; anything else puts the tags it
 * names on (「ピアノも足して」「もっと明るく」「ロックにして」 — a genre / tempo / touch replaces the one there, a mood takes
 * its opposite off); free words with 足して / 入れて become a tag of their own
 */
export function spellEdit(kind: SpellKind, tags: SpellTag[], said: string): SpellView {
  const removed: SpellTag[] = [];
  const added: SpellTag[] = [];
  let out = [...tags];
  const take = (pred: (t: SpellTag) => boolean) => {
    for (const t of out.filter(pred)) removed.push(t);
    out = out.filter((t) => !pred(t));
  };
  if (REMOVE.test(said)) {
    const target = said.split(REMOVE)[0];
    const n = named(kind, target);
    const words = themes(n.rest);
    take((t) => n.tags.some((x) => same(x, t)) || words.some((w) => t.ja.includes(w.ja) || w.ja.includes(t.ja)));
    return { tags: out, added, removed };
  }
  const n = named(kind, said);
  const add = [...n.tags];
  if (/足して|たして|加えて|くわえて|入れて|いれて|追加|も(ほしい|入れ|欲しい)/.test(said) || !add.length) for (const t of themes(n.rest)) add.push(t);
  for (const t of add) {
    if (out.some((o) => same(o, t))) continue;
    if (ONE.includes(t.group)) take((o) => o.group === t.group);
    if (t.group === 'mood') take((o) => o.group === 'mood' && (OPPOSITE[t.en] ?? []).includes(o.en));
    out.push(t);
    added.push(t);
  }
  return { tags: sortTags(out).slice(0, 16), added, removed };
}

/** a tag taken off by tapping it */
export function spellDrop(tags: SpellTag[], en: string): SpellView {
  const removed = tags.filter((t) => t.en === en);
  return { tags: tags.filter((t) => t.en !== en), added: [], removed };
}

/**
 * the dictionary's own labels for the model's pairs (a common tag always reads the same), the rest clipped; no
 * repeats, one per single group
 */
export function spellNormalize(kind: SpellKind, pairs: { ja?: unknown; en?: unknown; group?: unknown }[]): SpellTag[] {
  const out: SpellTag[] = [];
  for (const p of pairs) {
    if (typeof p.ja !== 'string' || typeof p.en !== 'string' || !p.ja.trim() || !p.en.trim()) continue;
    const ja = p.ja.trim();
    const hit = SPELL_DICTIONARY.find((x) => fits(x, kind) && (x.ja === ja || x.en.toLowerCase() === p.en!.toString().trim().toLowerCase())) ?? SPELL_DICTIONARY.find((x) => fits(x, kind) && x.re.test(ja) && ja.length <= x.ja.length + 2);
    const group = (SPELL_GROUPS as readonly string[]).includes(p.group as string) ? (p.group as SpellGroup) : 'theme';
    const t: SpellTag = hit ? tagOf(hit) : { ja: ja.slice(0, 12), en: p.en.trim().replace(/[^\x20-\x7e]/g, '').slice(0, 60) || ja.slice(0, 40), group };
    if (out.some((o) => same(o, t)) || (ONE.includes(t.group) && out.some((o) => o.group === t.group))) continue;
    out.push(t);
  }
  return sortTags(out).slice(0, 16);
}

const PREFIX: Record<SpellKind, string> = { song: 'song', art: 'illustration', video: 'music video', look: 'character look', bati: 'character outfit' };
/** the English prompt the generator is given (built from the tags as they are now) */
export function spellPrompt(kind: SpellKind, tags: SpellTag[]): string {
  const g = (k: SpellGroup) => tags.filter((t) => t.group === k).map((t) => t.en);
  const about = g('theme');
  const rest = tags.filter((t) => t.group !== 'theme').map((t) => t.en);
  if (kind === 'song') {
    const parts = [`${[...g('mood'), ...g('genre')].join(' ')} song`.trim(), about.length && `about ${about.join(', ')}`, g('tempo').join(', '), g('instrument').length && `featuring ${g('instrument').join(', ')}`, g('voice').join(', ')];
    return parts.filter(Boolean).join(', ');
  }
  return [PREFIX[kind], about.length && `of ${about.join(', ')}`, ...rest].filter(Boolean).join(', ');
}

/** the Japanese words of the spell (for a song's lyrics, the art's words) */
export function spellWords(tags: SpellTag[]): string {
  return tags.map((t) => t.ja).join('、');
}

/** the spell's fingerprint: the yes is tied to exactly this tag set (MakeConfirm.spell) */
export function spellKey(kind: SpellKind, tags: SpellTag[]): string {
  const s = `${kind}|${tags.map((t) => `${t.group}:${t.en}:${t.ja}`).join('|')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${kind}-${tags.length}-${h.toString(16).padStart(8, '0')}`;
}
