import { DAY1 } from './day1';
import { DAY2 } from './day2';
import { DAY3, DAY3_NEW_HOME } from './day3';
import { DAY4, DAY4_NEW_HOME } from './day4';
import { DAY5, DAY5_NEW_HOME } from './day5';
import { DAY6, DAY6_NEW_HOME } from './day6';
import { DAY7, DAY7_NEW_HOME } from './day7';
import { DAY8, DAY8_NEW_HOME, DAY9, DAY9_NEW_HOME, DAY10, DAY10_NEW_HOME } from './outer';
import { DAY11 } from './day11';
import type { Step } from './script';

/**
 * Scripted journey days (eleven-day first journey since M-R341: 8 Pluto, 9 Neptune, 10 Uranus, 11 the Sun). Days
 * without a script show the placeholder JourneyDayScreen.
 */
export interface DayStory {
  steps: Step[];
  /**
   * Label of the skip button on that day's "また明日" countdown. Only days 1 and 2 have one (M-R207: the server skips the
   * wait only while journeyDay ≤ 2); from day 3 the 24 hours are waited, so no label (HomeGate shows no button).
   */
  skipLabel?: string;
  /** Day 2+ start with the email check (the 6-digit code). Day 1 starts from the invitation. */
  auth: boolean;
  /** The caption when the skip has rolled the clock to zero (instead of 「扉が開いた」). */
  skippedText?: string;
  /** 〔完了画面〕 words of the day's end, over the countdown (D08-S011: 「最初の旅、おわり。ここから先は、どの星へも自由に」) */
  doneText?: string;
  /** a line under the countdown when {bati} is there ({bati} = its name): D03-S009's note on the 24 hours with {bati} */
  waitNote?: string;
  /** the words under the countdown (default 「つぎの扉が ひらくまで」) */
  untilText?: string;
}

export const DEFAULT_SKIP_LABEL = '明日まで待てない';

export const STORIES: Record<number, DayStory> = {
  // the script's telop (QA 14 R53); the countdown waits for the ticket MONBAN promised (client 2026-11-28)
  1: { steps: DAY1, skipLabel: DEFAULT_SKIP_LABEL, auth: false, skippedText: '24時間スキップした', untilText: '宇宙行きの切符が届くまで' },
  // the end of day 2 (the Moon): D03-S009 — the 24 hours are waited (M-R269: no 〔明日まで待てない〕 after day 2; testers
  // still skip); they are {bati}'s (M-R223)
  2: {
    steps: DAY2,
    auth: true,
    waitNote: '明日、星へ遊びに行くまでの24時間は、{bati}と好きなだけ話せます',
  },
  3: { steps: DAY3, auth: true },
  4: { steps: DAY4, auth: true },
  5: { steps: DAY5, auth: true },
  6: { steps: DAY6, auth: true },
  7: { steps: DAY7, auth: true },
  // M-R341: the three outer planets, before becoming Obolo Order (lib/onboarding/outer.ts)
  8: { steps: DAY8, auth: true },
  9: { steps: DAY9, auth: true },
  10: { steps: DAY10, auth: true },
  // the Sun: the Eclipse is a choice inside the story (pay → ORDER, or stay a resident); no countdown after it
  11: { steps: DAY11, auth: true, doneText: '最初の旅、おわり。ここから先は、どの星へも自由に' },
};

/**
 * story 2026-11-27 (M-R330): the days as they play once every planet has its new home — the script of now is written
 * for these (apps/web/scripts/story-sync.ts checks them). With the switch off (the default) STORIES plays the days'
 * steps of before, unchanged.
 */
export const STORIES_NEW_HOMES: Record<number, DayStory> = {
  ...STORIES,
  3: { ...STORIES[3], steps: DAY3_NEW_HOME },
  4: { ...STORIES[4], steps: DAY4_NEW_HOME },
  5: { ...STORIES[5], steps: DAY5_NEW_HOME },
  6: { ...STORIES[6], steps: DAY6_NEW_HOME },
  7: { ...STORIES[7], steps: DAY7_NEW_HOME },
  // M-R343: days 8–10 in the same form
  8: { ...STORIES[8], steps: DAY8_NEW_HOME },
  9: { ...STORIES[9], steps: DAY9_NEW_HOME },
  10: { ...STORIES[10], steps: DAY10_NEW_HOME },
};

/** Days shown only on the preview pages (none now: Venus is day 7 of the first journey since draft 21). */
export const PREVIEW_ONLY: Record<number, DayStory> = {};
