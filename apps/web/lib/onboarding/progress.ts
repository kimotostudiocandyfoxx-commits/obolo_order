import type { StoryProgress } from '@/components/onboarding/StoryPlayer';

const KEY = 'obolo.story.day1';

export interface SavedDay1 extends StoryProgress {
  code: string;
}

export function loadDay1(): SavedDay1 | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedDay1) : null;
  } catch {
    return null;
  }
}

export function saveDay1(p: SavedDay1) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function clearDay1() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Day 2 unlocks 24 hours after Day 1 is finished, or immediately with "明日まで待てへん". */
export const DAY_WAIT_MS = 24 * 3600_000;

const unlockKey = (userId: string) => `obolo.day2.unlocked.${userId}`;

/** PLACEHOLDER (P-OB-3): the skip is remembered on this device only; move to the server with Day 2. */
export function isDay2Unlocked(userId: string, completedAt: string | null): boolean {
  if (completedAt && Date.now() >= Date.parse(completedAt) + DAY_WAIT_MS) return true;
  try {
    return localStorage.getItem(unlockKey(userId)) === '1';
  } catch {
    return false;
  }
}

export function markDay2Unlocked(userId: string) {
  try {
    localStorage.setItem(unlockKey(userId), '1');
  } catch {
    /* ignore */
  }
}
