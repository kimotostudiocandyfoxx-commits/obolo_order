import type { BatiVariantSet } from './batiVariants';

/**
 * R18 (client 2026-11-25): {bati}'s lines around Bluena's room and 保存の魔法 (storage.ts). 元気な子 as written; the other
 * styles by the rules of BATI_VARIANTS (the sentences stay; the style shows in the endings only; ていねいな子 writes
 * デス／マス). Included in BATI_VARIANTS. Written by the dev team, for the story session to review (P-BATI-VARIANTS).
 */
// ───────────────────────────── {bati}'s lines (provisional; the story chat checks them) ─────────────────────────────

export const STORAGE_LINES = {
  /** 80%, once */
  near: 'ブルーナがいっぱいになってきたよ。いらないものを消すか、保存の魔法で広げられるよ。',
  /** 100%: a making / an upload stopped */
  full: 'ブルーナがいっぱいだよ。いらないものを消すか、保存の魔法で広げてね。',
  /** 「保存の魔法」「ブルーナを広げて」: the tiers and their prices in one sentence (no buttons) */
  explain: 'ブルーナを広げる保存の魔法は、ひと月10GBが{p10}マナ、30GBが{p30}マナ、100GBが{p100}マナだよ。どれにする？',
  /** the size was not heard */
  which: 'どの大きさにする？　10GB、30GB、100GBから選んでね。',
  /** the price, before the yes */
  confirm: '{gb}GBを、ひと月{price}マナだね。唱える？',
  /** charged: the room is bigger */
  done: 'ブルーナが{gb}GB広がったよ！',
  /** the tier asked for is the one in effect */
  already: 'ブルーナは、もう{gb}GB広がっているよ。',
  /** a no to the price */
  stop: '保存の魔法は、またにしようね。',
  /** 「保存の魔法をやめて」 */
  cancel: '保存の魔法は、今月でおしまいにするね。来月から、もとの広さにもどるよ。',
  /** 「保存の魔法をやめて」 with no plan */
  cancelNone: '保存の魔法は、いまは唱えていないよ。',
  /** the renewal found too little mana: 7 days of grace */
  grace: 'マナが足りなくて、保存の魔法が続けられなかったよ。{days}日のうちにマナがたまれば、そのまま続くよ。',
  /** the tier lapsed (no file deleted) */
  lapsed: '保存の魔法がとけて、ブルーナがもとの広さにもどったよ。作品は消えていないから、安心してね。',
  /** something went wrong */
  failed: 'うまく唱えられなかった…。また、あとでためしてね。',
} as const;
export const STORAGE_LINE_TEXTS: string[] = Object.values(STORAGE_LINES);

const v = (teinei: string, kansai: string, cool: string, mellow: string, amae: string, gal: string, galfuwa: string, galane: string, galcool: string, galkansai: string): BatiVariantSet => ({ teinei, kansai, cool, mellow, amae, gal, galfuwa, galane, galcool, galkansai });

const L = STORAGE_LINES;
const same = (line: string): BatiVariantSet => v(line, line, line, line, line, line, line, line, line, line);
/** the other styles (the sentences stay; the style shows in about half of them; ていねいな子 writes デス／マス) */
export const STORAGE_VARIANTS: Record<string, BatiVariantSet> = {
  [L.near]: v(
    'ブルーナがいっぱいになってきマシタ。いらないものを消すか、保存の魔法で広げられマス。',
    'ブルーナがいっぱいになってきたで。いらないものを消すか、保存の魔法で広げられるよ。',
    'ブルーナがいっぱいになってきた。いらないものを消すか、保存の魔法で広げられる。',
    'ブルーナがいっぱいになってきたねぇ。いらないものを消すか、保存の魔法で広げられるよ。',
    'ブルーナがいっぱいになってきたよぉ。いらないものを消すか、保存の魔法で広げられるよ。',
    'ブルーナ、いっぱいになってきたじゃん。いらないものを消すか、保存の魔法で広げられるよ。',
    'ブルーナがいっぱいになってきたよ〜。いらないものを消すか、保存の魔法で広げられるよ。',
    'ブルーナがいっぱいになってきたよ。いらないものを消すか、保存の魔法で広げられるよ。',
    'ブルーナ、いっぱいになってきた。いらないものを消すか、保存の魔法で広げられるよ。',
    'ブルーナがいっぱいになってきたやん。いらないものを消すか、保存の魔法で広げられるで。',
  ),
  [L.full]: v(
    'ブルーナがいっぱいデス。いらないものを消すか、保存の魔法で広げてね。',
    'ブルーナがいっぱいやで。いらないものを消すか、保存の魔法で広げてね。',
    'ブルーナがいっぱいだ。いらないものを消すか、保存の魔法で広げてね。',
    'ブルーナがいっぱいだよぉ。いらないものを消すか、保存の魔法で広げてね。',
    'ブルーナがいっぱいだよ。いらないものを消すか、保存の魔法で広げてほしいな。',
    'ブルーナ、もういっぱいじゃん。いらないものを消すか、保存の魔法で広げてね。',
    'ブルーナがいっぱいだよ〜。いらないものを消すか、保存の魔法で広げてね。',
    'ブルーナがいっぱいだよ。いらないものを消すか、保存の魔法で広げな。',
    'ブルーナ、いっぱい。いらないものを消すか、保存の魔法で広げてね。',
    'ブルーナがいっぱいやん。いらないものを消すか、保存の魔法で広げてね。',
  ),
  // said as written in every style (the style shows in the lines around it)
  [L.explain]: same(L.explain),
  // said as written in every style (the style shows in the lines around it)
  [L.which]: same(L.which),
  [L.confirm]: v(
    '{gb}GBを、ひと月{price}マナだね。唱えマスか？',
    '{gb}GBを、ひと月{price}マナやな。唱える？',
    '{gb}GBを、ひと月{price}マナだな。唱える？',
    '{gb}GBを、ひと月{price}マナだねぇ。唱える？',
    '{gb}GBを、ひと月{price}マナだね。唱えよっか？',
    '{gb}GBを、ひと月{price}マナね。唱える？',
    '{gb}GBを、ひと月{price}マナだね〜。唱える？',
    '{gb}GBを、ひと月{price}マナだね。唱えちゃう？',
    '{gb}GBを、ひと月{price}マナ。唱える？',
    '{gb}GBを、ひと月{price}マナやね。唱える？',
  ),
  // said as written in every style (the style shows in the lines around it)
  [L.done]: same(L.done),
  // said as written in every style (the style shows in the lines around it)
  [L.already]: same(L.already),
  // said as written in every style (the style shows in the lines around it)
  [L.stop]: same(L.stop),
  [L.cancel]: v(
    '保存の魔法は、今月でおしまいにしマス。来月から、もとの広さにもどるよ。',
    '保存の魔法は、今月でおしまいにするで。来月から、もとの広さにもどるよ。',
    '保存の魔法は、今月でおしまいにする。来月から、もとの広さにもどるよ。',
    '保存の魔法は、今月でおしまいにするねぇ。来月から、もとの広さにもどるよ。',
    '保存の魔法は、今月でおしまいにするね。来月から、もとの広さにもどっちゃうよ。',
    '保存の魔法は、今月でおしまいね。来月から、もとの広さにもどるよ。',
    '保存の魔法は、今月でおしまいにするね〜。来月から、もとの広さにもどるよ。',
    '保存の魔法は、今月でおしまいにするね。来月から、もとの広さにもどるからね。',
    '保存の魔法は、今月でおしまい。来月から、もとの広さにもどるよ。',
    '保存の魔法は、今月でおしまいにするわ。来月から、もとの広さにもどるよ。',
  ),
  // said as written in every style (the style shows in the lines around it)
  [L.cancelNone]: same(L.cancelNone),
  [L.grace]: v(
    'マナが足りなくて、保存の魔法が続けられマセンデシタ。{days}日のうちにマナがたまれば、そのまま続くよ。',
    'マナが足りなくて、保存の魔法が続けられへんかった。{days}日のうちにマナがたまれば、そのまま続くよ。',
    'マナが足りなくて、保存の魔法が続けられなかった。{days}日のうちにマナがたまれば、そのまま続くよ。',
    'マナが足りなくて、保存の魔法が続けられなかったよぉ。{days}日のうちにマナがたまれば、そのまま続くよ。',
    'マナが足りなくて、保存の魔法が続けられなかったよ。{days}日のうちにマナがたまれば、そのまま続くからね。',
    'マナが足りなくて、保存の魔法が続けられなかったじゃん。{days}日のうちにマナがたまれば、そのまま続くよ。',
    'マナが足りなくて、保存の魔法が続けられなかったよ〜。{days}日のうちにマナがたまれば、そのまま続くよ。',
    'マナが足りなくて、保存の魔法が続けられなかったよ。{days}日のうちにマナがたまれば、そのまま続くからね。',
    'マナが足りなくて、保存の魔法が続けられなかった。{days}日のうちにマナがたまれば、そのまま続くよ。',
    'マナが足りなくて、保存の魔法が続けられへんかったわ。{days}日のうちにマナがたまれば、そのまま続くよ。',
  ),
  [L.lapsed]: v(
    '保存の魔法がとけて、ブルーナがもとの広さにもどりマシタ。作品は消えていないから、安心してね。',
    '保存の魔法がとけて、ブルーナがもとの広さにもどったで。作品は消えていないから、安心してね。',
    '保存の魔法がとけて、ブルーナがもとの広さにもどった。作品は消えていないから、安心してね。',
    '保存の魔法がとけて、ブルーナがもとの広さにもどったよぉ。作品は消えていないから、安心してね。',
    '保存の魔法がとけて、ブルーナがもとの広さにもどったよ。作品は消えていないから、安心してほしいな。',
    '保存の魔法がとけて、ブルーナがもとの広さにもどったじゃん。作品は消えていないから、安心してね。',
    '保存の魔法がとけて、ブルーナがもとの広さにもどったよ〜。作品は消えていないから、安心してね。',
    '保存の魔法がとけて、ブルーナがもとの広さにもどったよ。作品は消えていないから、安心しな。',
    '保存の魔法がとけて、ブルーナがもとの広さにもどった。作品は消えていないから、安心してね。',
    '保存の魔法がとけて、ブルーナがもとの広さにもどったわ。作品は消えていないから、安心してね。',
  ),
  // said as written in every style (the style shows in the lines around it)
  [L.failed]: same(L.failed),
};

