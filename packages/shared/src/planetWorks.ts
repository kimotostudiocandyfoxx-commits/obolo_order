import { z } from 'zod';
import type { PlanetWorkKind } from './flying';
import type { HomePlanet } from './planetHomeConfig';
import type { HomeWork } from './planetHome';
import { PLANET_FIGURE_OF, type PlanetFigure, type PlanetFigures } from './planetFigures';
import type { SpellTag } from './spell';
import { songGenreOf } from './songGenres';

/**
 * 惑星の作り直し 01・2章「データの土台」(docs/handoff/planets-01-foundation.md, M-R297〜M-R312; docs/planets.md).
 *  - 2-1 every planet work carries hidden tags from the moment it is made (from the spell / the settings, never typed
 *    by hand): one main class (a song's genre, an art's style …) and a few moods (+ a song's BPM)
 *  - 2-2 every work is `dachi` (its maker's dachi / 推し homes only) or `public` (also drifts to strangers' continents)
 *  - 2-4 continents are data (a rule each); a public work drifts to every continent its tags score ≥ 2 on (workScore)
 *  - 2-5 per member: 5 favourite continents per planet, the continents seen (〔旅〕 picks unseen ones)
 *  - 2-6 the member's riding figure on each planet (figureFor)
 * Pure: the API (apps/api/src/planets/continents.service.ts, planet-works.service.ts) and the web use the same rules.
 */

// --- 2-1 tags ---------------------------------------------------------------------------------------------------

/** the hidden tags of one planet work (users never see them, M-R310) */
export interface WorkTags {
  /** the main class: a song's genre (EDM, ローファイ …), an art's style (水彩, アニメ塗り …); null = not known yet */
  main: string | null;
  /** the moods (アゲ, 夜, ねこ …), at most WORK_MOODS_MAX */
  moods: string[];
  /** a song's tempo (other kinds: null) */
  bpm?: number | null;
}
export const WORK_MOODS_MAX = 10;
export const EMPTY_TAGS: WorkTags = { main: null, moods: [], bpm: null };

/** the song genres the continents speak of (prototype design/home/template.html GSONG / M-R299) */
export const PLANET_SONG_GENRES = ['EDM', 'ヒップホップ', 'バラード', 'ロック', 'ローファイ', 'シティポップ', 'アニソン', 'ジャズ', 'J-POP'] as const;
/** the art styles the continents speak of (handoff 2-1, prototype CONT.jupiter) */
export const PLANET_ART_STYLES = ['水彩', 'アニメ塗り', 'ドット絵', '油絵', 'ゆめかわ', '和モダン', 'レトロ', 'ポップ', 'モノクロ'] as const;

/** the studio's genre (songGenres.ts label) → the continents' genre; a genre not listed keeps its own label */
const SONG_GENRE_TO_PLANET: Record<string, string> = {
  サイケデリックトランス: 'EDM',
  ゴアトランス: 'EDM',
  プログレッシブトランス: 'EDM',
  ミニマルテクノ: 'EDM',
  ハードスタイル: 'EDM',
  ビッグルームEDM: 'EDM',
  フューチャーベース: 'EDM',
  ドラムンベース: 'EDM',
  ディープハウス: 'EDM',
  ユーロビート: 'EDM',
  ダブステップ: 'EDM',
  ハウス: 'EDM',
  テクノ: 'EDM',
  トランス: 'EDM',
  EDM: 'EDM',
  ダンス: 'EDM',
  ローファイヒップホップ: 'ローファイ',
  ローファイ: 'ローファイ',
  トラップ: 'ヒップホップ',
  ヒップホップ: 'ヒップホップ',
  シューゲイザー: 'ロック',
  エモ: 'ロック',
  'J-ROCK': 'ロック',
  メタル: 'ロック',
  パンク: 'ロック',
  ロック: 'ロック',
  シティポップ: 'シティポップ',
  アニソン: 'アニソン',
  ボカロ: 'アニソン',
  アイドルポップ: 'J-POP',
  'K-POP': 'J-POP',
  ポップ: 'J-POP',
  バラード: 'バラード',
  ジャズ: 'ジャズ',
  ボサノバ: 'ジャズ',
};
/** moods a genre brings by itself (the anison continent gathers 'アニメ', M-R299) */
const GENRE_MOODS: Record<string, string[]> = { アニソン: ['アニメ'], シティポップ: ['80s'], ダンス: ['ダンス'], ハウス: ['ダンス'], ディスコ: ['ダンス'], ビッグルームEDM: ['フェス'], ボカロ: ['アニメ'] };

/** the spell's art style (spell.ts) → the continents' style */
const ART_STYLE_TO_PLANET: Record<string, string> = { アニメ風: 'アニメ塗り', 水彩: '水彩', 油絵: '油絵', ドット絵: 'ドット絵', モノクロ: 'モノクロ', ゆめかわ: 'ゆめかわ', 和モダン: '和モダン', レトロ: 'レトロ', ポップ: 'ポップ' };

/** a word of the spell / settings → the continents' moods (a word may bring several: ねこ → ねこ, どうぶつ) */
const MOOD_RULES: [RegExp, string[]][] = [
  [/高揚|ノリノリ|元気|楽し|わくわく|ワクワク|疾走|アゲ|盛り上が|アップテンポ/, ['アゲ']],
  [/切な|せつな|泣|エモ|さみし|寂し/, ['泣ける']],
  [/チル|リラックス|ゆったり|静か|落ち着/, ['チル']],
  [/しっとり|おだやか|穏やか|メロウ/, ['しっとり']],
  [/夜景|ネオン/, ['夜景', '夜']],
  [/夜|暗い|月明かり|星明かり|深夜|真夜中|ミッドナイト/, ['夜']],
  [/熱い|攻撃|情熱|力強/, ['熱い']],
  [/おしゃれ|オシャレ|お洒落/, ['おしゃれ']],
  [/ダンス|踊/, ['ダンス']],
  [/フェス/, ['フェス']],
  [/ストリート|路地/, ['ストリート']],
  [/青春|放課後/, ['青春']],
  [/ドライブ/, ['夜ドライブ']],
  [/80s|80年代/, ['80s']],
  [/アニメ/, ['アニメ']],
  [/作業|勉強|集中/, ['作業用']],
  [/夏|なつ|花火|かき氷/, ['夏']],
  [/祭|まつり|盆おどり|盆踊/, ['祭り']],
  [/和風|和モダン|着物|神社|鳥居|和楽器|風鈴/, ['和風']],
  [/雨|しずく|梅雨/, ['雨']],
  [/やさし|優し|ほっこり/, ['やさしい']],
  [/やわらかい色|パステル|淡い/, ['パステル']],
  [/あざやか|鮮やか|カラフル|虹色/, ['あざやか']],
  [/キラキラ|きらきら/, ['キラキラ']],
  [/モノクロ|白黒/, ['白黒']],
  [/あたたか|あったか|温か|金色|夕焼け/, ['あたたか']],
  [/つめたい|冷た|青い色/, ['つめたい']],
  [/かっこ|カッコ|クール/, ['かっこいい']],
  [/かわい|可愛|カワイイ/, ['かわいい']],
  [/ねこ|猫|ネコ/, ['ねこ', 'どうぶつ']],
  [/どうぶつ|動物|いぬ|犬|うさぎ|くま|とり|鳥(?!居)/, ['どうぶつ']],
  [/花|桜|さくら|ひまわり|椿|バラ/, ['花']],
  [/風景|景色|港|丘|山|森/, ['風景']],
  [/人物|女の子|男の子|少女|少年/, ['人物']],
  [/レトロ|昭和/, ['レトロ']],
  [/ゲーム|8bit|8ビット|ピクセル/, ['ゲーム']],
  [/ポップ/, ['ポップ']],
  [/空|雲/, ['空']],
];

const clean = (s: string) => s.replace(/^#/, '').trim();
const splitWords = (s: string | null | undefined): string[] => (s ?? '').split(/[、,，・/／\s]+/).map(clean).filter((w) => w.length > 0 && w.length <= 16);

/** the moods the words bring (the continents' vocabulary first, then the words themselves for user-made continents) */
export function planetMoodsOf(words: readonly string[]): string[] {
  const out: string[] = [];
  const add = (m: string) => {
    if (!out.includes(m)) out.push(m);
  };
  for (const w of words) for (const [re, ms] of MOOD_RULES) if (re.test(w)) ms.forEach(add);
  for (const w of words) add(clean(w));
  return out.filter(Boolean).slice(0, WORK_MOODS_MAX);
}

/** a song's genre as the continents call it (unknown genres keep their own label; none: null) */
export function planetGenreOf(genre: string | null | undefined): string | null {
  const g = clean(genre ?? '');
  if (!g) return null;
  const found = songGenreOf({ ja: g, en: g });
  if (found) return SONG_GENRE_TO_PLANET[found.ja] ?? found.ja;
  return SONG_GENRE_TO_PLANET[g] ?? g.slice(0, 20);
}

/** the groups of a spell whose words are moods (the colour, light and theme of a picture; a song's mood and theme) */
const MOOD_GROUPS = new Set(['mood', 'theme', 'color', 'light', 'event', 'world']);

/** 2-1 a song's tags: from songs.designJson (genre / mood / bpm, and the spell it was made with when kept) */
export function songTags(design: { genre?: unknown; mood?: unknown; bpm?: unknown; spell?: unknown } | null | undefined): WorkTags {
  const d = design ?? {};
  const spell = Array.isArray(d.spell) ? (d.spell as SpellTag[]) : [];
  const genreTag = spell.find((t) => t?.group === 'genre');
  const rawGenre = typeof d.genre === 'string' && d.genre ? d.genre : (genreTag?.ja ?? null);
  const main = planetGenreOf(rawGenre);
  const found = rawGenre ? songGenreOf({ ja: rawGenre, en: rawGenre }) : null;
  const words = [...splitWords(typeof d.mood === 'string' ? d.mood : ''), ...spell.filter((t) => t && MOOD_GROUPS.has(t.group)).map((t) => t.ja)];
  const implied = (found && GENRE_MOODS[found.ja]) || (main && GENRE_MOODS[main]) || [];
  const bpm = Number(d.bpm);
  return { main, moods: planetMoodsOf([...implied, ...words]), bpm: Number.isFinite(bpm) && bpm > 0 ? Math.round(bpm) : null };
}

/** 2-1 an art's tags: the spell's style is the main class, its colour / light / mood / theme the moods (`style`: the touch said in words) */
export function artTags(spell: readonly SpellTag[] | null | undefined, style?: string | null): WorkTags {
  const tags = spell ?? [];
  const words = [...tags.filter((t) => MOOD_GROUPS.has(t.group)).map((t) => t.ja), ...splitWords(style)];
  const styleWords = [...tags.filter((t) => t.group === 'style').map((t) => t.ja), ...splitWords(style)];
  const mainWord = styleWords.find((w) => ART_STYLE_TO_PLANET[w]) ?? styleWords.find((w) => (PLANET_ART_STYLES as readonly string[]).includes(w)) ?? tags.find((t) => t.group === 'style')?.ja ?? null;
  const main = mainWord ? (ART_STYLE_TO_PLANET[mainWord] ?? mainWord) : null;
  return { main, moods: planetMoodsOf(words.filter((w) => w !== mainWord)), bpm: null };
}

/**
 * 2-1 the shape every kind shares — one main class and moods. The kinds of handoff 05 (MV, radio, goods, story, game)
 * fill it through their own functions below (mvTags, radioTags, goodsTags, bookTags, gameTags).
 */
export function genericTags(main: string | null | undefined, words: readonly string[] = []): WorkTags {
  return { main: main ? clean(main) || null : null, moods: planetMoodsOf(words), bpm: null };
}

/**
 * 2-1 Saturn (M-R316): a voice kororin's topic (its main class) and moods, from the words blown in. The plazas on the
 * rings (prototype CONT.saturn / RULE.saturn) speak this vocabulary; 雑談 is the topic of anything else.
 */
export const PLANET_VOICE_TOPICS = ['雑談', '恋バナ', '推し', '学校', '夜', 'ゲーム', 'お笑い', 'アニメ', '朝', '眠い'] as const;
export const PLANET_VOICE_MOODS = ['ゆるい', '日常', 'ドキドキ', '好きな人', 'アイドル', 'ライブ', '部活', 'テスト', '深夜', '眠れない', '対戦', '実況', 'ボケ', 'ツッコミ', '名シーン', 'マンガ', 'おはよう', '元気', 'おやすみ', '夜'] as const;
export const VOICE_MOODS_MAX = 4;
export const VOICE_TOPIC_DEFAULT = '雑談';

/** an answer (the model's, or the word rules') kept to the vocabulary: a known topic (else 雑談), known moods only */
export function voiceTags(topic: unknown, moods: unknown): WorkTags {
  const t = typeof topic === 'string' ? clean(topic) : '';
  const main = (PLANET_VOICE_TOPICS as readonly string[]).includes(t) ? t : VOICE_TOPIC_DEFAULT;
  const ms = (Array.isArray(moods) ? moods : [])
    .filter((m): m is string => typeof m === 'string')
    .map(clean)
    .filter((m, i, a) => (PLANET_VOICE_MOODS as readonly string[]).includes(m) && a.indexOf(m) === i)
    .slice(0, VOICE_MOODS_MAX);
  return { main, moods: ms, bpm: null };
}

/** the word rules (offline / no model): the first topic whose words appear, and every mood whose words appear */
const VOICE_TOPIC_RULES: [RegExp, string][] = [
  [/好きな人|片思い|告白|恋|カレシ|彼氏|彼女|デート|LINEの返事/, '恋バナ'],
  [/推し|ライブ|ペンライト|アイドル|尊い/, '推し'],
  [/ゲーム|ランク|ボス|対戦|実況|ガチャ/, 'ゲーム'],
  [/アニメ|マンガ|漫画|最終回|名シーン|今期/, 'アニメ'],
  [/学校|部活|テスト|宿題|先生|授業|文化祭|放課後|クラス/, '学校'],
  [/笑|ウケ|ボケ|ツッコミ|ネタ|ギャグ/, 'お笑い'],
  [/おはよう|朝ごはん|朝/, '朝'],
  [/眠い|ねむ|おやすみ|布団|ふとん|夢/, '眠い'],
  [/夜|深夜|眠れない|寝れない|[0-9０-９]時なのに|ラーメン|星/, '夜'],
];
const VOICE_MOOD_RULES: [RegExp, string][] = [
  [/ゆる|まったり|のんびり|好き$/, 'ゆるい'],
  [/今日|コンビニ|ごはん|新作|ハマ/, '日常'],
  [/ドキドキ|どきどき|告白|目が合/, 'ドキドキ'],
  [/好きな人|片思い|LINEの返事/, '好きな人'],
  [/アイドル|推しの新曲|尊い/, 'アイドル'],
  [/ライブ|ペンライト/, 'ライブ'],
  [/部活/, '部活'],
  [/テスト|試験/, 'テスト'],
  [/深夜|[0-9０-９]時|夜中/, '深夜'],
  [/眠れない|寝れない|目が冴え/, '眠れない'],
  [/対戦|ランク|一緒にやる/, '対戦'],
  [/実況|ボス/, '実況'],
  [/ボケ|笑|盗んで/, 'ボケ'],
  [/ツッコミ/, 'ツッコミ'],
  [/名シーン|泣いた|あのシーン|最終回/, '名シーン'],
  [/マンガ|漫画|今期/, 'マンガ'],
  [/おはよう|朝ごはん/, 'おはよう'],
  [/元気|がんばろ|頑張ろ|晴れ/, '元気'],
  [/おやすみ|いい夢/, 'おやすみ'],
];
/** a voice kororin's tags from its words by the word rules alone (no model: tests, local runs) */
export function voiceTagsOfWords(words: string): WorkTags {
  const w = words ?? '';
  const topic = VOICE_TOPIC_RULES.find(([re]) => re.test(w))?.[1] ?? VOICE_TOPIC_DEFAULT;
  return voiceTags(
    topic,
    VOICE_MOOD_RULES.filter(([re]) => re.test(w)).map(([, m]) => m),
  );
}

// --- 2-1 the five planets of handoff 05 (planets-05-five.md 「作品のタグ」) ------------------------------------------

/** 05 火星 MV: the main class is the song's genre and the moods the song's (inherited from the song it was made for) */
export function mvTags(songDesign: Parameters<typeof songTags>[0]): WorkTags {
  const t = songTags(songDesign);
  return { main: t.main, moods: t.moods, bpm: null };
}

/** 05 金星 ラジオ: the topic (the same vocabulary as Saturn's kororins) and how it is spoken */
export const PLANET_RADIO_MOODS = ['にぎやか', 'しっとり', 'ゆったり', '深夜', '朝', '夜', '音楽たっぷり', 'トーク'] as const;
/** the show's loop (radio.ts RADIO_LOOPS) → how it sounds */
const RADIO_LOOP_MOODS: Record<string, string> = { pulse: 'にぎやか', ripple: 'しっとり', drift: 'ゆったり', stars: '夜', still: 'しっとり' };
const RADIO_WORD_MOODS: [RegExp, string][] = [
  [/にぎやか|ワイワイ|わいわい|元気|テンション|パーティー|祭/, 'にぎやか'],
  [/しっとり|しずか|静か|ひとりごと|ひとり言|つぶやき/, 'しっとり'],
  [/ゆったり|まったり|のんびり|ゆる/, 'ゆったり'],
  [/深夜|夜ふかし|真夜中|ミッドナイト|眠れない/, '深夜'],
  [/朝|おはよう|モーニング/, '朝'],
  [/夜|月夜|星/, '夜'],
];
/** the hour in Japan (0–23) of a time */
const jstHour = (at: Date | string | null | undefined): number | null => {
  if (!at) return null;
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? null : (d.getUTCHours() + 9) % 24;
};
/**
 * 2-1 Venus: a show's topic from its title (the Saturn word rules: 雑談 when nothing is said), and how it is spoken from
 * its settings — the title's words, the loop it was made with, the hour it was made (22–4 時 深夜, 5–9 時 朝) and the
 * songs on air (3 or more: 音楽たっぷり, none: トーク). At most four.
 */
export function radioTags(show: { title?: string | null; loop?: string | null; cues?: number | null; at?: Date | string | null }): WorkTags {
  const title = show.title ?? '';
  const out: string[] = [];
  const add = (m: string | undefined) => {
    if (m && !out.includes(m)) out.push(m);
  };
  RADIO_WORD_MOODS.filter(([re]) => re.test(title)).forEach(([, m]) => add(m));
  add(RADIO_LOOP_MOODS[show.loop ?? '']);
  const h = jstHour(show.at);
  if (h != null && (h >= 22 || h < 5)) add('深夜');
  if (h != null && h >= 5 && h < 10) add('朝');
  if (show.cues != null) add(show.cues >= 3 ? '音楽たっぷり' : show.cues === 0 ? 'トーク' : undefined);
  return { main: voiceTagsOfWords(title).main, moods: out.slice(0, VOICE_MOODS_MAX), bpm: null };
}

/** 05 天王星 グッズ: what it is (the main class); the moods are the printed art's, in Jupiter's vocabulary */
export const PLANET_GOODS_KINDS = ['トート', 'Tシャツ', 'ステッカー', 'アクスタ', 'マグカップ', '缶バッジ'] as const;
const GOODS_KIND_OF: [RegExp, string][] = [
  [/トート|tote|バッグ/i, 'トート'],
  [/Tシャツ|ティーシャツ|t-?shirt|シャツ/i, 'Tシャツ'],
  [/ステッカー|シール|sticker/i, 'ステッカー'],
  [/アクスタ|アクリルスタンド|acrylic/i, 'アクスタ'],
  [/マグ|mug|カップ/i, 'マグカップ'],
  [/缶バッジ|缶バッチ|バッジ|badge/i, '缶バッジ'],
];
/** the goods kind named in words (「マグで」→ マグカップ), else null */
export const goodsKindOfWords = (words: string | null | undefined): string | null => GOODS_KIND_OF.find(([re]) => re.test(words ?? ''))?.[1] ?? null;
/** 2-1 Uranus: the goods' kind, and the printed art's style first, then its moods (artTags of its spell) */
export function goodsTags(kind: string | null | undefined, artSpell?: readonly SpellTag[] | null, style?: string | null): WorkTags {
  const k = (kind ?? '').trim();
  const main = goodsKindOfWords(k) ?? (k ? clean(k).slice(0, 20) || null : null);
  const art = artTags(artSpell, style);
  return { main, moods: [...(art.main ? [art.main] : []), ...art.moods].slice(0, WORK_MOODS_MAX), bpm: null };
}

/** 05 冥王星 物語: the genre, then the length and the feeling */
export const PLANET_STORY_GENRES = ['ファンタジー', '恋愛', 'ホラー', '日常', 'SF', 'ミステリー'] as const;
export const PLANET_STORY_LENGTHS = ['短い', '中くらい', '長い'] as const;
export const PLANET_STORY_FEELINGS = ['泣ける', '笑える', 'こわい', 'やさしい', 'わくわく'] as const;
/** the book spell's genre (spell.ts BOOK genres) → the planet's */
const STORY_GENRE_OF: Record<string, string> = { ファンタジー: 'ファンタジー', 冒険: 'ファンタジー', ミステリー: 'ミステリー', SF: 'SF', 学園もの: '日常', 日常: '日常', ちょっと怖い: 'ホラー' };
const STORY_WORD_GENRES: [RegExp, string][] = [
  [/恋|好きな人|片思い|告白|デート|ラブ/, '恋愛'],
  [/怖|こわ|ホラー|おばけ|幽霊/, 'ホラー'],
  [/ミステリー|謎|なぞ|探偵|事件/, 'ミステリー'],
  [/SF|ＳＦ|宇宙|未来|ロボット/i, 'SF'],
  [/魔法|まほう|ドラゴン|魔女|冒険|森/, 'ファンタジー'],
  [/日常|学校|学園|町|まち|ほのぼの/, '日常'],
];
const STORY_FEELING_OF: [RegExp, string][] = [
  [/切な|せつな|泣|涙|さみし|寂し/, '泣ける'],
  [/おもしろ|面白|笑|ギャグ|コメディ/, '笑える'],
  [/怖|こわ|ホラー|おばけ/, 'こわい'],
  [/やさし|優し|ほっこり|あったか|温か|しっとり/, 'やさしい'],
  [/わくわく|ワクワク|ドキドキ|どきどき|冒険/, 'わくわく'],
];
/**
 * a book's length by the characters of its chapters (a chapter is ~1500–2500): up to 5000 短い, up to 12000 中くらい,
 * more 長い; nothing written yet: the spell's length talisman (短め / 長め; else 中くらい)
 */
export function storyLength(chars: number, spellLength?: string | null): (typeof PLANET_STORY_LENGTHS)[number] {
  if (chars > 0) return chars <= 5000 ? '短い' : chars <= 12000 ? '中くらい' : '長い';
  return /短/.test(spellLength ?? '') ? '短い' : /長/.test(spellLength ?? '') ? '長い' : '中くらい';
}
/**
 * 2-1 Pluto: a book's genre from its spell (its genre talisman; else the words of its world / hero / mood; else 日常),
 * its length from the chapters written (`chars`) and its feelings from the spell's words. At most four moods.
 */
export function bookTags(spell: readonly SpellTag[] | null | undefined, chars = 0): WorkTags {
  const tags = spell ?? [];
  const words = tags.map((t) => t.ja);
  const genreTag = tags.find((t) => t.group === 'genre' && STORY_GENRE_OF[t.ja]);
  const main = genreTag ? STORY_GENRE_OF[genreTag.ja] : (STORY_WORD_GENRES.find(([re]) => words.some((w) => re.test(w)))?.[1] ?? '日常');
  const moods: string[] = [storyLength(chars, tags.find((t) => t.group === 'length')?.ja)];
  for (const [re, m] of STORY_FEELING_OF) if (!moods.includes(m) && words.some((w) => re.test(w))) moods.push(m);
  return { main, moods: moods.slice(0, 4), bpm: null };
}

/** 05 海王星 ゲーム: the genre, then how it is played */
export const PLANET_GAME_GENRES = ['アクション', 'パズル', 'レース', 'リズム', 'シューティング', 'クイズ'] as const;
export const PLANET_GAME_STYLES = ['ひとりで', 'みんなで', 'すぐ終わる', 'じっくり'] as const;
/** the game spell's genre (spell.ts GAME genres) → the planet's */
const GAME_GENRE_OF: Record<string, string> = { 集める: 'アクション', よける: 'アクション', ジャンプ: 'アクション', タップ: 'アクション', ブロックくずし: 'アクション', シューティング: 'シューティング', パズル: 'パズル', クイズ: 'クイズ' };
/** words that name a genre the spell has no talisman for (a race, a rhythm game) */
const GAME_NAMED_GENRES: [RegExp, string][] = [
  [/レース|車|カー|ドライブ|バイク/, 'レース'],
  [/リズム|音ゲー|ダンス|ビート/, 'リズム'],
];
/**
 * 2-1 Neptune: a game's genre — words naming a race or a rhythm game first (the spell has no talisman for them), then
 * its genre talisman, else アクション — and how it is played: alone (every game made today is one player; words of
 * playing together: みんなで), over quickly (a time limit, an easy level, a small goal) or slowly (a puzzle or a quiz, a
 * hard level, lives, a high score).
 */
export function gameTags(spell: readonly SpellTag[] | null | undefined, title = ''): WorkTags {
  const tags = spell ?? [];
  const words = [...tags.map((t) => t.ja), title].filter(Boolean);
  const has = (re: RegExp) => words.some((w) => re.test(w));
  const named = GAME_NAMED_GENRES.find(([re]) => has(re))?.[1];
  const genreTag = tags.find((t) => t.group === 'genre' && GAME_GENRE_OF[t.ja]);
  const main = named ?? (genreTag ? GAME_GENRE_OF[genreTag.ja] : 'アクション');
  const moods: string[] = [has(/対戦|みんな|ふたり|2人|二人|協力/) ? 'みんなで' : 'ひとりで'];
  const quick = has(/秒|かんたん|30こ集めたら勝ち/);
  const slow = main === 'パズル' || main === 'クイズ' || has(/むずかしい|ライフ3つ|ハイスコア/);
  if (quick) moods.push('すぐ終わる');
  else if (slow) moods.push('じっくり');
  return { main, moods, bpm: null };
}

/** stored tags read back safely */
export function readTags(main: unknown, moods: unknown, bpm: unknown): WorkTags {
  const n = Number(bpm);
  return { main: typeof main === 'string' && main ? main : null, moods: Array.isArray(moods) ? moods.filter((m): m is string => typeof m === 'string').slice(0, WORK_MOODS_MAX) : [], bpm: bpm == null || !Number.isFinite(n) ? null : n };
}

// --- 2-2 visibility -----------------------------------------------------------------------------------------------

export const WORK_VISIBILITIES = ['dachi', 'public'] as const;
export type WorkVisibility = (typeof WORK_VISIBILITIES)[number];
/**
 * 2-2 the visibility of a work whose maker never chose (pending the client's answer; the story's proposal: dachi).
 * ONE constant: flipping it changes every work not chosen by hand (a stored null follows it), old works included.
 */
export const PLANET_WORK_DEFAULT_VISIBILITY: WorkVisibility = 'dachi';
export const WorkVisibilityBody = z.object({ visibility: z.enum(WORK_VISIBILITIES) });
export type WorkVisibilityBody = z.infer<typeof WorkVisibilityBody>;

/** 2-3 the automatic check before a work goes public: not yet / passed / held (stays dachi, with the reason) */
export const WORK_CHECK_STATES = ['unchecked', 'ok', 'held'] as const;
export type WorkCheckState = (typeof WORK_CHECK_STATES)[number];

/** what a work's visibility is in effect: a held work (or one never checked) is dachi whatever was chosen */
export function effectiveVisibility(chosen: WorkVisibility | null | undefined, check: WorkCheckState | null | undefined, def: WorkVisibility = PLANET_WORK_DEFAULT_VISIBILITY): WorkVisibility {
  const v = chosen ?? def;
  return v === 'public' && check === 'ok' ? 'public' : 'dachi';
}

export interface WorkVisibilityView {
  kind: PlanetWorkKind;
  id: string;
  /** what the maker chose (null = the default) */
  chosen: WorkVisibility | null;
  /** in effect now */
  visibility: WorkVisibility;
  check: WorkCheckState;
  /** why a held work stays dachi (the check's categories) */
  reason: string | null;
}

// --- 2-4 continents -----------------------------------------------------------------------------------------------

/** a continent's rule: main classes, moods, a BPM range (songs) */
export const ContinentRule = z.object({
  g: z.array(z.string().trim().min(1).max(20)).max(20).default([]),
  m: z.array(z.string().trim().min(1).max(20)).max(20).default([]),
  bpm: z.tuple([z.number().int().min(0).max(999), z.number().int().min(0).max(999)]).optional(),
});
export type ContinentRule = z.infer<typeof ContinentRule>;

/** a work drifts to a continent at this score or more (prototype drift(): s >= 2) */
export const DRIFT_MIN_SCORE = 2;

/**
 * 2-4 the prototype's workScore (design/home/template.html): +3 when the main class matches, +2 for every mood that
 * matches, −2 when the rule has a BPM range, something matched and the BPM is outside it.
 */
export function workScore(tags: WorkTags, rule: ContinentRule): number {
  let s = 0;
  if (tags.main && rule.g.includes(tags.main)) s += 3;
  s += tags.moods.filter((m) => rule.m.includes(m)).length * 2;
  if (rule.bpm && s > 0 && tags.bpm != null && (tags.bpm < rule.bpm[0] || tags.bpm > rule.bpm[1])) s -= 2;
  return s;
}
export const driftsTo = (tags: WorkTags, rule: ContinentRule): boolean => workScore(tags, rule) >= DRIFT_MIN_SCORE;
/** every continent a work reaches (one work may reach several) */
export function continentsOf<C extends { key: string; rule: ContinentRule }>(tags: WorkTags, continents: readonly C[]): string[] {
  return continents.filter((c) => driftsTo(tags, c.rule)).map((c) => c.key);
}

export interface ContinentView {
  key: string;
  planet: HomePlanet;
  name: string;
  /** null = the operator's (公式); a member's continent (M-R297, later) carries its maker */
  creator: { id: string; name: string } | null;
  rule: ContinentRule;
  /** the words it is found by in 〔🔍 大陸をさがす〕 (#tags) */
  tags: string[];
  /** the three pictures: the sky island, the landed scene, the shore view (null = not painted yet) */
  pictures: { sky: string | null; land: string | null; shore: string | null };
  /** search: how many public works drifted there (never used for ordering, M-R299) */
  count?: number;
}

/** 〔🔍 大陸をさがす〕 score (prototype searchList's sc): name +3, a tag +2, the creator +1; a #tag chip must be on it; −1 = out */
export function continentSearchScore(c: Pick<ContinentView, 'name' | 'tags' | 'creator'>, q: string, tag?: string | null): number {
  const s0 = q.trim().replace(/^#/, '').toLowerCase();
  let s = 0;
  if (s0) {
    if (c.name.toLowerCase().includes(s0)) s += 3;
    if (c.tags.some((g) => g.toLowerCase().includes(s0))) s += 2;
    if (c.creator?.name.toLowerCase().includes(s0)) s += 1;
    if (!s) return -1;
  }
  if (tag) {
    if (!c.tags.includes(tag)) return -1;
    s += 1;
  }
  return s;
}

/** ranked by the score, the same score at random (never by popularity, M-R298) */
export function rankContinents<C extends Pick<ContinentView, 'name' | 'tags' | 'creator'>>(cs: readonly C[], q: string, tag?: string | null, rand: () => number = Math.random): C[] {
  return cs
    .map((c) => ({ c, s: continentSearchScore(c, q, tag), r: rand() }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.r - b.r)
    .map((x) => x.c);
}

// --- 2-5 favourites and the continents seen ----------------------------------------------------------------------

/** じぶんの空: five slots per planet (M-R298), an empty slot allowed */
export const FAVOURITE_SLOTS = 5;
export type FavouriteSlots = (string | null)[];
export const FavouritesBody = z.object({ slots: z.array(z.string().trim().min(1).max(40).nullable()).length(FAVOURITE_SLOTS) });
export type FavouritesBody = z.infer<typeof FavouritesBody>;
export const FavouriteBody = z.object({ on: z.boolean(), slot: z.number().int().min(0).max(FAVOURITE_SLOTS - 1).optional() });
export type FavouriteBody = z.infer<typeof FavouriteBody>;

/**
 * the member's five: what they kept (a continent gone since → an empty slot), or — never chosen — the operator's
 * first five (their order)
 */
export function favouritesOf(saved: readonly (string | null)[] | null | undefined, continents: readonly { key: string; creatorId?: string | null }[]): FavouriteSlots {
  const keys = new Set(continents.map((c) => c.key));
  if (Array.isArray(saved) && saved.length === FAVOURITE_SLOTS) {
    const seen = new Set<string>();
    return saved.map((k) => (k && keys.has(k) && !seen.has(k) ? (seen.add(k), k) : null));
  }
  const ops = continents.filter((c) => !c.creatorId).slice(0, FAVOURITE_SLOTS).map((c) => c.key);
  return [...ops, ...Array(FAVOURITE_SLOTS - ops.length).fill(null)];
}

/** the whole five set at once (the swap): every key a continent of the planet, none twice */
export function checkFavourites(slots: readonly (string | null)[], keys: ReadonlySet<string>): FavouriteSlots | 'BAD_SLOTS' | 'UNKNOWN' | 'TWICE' {
  if (slots.length !== FAVOURITE_SLOTS) return 'BAD_SLOTS';
  const seen = new Set<string>();
  for (const k of slots) {
    if (k == null) continue;
    if (!keys.has(k)) return 'UNKNOWN';
    if (seen.has(k)) return 'TWICE';
    seen.add(k);
  }
  return [...slots];
}

/**
 * ☆ on a continent (M-R298): on → into `slot` (replacing what is there: 「どの島と入れかえる？」) or the first empty
 * slot; 'FULL' when all five are taken and no slot was said. Already in → unchanged. off → its slot becomes empty.
 */
export function toggleFavourite(slots: readonly (string | null)[], key: string, on: boolean, slot?: number): FavouriteSlots | 'FULL' {
  const out = [...slots];
  const at = out.indexOf(key);
  if (!on) {
    if (at >= 0) out[at] = null;
    return out;
  }
  if (slot != null) {
    if (at >= 0) out[at] = null;
    out[slot] = key;
    return out;
  }
  if (at >= 0) return out;
  const free = out.indexOf(null);
  if (free < 0) return 'FULL';
  out[free] = key;
  return out;
}

/** 〔✈ 旅〕 shows this many continents (prototype TSLOT) */
export const TRAVEL_COUNT = 6;
/**
 * 〔✈ 旅〕 (M-R312): continents never shown first (at random), then the ones shown longest ago — so every press brings
 * others; never by popularity. `seen`: key → when it was last shown / landed on (ms).
 */
export function pickTravel(keys: readonly string[], seen: ReadonlyMap<string, number>, n = TRAVEL_COUNT, rand: () => number = Math.random): string[] {
  const unseen = keys.filter((k) => !seen.has(k)).map((k) => ({ k, r: rand() }));
  unseen.sort((a, b) => a.r - b.r);
  const old = keys.filter((k) => seen.has(k)).sort((a, b) => seen.get(a)! - seen.get(b)!);
  return [...unseen.map((x) => x.k), ...old].slice(0, n);
}

// --- 2-6 the member's own riding figure --------------------------------------------------------------------------

/** what each planet's own figure rides / is (handoff 2-6: Saturn kororin, Jupiter butterfly, Mercury ship …) */
export const PLANET_RIDE: Record<HomePlanet, string> = {
  saturn: 'kororin',
  jupiter: 'butterfly',
  mercury: 'ship',
  mars: 'ufo',
  venus: 'dj',
  uranus: 'balloons',
  pluto: 'book',
  neptune: 'bubble',
};

export interface RidingFigure {
  planet: HomePlanet;
  ride: string;
  /** which of the nine pictures (PLANET_FIGURES) */
  figure: PlanetFigure;
  /** its picture (null = still being made, or failed: the planet draws its stand-in) */
  url: string | null;
  /** Saturn: the member's own kororin ball the chibi jumps out of */
  ball?: string | null;
}

/** 2-6 the member's figure on a planet, from GET /me `planetFigures` (read-only; the look code makes them) */
export function figureFor(figures: PlanetFigures | null | undefined, planet: HomePlanet): RidingFigure {
  const figure = PLANET_FIGURE_OF[planet];
  const f = figures ?? {};
  return { planet, ride: PLANET_RIDE[planet], figure, url: f[figure] ?? null, ...(planet === 'saturn' ? { ball: f.saturnBall ?? null } : {}) };
}

/** GET /planet-continents/:planet — じぶんの空: the planet's continents and your five slots (null = empty) */
export interface ContinentSkyView {
  planet: HomePlanet;
  continents: ContinentView[];
  favourites: FavouriteSlots;
}

/** GET /planet-continents/:planet/:key — landed: the works drifted there (none for a viewer under 15) */
export interface ContinentLandingView<W = HomeWork> {
  continent: ContinentView;
  young: boolean;
  works: (W & { tags: WorkTags; score: number })[];
}

// --- 02 Mercury: a song opened (handoff planets-02-mercury.md §2, M-R288) -------------------------------------------

/** one sung line and when it starts in the song (seconds); `end` when known (per-character times can be added later) */
export interface SongLyricLine {
  t: number;
  end?: number;
  text: string;
}

/**
 * GET /planet-works/planet_post/:id/song — what Mercury needs to play a song the Mercury way: the sound, the jacket
 * (printed over the whole picture disc), the title, the title read in its maker's own voice (null when they have no registered voice) and the
 * lyrics with their times (a song whose times cannot be had plays without lyrics: []).
 */
export interface PlanetSongView {
  kind: 'planet_post';
  id: string;
  title: string;
  url: string;
  art: string | null;
  seconds: number | null;
  titleVoice: string | null;
  lyrics: SongLyricLine[];
}
