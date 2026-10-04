import type { StoryProgress } from '@/components/onboarding/StoryPlayer';

const KEY = 'obolo.story.day1';
const dayKey = (day: number) => (day === 1 ? KEY : `obolo.story.day${day}`);

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

/** Story progress for days 2+ (keyed by user so two test accounts on one device do not mix). */
export function loadDay(day: number, userId: string): StoryProgress | null {
  try {
    const raw = localStorage.getItem(`${dayKey(day)}.${userId}`);
    return raw ? (JSON.parse(raw) as StoryProgress) : null;
  } catch {
    return null;
  }
}

export function saveDay(day: number, userId: string, p: StoryProgress) {
  try {
    localStorage.setItem(`${dayKey(day)}.${userId}`, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function clearDay(day: number, userId: string) {
  try {
    localStorage.removeItem(`${dayKey(day)}.${userId}`);
  } catch {
    /* ignore */
  }
}
