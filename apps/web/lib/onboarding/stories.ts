import { DAY1 } from './day1';
import { DAY2 } from './day2';
import { DAY3 } from './day3';
import { DAY4 } from './day4';
import { DAY5 } from './day5';
import type { Step } from './script';

/** Scripted journey days. Days without a script show the placeholder JourneyDayScreen. */
export interface DayStory {
  steps: Step[];
  /** Label of the skip button on that day's "また明日" countdown. */
  skipLabel: string;
  /** Day 2+ start with the [認証] screen (email + code). Day 1 starts from the invitation. */
  auth: boolean;
}

export const STORIES: Record<number, DayStory> = {
  1: { steps: DAY1, skipLabel: '明日まで待てへん', auth: false },
  2: { steps: DAY2, skipLabel: 'もちろん明日まで待てへん', auth: true },
  3: { steps: DAY3, skipLabel: '明日まで待てへん', auth: true },
  4: { steps: DAY4, skipLabel: '明日まで待てへん', auth: true },
  5: { steps: DAY5, skipLabel: '明日まで待てへん', auth: true },
};

export const DEFAULT_SKIP_LABEL = '明日まで待てへん';
