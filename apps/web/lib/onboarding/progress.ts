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

/** Day 2 unlocks on the next calendar day in Japan time (PLACEHOLDER P-OB-3). */
export function jstDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(d);
}

export function msUntilNextJstDay(now = new Date()): number {
  const jst = new Date(now.getTime() + 9 * 3600_000);
  const next = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() + 1) - 9 * 3600_000;
  return next - now.getTime();
}

/** PLACEHOLDER (P-OB-3): lets the 10/10 demo continue past "come back tomorrow". */
export const ALLOW_DAY_SKIP = process.env.NEXT_PUBLIC_ALLOW_DAY_SKIP !== 'false';
