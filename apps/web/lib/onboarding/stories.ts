import { DAY1 } from './day1';
import { DAY2 } from './day2';
import { DAY3 } from './day3';
import { DAY4 } from './day4';
import { DAY5 } from './day5';
import { DAY6 } from './day6';
import { DAY7 } from './day7';
import { DAY8 } from './day8';
import type { Step } from './script';

/**
 * Scripted journey days (eight-day first journey, story draft 21). Days without a script show the
 * placeholder JourneyDayScreen.
 */
export interface DayStory {
  steps: Step[];
  /** Label of the skip button on that day's "また明日" countdown. */
  skipLabel: string;
  /** Day 2+ start with the email check (the 6-digit code). Day 1 starts from the invitation. */
  auth: boolean;
  /** The caption when the skip has rolled the clock to zero (instead of 「扉が開いた」). */
  skippedText?: string;
}

export const DEFAULT_SKIP_LABEL = '明日まで待てない';

export const STORIES: Record<number, DayStory> = {
  1: { steps: DAY1, skipLabel: DEFAULT_SKIP_LABEL, auth: false, skippedText: '24時間スキップした' }, // the script's telop (QA 14 R53)
  // the end of day 2 (the Moon): 「もちろん明日まで待てない」 (story M-R67) → 〔テロップ：24時間スキップした〕 (client 2026-10-22)
  2: { steps: DAY2, skipLabel: 'もちろん明日まで待てない', auth: true, skippedText: '24時間スキップした' },
  3: { steps: DAY3, skipLabel: DEFAULT_SKIP_LABEL, auth: true },
  4: { steps: DAY4, skipLabel: DEFAULT_SKIP_LABEL, auth: true },
  5: { steps: DAY5, skipLabel: DEFAULT_SKIP_LABEL, auth: true },
  6: { steps: DAY6, skipLabel: DEFAULT_SKIP_LABEL, auth: true },
  7: { steps: DAY7, skipLabel: DEFAULT_SKIP_LABEL, auth: true },
  // the Sun: the Eclipse is a choice inside the story (pay → ORDER, or stay a resident); no countdown after it
  8: { steps: DAY8, skipLabel: DEFAULT_SKIP_LABEL, auth: true },
};

/** Days shown only on the preview pages (none now: Venus is day 7 of the first journey since draft 21). */
export const PREVIEW_ONLY: Record<number, DayStory> = {};
