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
