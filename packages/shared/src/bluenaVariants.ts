import type { BatiVariantSet } from './batiVariants';

/**
 * R16 (client 2026-11-25): {bati}'s lines around Bluena's viewer — 〔バティといじる〕 (the work set as the one being
 * changed: 「どういじる？」) and opening a work by words (「ブルーナの〇〇流して」「この前の〇〇の絵見せて」「〇〇の本読みたい」).
 * 元気な子 as written; the other styles by the rules of BATI_VARIANTS (the sentences stay; the style shows in the endings
 * and the 呼び方 only; ていねいな子 writes デス／マス). Included in BATI_VARIANTS. Written by the dev team, for the story
 * session to review (P-BATI-VARIANTS).
 */
export const BLUENA_LINES = {
  /** 〔バティといじる〕: the work is on the table, {bati} asks what to change */
  editAsk: '「{title}」だね。どういじる？',
  /** a song / a radio show / a kororin opened by words: it plays */
  openPlay: '「{title}」、流すね！',
  /** a picture, a video, a book or a game opened by words */
  openShow: '「{title}」、ひらくね！',
  /** more than one work matches the words: the titles as chips */
  openWhich: 'いくつか見つかったよ。どれかな？',
  /** nothing in Bluena matches */
  openNone: 'ブルーナには、見つからなかったよ。',
} as const;
export const BLUENA_LINE_TEXTS: string[] = Object.values(BLUENA_LINES);

const v = (teinei: string, kansai: string, cool: string, mellow: string, amae: string, gal: string, galfuwa: string, galane: string, galcool: string, galkansai: string): BatiVariantSet => ({ teinei, kansai, cool, mellow, amae, gal, galfuwa, galane, galcool, galkansai });

export const BLUENA_VARIANTS: Record<string, BatiVariantSet> = {
  [BLUENA_LINES.editAsk]: v(
    '「{title}」だね。どういじりマスか？',
    '「{title}」やな。どういじる？',
    '「{title}」だな。どういじる？',
    '「{title}」だね〜。どういじる？',
    '「{title}」だね。どういじる？',
    '「{title}」じゃん！　どういじる？',
    '「{title}」だね〜。どういじる？',
    '「{title}」だね。どういじりたい？',
    '「{title}」ね。どういじる？',
    '「{title}」やね！　どういじる？',
  ),
  [BLUENA_LINES.openPlay]: v(
    '「{title}」、流しマス！',
    '「{title}」、流すで！',
    '「{title}」、流すぞ。',
    '「{title}」、流すね〜。',
    '「{title}」、流すね！',
    '「{title}」、流すね！',
    '「{title}」、流すね〜。',
    '「{title}」、流すよ！',
    '「{title}」、流すね。',
    '「{title}」、流すで！',
  ),
  [BLUENA_LINES.openShow]: v(
    '「{title}」、ひらきマス！',
    '「{title}」、ひらくで！',
    '「{title}」、ひらくぞ。',
    '「{title}」、ひらくね〜。',
    '「{title}」、ひらくね！',
    '「{title}」、ひらくね！',
    '「{title}」、ひらくね〜。',
    '「{title}」、ひらくよ！',
    '「{title}」、ひらくね。',
    '「{title}」、ひらくで！',
  ),
  [BLUENA_LINES.openWhich]: v(
    'いくつか見つかりマシタ。どれかな？',
    'いくつか見つかったで。どれかな？',
    'いくつか見つかった。どれだ？',
    'いくつか見つかったよ〜。どれかな？',
    'いくつか見つかったよ。どれかな？',
    'いくつか見つかったよ！　どれかな？',
    'いくつか見つかったよ〜。どれかな？',
    'いくつか見つかったよ。どれだい？',
    'いくつか見つかった。どれかな？',
    'いくつか見つかったで！　どれかな？',
  ),
  [BLUENA_LINES.openNone]: v(
    'ブルーナには、見つかりませんデシタ。',
    'ブルーナには、見つからへんかったで。',
    'ブルーナには、見つからなかった。',
    'ブルーナには、見つからなかったよ〜。',
    'ブルーナには、見つからなかったよ。',
    'ブルーナには、見つからなかったよ！',
    'ブルーナには、見つからなかったよ〜。',
    'ブルーナには、見つからなかったね。',
    'ブルーナには、見つからなかった。',
    'ブルーナには、見つからへんかったで。',
  ),
};
