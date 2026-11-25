import type { BatiVariantSet } from './batiVariants';

/**
 * R18 (client 2026-11-25): {bati}'s lines around Bluena's room and ふくろの魔法 (storage.ts; client 2026-11-25: the room is counted in 袋, 1袋 = 1GB — never 「GB」「容量」 in a line). 元気な子 as written; the other
 * styles by the rules of BATI_VARIANTS (the sentences stay; the style shows in the endings only; ていねいな子 writes
 * デス／マス). Included in BATI_VARIANTS. Written by the dev team, for the story session to review (P-BATI-VARIANTS).
 */
// ───────────────────────────── {bati}'s lines (provisional; the story chat checks them) ─────────────────────────────

export const STORAGE_LINES = {
  /** 80%, once */
  near: 'ブルーナの袋がいっぱいになってきたよ。いらないものを消すか、ふくろの魔法で袋をふやせるよ。',
  /** 100%: a making / an upload stopped */
  full: 'ブルーナの袋がいっぱいだよ。いらないものを消すか、ふくろの魔法で袋をふやしてね。',
  /** 「ふくろの魔法」「袋をふやして」(old: 「保存の魔法」「ブルーナを広げて」): the tiers and their prices in one sentence (no buttons) */
  explain: 'ブルーナの袋をふやす、ふくろの魔法。ひと月10袋が{p10}マナ、30袋が{p30}マナ、100袋が{p100}マナだよ。どれにする？',
  /** the size was not heard */
  which: 'いくつふやす？　10袋、30袋、100袋から選んでね。',
  /** the price, before the yes */
  confirm: '{bags}袋を、ひと月{price}マナだね。唱える？',
  /** charged: the room is bigger */
  done: 'ブルーナの袋が{bags}ふえたよ！',
  /** the tier asked for is the one in effect */
  already: 'ブルーナの袋は、もう{bags}ふえているよ。',
  /** a no to the price */
  stop: 'ふくろの魔法は、またにしようね。',
  /** 「ふくろの魔法をやめて」 */
  cancel: 'ふくろの魔法は、今月でおしまいにするね。来月から、もとの袋の数にもどるよ。',
  /** 「ふくろの魔法をやめて」 with no plan */
  cancelNone: 'ふくろの魔法は、いまは唱えていないよ。',
  /** the renewal found too little mana: 7 days of grace */
  grace: 'マナが足りなくて、ふくろの魔法が続けられなかったよ。{days}日のうちにマナがたまれば、そのまま続くよ。',
  /** the tier lapsed (no file deleted) */
  lapsed: 'ふくろの魔法がとけて、ブルーナの袋がもとの数にもどったよ。作品は消えていないから、安心してね。',
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
    'ブルーナの袋がいっぱいになってきマシタ。いらないものを消すか、ふくろの魔法で袋をふやせマス。',
    'ブルーナの袋がいっぱいになってきたで。いらないものを消すか、ふくろの魔法で袋をふやせるよ。',
    'ブルーナの袋がいっぱいになってきた。いらないものを消すか、ふくろの魔法で袋をふやせるよ。',
    'ブルーナの袋がいっぱいになってきたねぇ。いらないものを消すか、ふくろの魔法で袋をふやせるよ。',
    'ブルーナの袋がいっぱいになってきたよぉ。いらないものを消すか、ふくろの魔法で袋をふやせるよ。',
    'ブルーナの袋、いっぱいになってきたじゃん。いらないものを消すか、ふくろの魔法で袋をふやせるよ。',
    'ブルーナの袋がいっぱいになってきたよ〜。いらないものを消すか、ふくろの魔法で袋をふやせるよ。',
    'ブルーナの袋がいっぱいになってきたよ。いらないものを消すか、ふくろの魔法で袋をふやせるよ。',
    'ブルーナの袋、いっぱいになってきた。いらないものを消すか、ふくろの魔法で袋をふやせるよ。',
    'ブルーナの袋がいっぱいになってきたやん。いらないものを消すか、ふくろの魔法で袋をふやせるよ。',
  ),
  [L.full]: v(
    'ブルーナの袋がいっぱいデス。いらないものを消すか、ふくろの魔法で袋をふやしてね。',
    'ブルーナの袋がいっぱいやで。いらないものを消すか、ふくろの魔法で袋をふやしてね。',
    'ブルーナの袋がいっぱいだ。いらないものを消すか、ふくろの魔法で袋をふやしてね。',
    'ブルーナの袋がいっぱいだよぉ。いらないものを消すか、ふくろの魔法で袋をふやしてね。',
    'ブルーナの袋がいっぱいだよ。いらないものを消すか、ふくろの魔法で袋をふやしてほしいな。',
    'ブルーナの袋、もういっぱいじゃん。いらないものを消すか、ふくろの魔法で袋をふやしてね。',
    'ブルーナの袋がいっぱいだよ〜。いらないものを消すか、ふくろの魔法で袋をふやしてね。',
    'ブルーナの袋がいっぱいだよ。いらないものを消すか、ふくろの魔法で袋をふやしな。',
    'ブルーナの袋、いっぱい。いらないものを消すか、ふくろの魔法で袋をふやしてね。',
    'ブルーナの袋がいっぱいやん。いらないものを消すか、ふくろの魔法で袋をふやしてね。',
  ),
  // said as written in every style (the style shows in the lines around it)
  [L.explain]: same(L.explain),
  // said as written in every style (the style shows in the lines around it)
  [L.which]: same(L.which),
  [L.confirm]: v(
    '{bags}袋を、ひと月{price}マナだね。唱えマスか？',
    '{bags}袋を、ひと月{price}マナやな。唱える？',
    '{bags}袋を、ひと月{price}マナだな。唱える？',
    '{bags}袋を、ひと月{price}マナだねぇ。唱える？',
    '{bags}袋を、ひと月{price}マナだね。唱えよっか？',
    '{bags}袋を、ひと月{price}マナね。唱える？',
    '{bags}袋を、ひと月{price}マナだね〜。唱える？',
    '{bags}袋を、ひと月{price}マナだね。唱えちゃう？',
    '{bags}袋を、ひと月{price}マナ。唱える？',
    '{bags}袋を、ひと月{price}マナやね。唱える？',
  ),
  // said as written in every style (the style shows in the lines around it)
  [L.done]: same(L.done),
  // said as written in every style (the style shows in the lines around it)
  [L.already]: same(L.already),
  // said as written in every style (the style shows in the lines around it)
  [L.stop]: same(L.stop),
  [L.cancel]: v(
    'ふくろの魔法は、今月でおしまいにしマス。来月から、もとの袋の数にもどるよ。',
    'ふくろの魔法は、今月でおしまいにするで。来月から、もとの袋の数にもどるよ。',
    'ふくろの魔法は、今月でおしまいにする。来月から、もとの袋の数にもどるよ。',
    'ふくろの魔法は、今月でおしまいにするねぇ。来月から、もとの袋の数にもどるよ。',
    'ふくろの魔法は、今月でおしまいにするね。来月から、もとの袋の数にもどっちゃうよ。',
    'ふくろの魔法は、今月でおしまいね。来月から、もとの袋の数にもどるよ。',
    'ふくろの魔法は、今月でおしまいにするね〜。来月から、もとの袋の数にもどるよ。',
    'ふくろの魔法は、今月でおしまいにするね。来月から、もとの袋の数にもどるからね。',
    'ふくろの魔法は、今月でおしまい。来月から、もとの袋の数にもどるよ。',
    'ふくろの魔法は、今月でおしまいにするわ。来月から、もとの袋の数にもどるよ。',
  ),
  // said as written in every style (the style shows in the lines around it)
  [L.cancelNone]: same(L.cancelNone),
  [L.grace]: v(
    'マナが足りなくて、ふくろの魔法が続けられマセンデシタ。{days}日のうちにマナがたまれば、そのまま続くよ。',
    'マナが足りなくて、ふくろの魔法が続けられへんかった。{days}日のうちにマナがたまれば、そのまま続くよ。',
    'マナが足りなくて、ふくろの魔法が続けられなかった。{days}日のうちにマナがたまれば、そのまま続くよ。',
    'マナが足りなくて、ふくろの魔法が続けられなかったよぉ。{days}日のうちにマナがたまれば、そのまま続くよ。',
    'マナが足りなくて、ふくろの魔法が続けられなかったよ。{days}日のうちにマナがたまれば、そのまま続くからね。',
    'マナが足りなくて、ふくろの魔法が続けられなかったじゃん。{days}日のうちにマナがたまれば、そのまま続くよ。',
    'マナが足りなくて、ふくろの魔法が続けられなかったよ〜。{days}日のうちにマナがたまれば、そのまま続くよ。',
    'マナが足りなくて、ふくろの魔法が続けられなかったよ。{days}日のうちにマナがたまれば、そのまま続くからね。',
    'マナが足りなくて、ふくろの魔法が続けられなかった。{days}日のうちにマナがたまれば、そのまま続くよ。',
    'マナが足りなくて、ふくろの魔法が続けられへんかったわ。{days}日のうちにマナがたまれば、そのまま続くよ。',
  ),
  [L.lapsed]: v(
    'ふくろの魔法がとけて、ブルーナの袋がもとの数にもどりマシタ。作品は消えていないから、安心してね。',
    'ふくろの魔法がとけて、ブルーナの袋がもとの数にもどったで。作品は消えていないから、安心してね。',
    'ふくろの魔法がとけて、ブルーナの袋がもとの数にもどった。作品は消えていないから、安心してね。',
    'ふくろの魔法がとけて、ブルーナの袋がもとの数にもどったよぉ。作品は消えていないから、安心してね。',
    'ふくろの魔法がとけて、ブルーナの袋がもとの数にもどったよ。作品は消えていないから、安心してほしいな。',
    'ふくろの魔法がとけて、ブルーナの袋がもとの数にもどったじゃん。作品は消えていないから、安心してね。',
    'ふくろの魔法がとけて、ブルーナの袋がもとの数にもどったよ〜。作品は消えていないから、安心してね。',
    'ふくろの魔法がとけて、ブルーナの袋がもとの数にもどったよ。作品は消えていないから、安心しな。',
    'ふくろの魔法がとけて、ブルーナの袋がもとの数にもどった。作品は消えていないから、安心してね。',
    'ふくろの魔法がとけて、ブルーナの袋がもとの数にもどったわ。作品は消えていないから、安心してね。',
  ),
  // said as written in every style (the style shows in the lines around it)
  [L.failed]: same(L.failed),
};

