/**
 * Luxury films already watched (M-R90): a film plays once — after it ends or is skipped it does not play
 * again, also when the day is resumed. Kept on this device.
 */
const KEY = 'obolo.films.v1';

function load(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export const filmWatched = (id: string) => load().includes(id);

export function markFilmWatched(id: string) {
  const s = load();
  if (s.includes(id)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify([...s, id]));
  } catch {
    /* private mode: it may play again next time */
  }
}
