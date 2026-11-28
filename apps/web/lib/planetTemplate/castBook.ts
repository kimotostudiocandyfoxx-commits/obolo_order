/**
 * Pluto's picture book (handoff planets-08 §3 / §6, the prototype's sapBook): a children's book of square pages — six
 * for a Sushimon, three for a resident or KIMORIN⭐︎ — with the words on a band at the bottom of the picture. Its maker
 * reads the title, then each page; when a page has been read the next one turns by itself, and after the last the book
 * closes and flies away (also when 〔›〕 is pressed on the last page). The reading speed (ゆっくり / ふつう / はやい) changes
 * the speed only, never the pitch, and is remembered on the device. This file is the pure part (castBook.test.ts).
 */
export const BOOK_SPEEDS: readonly { label: string; rate: number }[] = [
  { label: 'ゆっくり', rate: 0.8 },
  { label: 'ふつう', rate: 1 },
  { label: 'はやい', rate: 1.3 },
];
export const BOOK_SPEED_KEY = 'obolo.book.speed';

/** the stored speed when it is one of the three, else ふつう */
export function bookSpeedOf(stored: string | null | undefined): number {
  const x = Number(stored);
  return BOOK_SPEEDS.some((b) => b.rate === x) ? x : 1;
}
/** the speed remembered on this device */
export function storedBookSpeed(): number {
  try {
    return bookSpeedOf(localStorage.getItem(BOOK_SPEED_KEY));
  } catch {
    return 1;
  }
}
export function storeBookSpeed(rate: number): void {
  try {
    localStorage.setItem(BOOK_SPEED_KEY, String(rate));
  } catch {
    // no storage: the speed lasts as long as the book is open
  }
}

/** the prototype's times (ms): a page turning, the pause after the title, after a page before the next turns, after the last page, the cover closing, flying away */
export const BOOK_MS = { turn: 720, afterTitle: 250, next: 1100, last: 1600, close: 650, fly: 1000 } as const;

/**
 * 〔‹〕〔›〕 (d = −1 / +1), or a page that has been read (d = +1), on page `p` of `n`: the page to turn to, 'finish' past
 * the last one, or null when there is nothing before the first.
 */
export function bookTurn(p: number, d: -1 | 1, n: number): number | 'finish' | null {
  const np = p + d;
  if (np < 0) return null;
  if (np > n - 1) return 'finish';
  return np;
}

/** where a tap on the page turns: the right edge forward (「右端からめくる」), the left edge back, the middle nothing */
export function bookTapSide(x: number, width: number): -1 | 0 | 1 {
  if (!(width > 0)) return 0;
  const k = x / width;
  if (k >= 0.66) return 1;
  if (k <= 0.22) return -1;
  return 0;
}
