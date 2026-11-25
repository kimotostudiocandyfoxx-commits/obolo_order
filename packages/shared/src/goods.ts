import { z } from 'zod';
import type { BatiVariantSet } from './batiVariants';
import { goodsKindOfWords, PLANET_GOODS_KINDS, type WorkTags } from './planetWorks';

/**
 * Story session 2026-11-25 — グッズ in the Moon atelier (Uranus' works). A goods item is one of the six kinds with one of
 * the member's own arts (a Jupiter root of theirs) printed on it. Nothing is painted: the picture is the art composited
 * onto the kind's mock-up in code (the web's GoodsMock), so it is a FREE making — no confirm card, no mana. Its only
 * costs are small ones that no outside service bills per call (a row and its title; the art's file is already stored and
 * is shared, not copied), so nothing is recorded as a small cost; it is capped a day (GOODS_PER_DAY) instead.
 * {bati} asks in words (no buttons): which kind, which art — then it is made at once, kept in Bluena's Uranus folder,
 * and 〔星へ飛ばす〕 sends it to the Uranus home (POST /moon/goods/:id/fly).
 */
export const GOODS_KINDS = PLANET_GOODS_KINDS;
export type GoodsKind = (typeof GOODS_KINDS)[number];
export const isGoodsKind = (k: string): k is GoodsKind => (GOODS_KINDS as readonly string[]).includes(k);
/** the kind named in the member's words (「Tシャツにして」「マグで」), else null */
export const goodsKindOf = (words: string): GoodsKind | null => {
  const k = goodsKindOfWords(words);
  return k && isGoodsKind(k) ? k : null;
};
/** goods a member can make a day (a free making's cap, as a book's chapters are) */
export const GOODS_PER_DAY = 30;
export const GOODS_TITLE_MAX = 24;

/** POST /moon/goods: the kind and the art (one of the member's own Jupiter roots) */
export const GoodsMakeBody = z.object({
  kind: z.enum(GOODS_KINDS),
  rootId: z.string().uuid(),
  title: z.string().trim().max(GOODS_TITLE_MAX).optional(),
});
export type GoodsMakeBody = z.infer<typeof GoodsMakeBody>;

export interface GoodsView {
  id: string;
  kind: GoodsKind;
  /** the art it was made from (null: that art was thrown away; the print stays) */
  rootId: string | null;
  /** the art's picture, printed on the mock-up */
  artUrl: string;
  title: string;
  /** on Uranus since (null: kept on the Moon / in Bluena only) */
  flownAt: string | null;
  home: 'uranus';
  tags?: WorkTags;
  createdAt: string;
}

/** a goods item's name: the art's title and the kind (「夕焼けトート」), else 「わたしのトート」 */
export function goodsTitle(kind: GoodsKind, artTitle?: string | null): string {
  const t = (artTitle ?? '').replace(/[\r\n]+/g, ' ').trim();
  return (t ? `${t.slice(0, GOODS_TITLE_MAX - kind.length)}${kind}` : `わたしの${kind}`).slice(0, GOODS_TITLE_MAX);
}

/** an art the member can choose (newest first) */
export type GoodsArt = { id: string; title?: string | null; url: string };
const norm = (s: string) => s.replace(/[\s　「」『』、。！？!?]/g, '').toLowerCase();
const ORD = ['いち|一|1|ひと', 'に|二|2|ふた', 'さん|三|3|みっ', 'よん|四|4|よっ', 'ご|五|5|いつ'];
/**
 * the art the words point at: its title (or part of it), 「いちばん新しいの」「さっきの」「おまかせ」 (the newest),
 * 「いちばん古いの」 (the oldest), 「2番目」「ふたつめ」 (by order, newest first); null = not known
 */
export function pickArt(arts: readonly GoodsArt[], words: string): GoodsArt | null {
  if (!arts.length) return null;
  const w = norm(words);
  if (!w) return null;
  const byTitle = arts.find((a) => a.title && norm(a.title) && (w.includes(norm(a.title)) || (norm(a.title).includes(w) && w.length >= 2)));
  if (byTitle) return byTitle;
  for (let i = 0; i < ORD.length; i++) if (new RegExp(`(${ORD[i]})(番目|ばんめ|つめ|つ目|個目|こめ|枚目|まいめ)`).test(w)) return arts[i] ?? null;
  if (/古い|ふるい|最初|さいしょ|はじめ/.test(w)) return arts.at(-1)!;
  if (/新しい|あたらしい|最新|さいしん|さっき|今の|いまの|最後|さいご|おまかせ|なんでも|どれでも|それ|これ/.test(w)) return arts[0];
  return null;
}

// ───────────────────────────── {bati}'s lines (PROVISIONAL; the story chat checks them) ─────────────────────────────

/** {bati}'s goods lines as written (元気な子); the other styles in GOODS_VARIANTS ({title} = the goods' name) */
export const GOODS_LINES = {
  /** the start: which kind (the examples inside the sentence, no buttons) */
  askKind: 'いいね、グッズを作ろう！　何にする？　トートとか、Tシャツとか、ステッカーとか。アクスタ、マグカップ、缶バッジもできるよ。',
  /** the kind was not understood */
  kindAgain: 'トート、Tシャツ、ステッカー、アクスタ、マグカップ、缶バッジ。どれにする？',
  /** which art (the member's arts are shown small under it) */
  askArt: 'どのアートをのせる？　「いちばん新しいの」とか、絵の名前で言ってね。',
  /** the art was not understood */
  artAgain: 'その名前のアートは、見つからなかった。「いちばん新しいの」でもいいよ。',
  /** no art yet */
  noArt: 'グッズにのせるアートが、まだないみたい。先に、アートを作ろう！',
  /** it is made at once (free) */
  make: 'よし、刷るね！',
  /** made: in Bluena, and it can go to the Uranus shop */
  done: '「{title}」ができたよ！　ブルーナにしまったよ。〔星へ飛ばす〕で、天王星のお店にも並べられるよ。',
  /** the day's goods are used up */
  limit: '今日は、もうたくさん作ったね。つづきは、また明日にしよう。',
} as const;

/**
 * Story session 2026-11-25 — a game's case (Neptune): once a game is made {bati} offers its cover — one of the member's
 * own arts, or one {bati} paints at the art's own price (jacketArt, through the same spell, yes and charge as any art);
 * neither: the case keeps its neon face. {mana} = the art's price, {title} = the art's name.
 */
export const GAME_COVER_LINES = {
  offer: 'ケースの絵は、どうする？　自分のアートからえらんでもいいし、{self}が{mana}マナで描いてもいいよ。いらなければ、ネオンの顔のままにするね。',
  /** one of the member's arts on the case */
  picked: 'ケースに「{title}」をのせたよ！',
  /** {bati} paints one: the art's spell comes next */
  paint: 'じゃあ、ケースの絵を描くね。',
  /** the painted art is on the case */
  painted: 'ケースに、描いた絵をのせたよ！',
  /** none: the neon face stays */
  none: 'わかった。ネオンの顔のままにするね。',
} as const;
export const GOODS_LINE_TEXTS: string[] = [...Object.values(GOODS_LINES), ...Object.values(GAME_COVER_LINES)];

/** 「描いて」: {bati} paints the case; 「いらない」: the neon face stays */
export const coverTalk = (words: string): 'paint' | 'none' | null => {
  const w = words.replace(/\s/g, '');
  if (/いらない|要らない|いらん|なし|無し|このまま|そのまま|ネオン|大丈夫|だいじょうぶ|いいや|やめ/.test(w)) return 'none';
  if (/描いて|かいて|描く|かく|描こう|バティ|おまかせで描|まかせる|まかせた|新しく|あたらしく/.test(w)) return 'paint';
  return null;
};

const v = (teinei: string, kansai: string, cool: string, mellow: string, amae: string, gal: string, galfuwa: string, galane: string, galcool: string, galkansai: string): BatiVariantSet => ({ teinei, kansai, cool, mellow, amae, gal, galfuwa, galane, galcool, galkansai });
const G = GOODS_LINES;
const C = GAME_COVER_LINES;

/** the other styles (PROVISIONAL, P-BATI-VARIANTS): the sentences stay; the style shows in the endings of about half of them */
export const GOODS_VARIANTS: Record<string, BatiVariantSet> = {
  [G.askKind]: v(
    'いいデスね、グッズを作りマショウ！　何にする？　トートとか、Tシャツとか、ステッカーとか。アクスタ、マグカップ、缶バッジもできるよ。',
    'ええやん、グッズ作ろ！　何にする？　トートとか、Tシャツとか、ステッカーとか。アクスタ、マグカップ、缶バッジもできるで。',
    'いいな、グッズを作ろう。　何にする？　トートとか、Tシャツとか、ステッカーとか。アクスタ、マグカップ、缶バッジもできるよ。',
    'いいねぇ、グッズを作ろう〜。　何にする？　トートとか、Tシャツとか、ステッカーとか。アクスタ、マグカップ、缶バッジもできるよ。',
    'いいね、グッズを作ろう！　何にするの？　トートとか、Tシャツとか、ステッカーとか。アクスタ、マグカップ、缶バッジもできるよ。',
    'いいじゃん、グッズ作ろ！　何にする？　トートとか、Tシャツとか、ステッカーとか。アクスタ、マグカップ、缶バッジもできるよ。',
    'いいね〜、グッズを作ろ〜！　何にする？　トートとか、Tシャツとか、ステッカーとか。アクスタ、マグカップ、缶バッジもできるよ。',
    'いいね、グッズを作ろう！　何にする？　トートとか、Tシャツとか、ステッカーとか。アクスタ、マグカップ、缶バッジも任せな。',
    'いいね、グッズ作ろ。　何にする？　トートとか、Tシャツとか、ステッカーとか。アクスタ、マグカップ、缶バッジもできるよ。',
    'ええやん、グッズ作ろ！　何にする？　トートとか、Tシャツとか、ステッカーとか。アクスタ、マグカップ、缶バッジもできるで。',
  ),
  [G.kindAgain]: v(
    'トート、Tシャツ、ステッカー、アクスタ、マグカップ、缶バッジ。どれにしマスか？',
    'トート、Tシャツ、ステッカー、アクスタ、マグカップ、缶バッジ。どれにする？',
    'トート、Tシャツ、ステッカー、アクスタ、マグカップ、缶バッジ。どれにする？',
    'トート、Tシャツ、ステッカー、アクスタ、マグカップ、缶バッジ。どれにしよっか？',
    'トート、Tシャツ、ステッカー、アクスタ、マグカップ、缶バッジ。どれがいい？',
    'トート、Tシャツ、ステッカー、アクスタ、マグカップ、缶バッジ。どれにする？',
    'トート、Tシャツ、ステッカー、アクスタ、マグカップ、缶バッジ。どれにする〜？',
    'トート、Tシャツ、ステッカー、アクスタ、マグカップ、缶バッジ。どれにする？',
    'トート、Tシャツ、ステッカー、アクスタ、マグカップ、缶バッジ。どれだ？',
    'トート、Tシャツ、ステッカー、アクスタ、マグカップ、缶バッジ。どれにする？',
  ),
  [G.askArt]: v(
    'どのアートをのせマスか？　「いちばん新しいの」とか、絵の名前で言ってね。',
    'どのアートのせる？　「いちばん新しいの」とか、絵の名前で言うてな。',
    'どのアートをのせる？　「いちばん新しいの」とか、絵の名前で言ってくれ。',
    'どのアートをのせよっか？　「いちばん新しいの」とか、絵の名前で言ってね。',
    'どのアートをのせる？　「いちばん新しいの」とか、絵の名前で言ってほしいな。',
    'どのアートのせる？　「いちばん新しいの」とか、絵の名前で言ってね！',
    'どのアートをのせる〜？　「いちばん新しいの」とか、絵の名前で言ってね。',
    'どのアートをのせる？　「いちばん新しいの」とか、絵の名前で言いな。',
    'どのアートをのせる？　「いちばん新しいの」とか、絵の名前で言って。',
    'どのアートのせる？　「いちばん新しいの」とか、絵の名前で言うてな。',
  ),
  [G.artAgain]: v(
    'その名前のアートは、見つかりマセンでした。「いちばん新しいの」でもいいよ。',
    'その名前のアートは、見つからへんかった。「いちばん新しいの」でもええよ。',
    'その名前のアートは、見つからなかった。「いちばん新しいの」でもいい。',
    'その名前のアートは、見つからなかったなぁ。「いちばん新しいの」でもいいよ。',
    'その名前のアートは、見つからなかった……。「いちばん新しいの」でもいいよ。',
    'その名前のアートは、見つからなかった。「いちばん新しいの」でもいいじゃん。',
    'その名前のアートは、見つからなかった〜。「いちばん新しいの」でもいいよ。',
    'その名前のアートは、見つからなかった。「いちばん新しいの」でもいいからね。',
    'その名前のアートは、見つからなかった。「いちばん新しいの」でもいいよ。',
    'その名前のアートは、見つからへんかった。「いちばん新しいの」でもええよ。',
  ),
  [G.noArt]: v(
    'グッズにのせるアートが、まだないみたいデス。先に、アートを作ろう！',
    'グッズにのせるアートが、まだないみたいやな。先に、アートを作ろう！',
    'グッズにのせるアートが、まだないみたいだ。先に、アートを作ろう。',
    'グッズにのせるアートが、まだないみたいだねぇ。先に、アートを作ろう！',
    'グッズにのせるアートが、まだないみたい。先に、アートを作ろうよ！',
    'グッズにのせるアートが、まだないっぽい。先に、アートを作ろう！',
    'グッズにのせるアートが、まだないみたい〜。先に、アートを作ろう！',
    'グッズにのせるアートが、まだないみたいだね。先に、アートを作りな！',
    'グッズにのせるアートが、まだないみたい。先に、アートを作ろう。',
    'グッズにのせるアートが、まだないみたいやな。先に、アートを作ろう！',
  ),
  [G.make]: v('よし、刷りマス！', 'よっしゃ、刷るで！', 'よし、刷る。', 'よし、刷るね〜。', 'よし、刷るね！', 'よし、刷るね！', 'よし、刷るね〜！', 'よし、任せな。', 'よし、刷る。', 'よっしゃ、刷るで！'),
  [G.done]: v(
    '「{title}」ができマシタ！　ブルーナにしまったよ。〔星へ飛ばす〕で、天王星のお店にも並べられるよ。',
    '「{title}」ができたで！　ブルーナにしまっといたで。〔星へ飛ばす〕で、天王星のお店にも並べられるよ。',
    '「{title}」ができた。　ブルーナにしまった。〔星へ飛ばす〕で、天王星のお店にも並べられるよ。',
    '「{title}」ができたよ〜！　ブルーナにしまったよ。〔星へ飛ばす〕で、天王星のお店にも並べられるよ。',
    '「{title}」ができたよ！　ブルーナにしまったよ。〔星へ飛ばす〕で、天王星のお店にも並べられるの。',
    '「{title}」、できたよ！　ブルーナにしまったよ。〔星へ飛ばす〕で、天王星のお店にも並べられるよ！',
    '「{title}」ができたよ〜！　ブルーナにしまったよ。〔星へ飛ばす〕で、天王星のお店にも並べられるよ。',
    '「{title}」ができたよ！　ブルーナにしまっといた。〔星へ飛ばす〕で、天王星のお店にも並べられるよ。',
    '「{title}」、できた。　ブルーナにしまった。〔星へ飛ばす〕で、天王星のお店にも並べられるよ。',
    '「{title}」ができたで！　ブルーナにしまっといたで。〔星へ飛ばす〕で、天王星のお店にも並べられるよ。',
  ),
  [G.limit]: v(
    '今日は、もうたくさん作りマシタね。つづきは、また明日にしよう。',
    '今日は、もうぎょうさん作ったな。つづきは、また明日にしよう。',
    '今日は、もうたくさん作ったな。つづきは、また明日にしよう。',
    '今日は、もうたくさん作ったねぇ。つづきは、また明日にしよう。',
    '今日は、もうたくさん作ったね。つづきは、また明日にしようよ。',
    '今日は、もうたくさん作ったじゃん。つづきは、また明日にしよう。',
    '今日は、もうたくさん作ったね〜。つづきは、また明日にしよう。',
    '今日は、もうたくさん作ったね。つづきは、また明日にしな。',
    '今日は、もうたくさん作った。つづきは、また明日にしよう。',
    '今日は、もうぎょうさん作ったな。つづきは、また明日にしよう。',
  ),
  [C.offer]: v(
    'ケースの絵は、どうしマスか？　自分のアートからえらんでもいいし、{self}が{mana}マナで描いてもいいよ。いらなければ、ネオンの顔のままにするね。',
    'ケースの絵は、どないする？　自分のアートからえらんでもええし、{self}が{mana}マナで描いてもいいよ。いらなければ、ネオンの顔のままにするね。',
    'ケースの絵は、どうする？　自分のアートからえらんでもいいし、{self}が{mana}マナで描いてもいい。いらなければ、ネオンの顔のままにする。',
    'ケースの絵は、どうしよっか？　自分のアートからえらんでもいいし、{self}が{mana}マナで描いてもいいよ。いらなければ、ネオンの顔のままにするね。',
    'ケースの絵は、どうする？　自分のアートからえらんでもいいし、{self}が{mana}マナで描いてもいいよ。いらなければ、ネオンの顔のままにしとくね。',
    'ケースの絵、どうする？　自分のアートからえらんでもいいし、{self}が{mana}マナで描いてもいいよ。いらなければ、ネオンの顔のままにするね！',
    'ケースの絵は、どうする〜？　自分のアートからえらんでもいいし、{self}が{mana}マナで描いてもいいよ。いらなければ、ネオンの顔のままにするね。',
    'ケースの絵は、どうする？　自分のアートからえらんでもいいし、{self}が{mana}マナで描いてもいいよ。いらなければ、ネオンの顔のままにしとく。',
    'ケースの絵、どうする？　自分のアートからえらんでもいいし、{self}が{mana}マナで描いてもいい。いらなければ、ネオンの顔のままにするね。',
    'ケースの絵は、どないする？　自分のアートからえらんでもええし、{self}が{mana}マナで描いてもいいよ。いらなければ、ネオンの顔のままにするね。',
  ),
  [C.picked]: v(
    'ケースに「{title}」をのせマシタ！',
    'ケースに「{title}」をのせたで！',
    'ケースに「{title}」をのせた。',
    'ケースに「{title}」をのせたよ〜！',
    'ケースに「{title}」をのせたよ！',
    'ケースに「{title}」、のせたよ！',
    'ケースに「{title}」をのせたよ〜！',
    'ケースに「{title}」をのせといた！',
    'ケースに「{title}」をのせた。',
    'ケースに「{title}」をのせたで！',
  ),
  [C.paint]: v('じゃあ、ケースの絵を描きマス。', 'ほな、ケースの絵を描くで。', 'じゃあ、ケースの絵を描く。', 'じゃあ、ケースの絵を描くね〜。', 'じゃあ、ケースの絵を描くね。', 'じゃあ、ケースの絵を描くね！', 'じゃあ、ケースの絵を描くね〜。', 'じゃあ、ケースの絵は任せな。', 'じゃあ、ケースの絵を描く。', 'ほな、ケースの絵を描くで。'),
  [C.painted]: v(
    'ケースに、描いた絵をのせマシタ！',
    'ケースに、描いた絵をのせたで！',
    'ケースに、描いた絵をのせた。',
    'ケースに、描いた絵をのせたよ〜！',
    'ケースに、描いた絵をのせたよ！',
    'ケースに、描いた絵、のせたよ！',
    'ケースに、描いた絵をのせたよ〜！',
    'ケースに、描いた絵をのせといた！',
    'ケースに、描いた絵をのせた。',
    'ケースに、描いた絵をのせたで！',
  ),
  [C.none]: v(
    'わかりマシタ。ネオンの顔のままにするね。',
    'わかった。ネオンの顔のままにしとくで。',
    'わかった。ネオンの顔のままにする。',
    'わかった〜。ネオンの顔のままにするね。',
    'わかった。ネオンの顔のままにしとくね。',
    'りょ。ネオンの顔のままにするね。',
    'わかった〜。ネオンの顔のままにするね。',
    'わかった。ネオンの顔のままにしとく。',
    'わかった。ネオンの顔のままにする。',
    'わかった。ネオンの顔のままにしとくで。',
  ),
};
