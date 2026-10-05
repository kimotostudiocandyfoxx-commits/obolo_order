import type { Item, ItemKind } from './shop';

/**
 * PLACEHOLDER (P-VENUS-3): "talk to KIMORIN / Bati and they make the goods". Until real generation
 * exists the item is built here from the visitor's words: a name, an emoji look and a kind.
 */
const EMOJI: [RegExp, string][] = [
  [/ラーメン|麺/, '🍜'],
  [/おにぎり|ごはん|ご飯/, '🍙'],
  [/猫|ねこ/, '🐈'],
  [/犬|いぬ/, '🐕'],
  [/星|ほし/, '⭐'],
  [/月/, '🌙'],
  [/花|はな/, '🌸'],
  [/ハート|好き/, '💖'],
  [/王|クラウン/, '👑'],
  [/海|魚/, '🐟'],
  [/音|曲|歌/, '🎵'],
  [/狐|キツネ|きつね/, '🦊'],
];
const KIND_HINT: [RegExp, ItemKind][] = [
  [/ステッカー|シール/, 'ステッカー'],
  [/バッジ|缶バッジ/, 'バッジ'],
  [/帽子|ぼうし|ハット|キャップ/, 'ぼうし'],
  [/置物|おきもの|ぬいぐるみ|フィギュア/, 'おきもの'],
  [/アクセ|リボン|ネックレス|指輪|キーホルダー/, 'アクセ'],
];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 5);

export function guessKind(text: string): ItemKind {
  return KIND_HINT.find(([re]) => re.test(text))?.[1] ?? 'ステッカー';
}

export function makeItem(text: string, kind: ItemKind, maker: string): Item {
  const clean = text.replace(/[。、！？!?.,「」\s]+/g, '').replace(/(を)?(作って|つくって|作りたい|ほしい)$/, '');
  const topic = clean.replace(new RegExp(`(の)?${kind}$`), '') || '今日';
  const emoji = EMOJI.find(([re]) => re.test(text))?.[1] ?? '✨';
  return {
    id: `my-${Date.now().toString(36)}`,
    name: `${[...topic].slice(0, 10).join('')}${kind === 'おきもの' ? 'のおきもの' : kind}`,
    kind,
    emoji,
    hue: hash(text) % 360,
    price: 5,
    maker,
    sold: 0,
    isNew: true,
  };
}
