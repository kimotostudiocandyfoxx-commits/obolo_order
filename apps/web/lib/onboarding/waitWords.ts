import { NO_SKIP_INTO_DAYS, nextJourneyDay } from '@obolo/shared';

/**
 * The words of the two waits that cannot be skipped (client 2026-11-28: into day 4 and day 8 — NO_SKIP_INTO_DAYS in
 * @obolo/shared). Keyed by the day just finished. Provisional wording from the story session, until the client has
 * seen it: replace the strings here. `{bati}` = the member's Bati's name; `{残り時間}` = the live countdown.
 * Instead of 〔明日まで待てない〕 these waits show 〔{bati}と話す〕 and 〔ダチのホームへ〕.
 */
export interface NoSkipWaitWords {
  /** the main line under the countdown */
  text: string;
  /** the small line in place of 「つぎの扉が ひらくまで」 */
  until: string;
}

export const NO_SKIP_WAIT_WORDS: Readonly<Record<number, NoSkipWaitWords>> = {
  // day 3 (Saturn) → day 4
  3: {
    text: '今夜は、ここでひと休み。{bati}は、月の工房で、明日の星の準備をしているよ。そのあいだに、ダチと話してみよう。',
    until: '次の星の門は、{残り時間}後に開きます',
  },
  // day 7 (Venus) → day 8
  7: {
    text: '5つの星をめぐった。今夜は、切符を眺めて、旅をふり返ろう。明日から、切符の裏の星へ。{bati}も、楽しみにしているよ。',
    until: '次の星の門は、{残り時間}後に開きます',
  },
};

/** the words of the wait after `day` when it cannot be skipped ({bati} filled in), else undefined */
export function noSkipWaitWords(day: number, bati: string): NoSkipWaitWords | undefined {
  if (!NO_SKIP_INTO_DAYS.includes(nextJourneyDay(day))) return undefined;
  const w = NO_SKIP_WAIT_WORDS[day];
  if (!w) return undefined;
  return { text: w.text.replaceAll('{bati}', bati), until: w.until.replaceAll('{bati}', bati) };
}

/**
 * The skippable waits after day 1 (days 2, 4–6, 8–10; story M-R348: 〔カウントダウンの下に、ボタン：待ちきれない〕
 * 〔テロップ：24時間スキップした〕). Day 1 keeps its own (STORIES[1].skipLabel 「明日まで待てない」).
 */
export const WAIT_SKIP_LABEL = '待ちきれない';
export const WAIT_SKIPPED_TEXT = '24時間スキップした';

/** where the no-skip wait's two buttons go: {bati}'s chat and the ダチ talks (the Moon atelier's tabs) */
export const WAIT_BATI_HREF = '/moon/atelier';
export const WAIT_DACHI_HREF = '/moon/atelier?tab=dachi';
