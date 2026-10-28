/**
 * 〔🔒 机の引き出し〕 (L2-URANUS-S002/S003): the stories and picture books {neo} made, kept only on this device until
 * the server keeps my places. Nothing in here is sent to anyone; the shelf of my図書館 shows what is put on it.
 */
export type BookPage = { text: string; scene: string; pic?: string | null; how?: 'book' | 'bati' | 'photo' | 'words' };
export type Book = { id: string; title: string; pages: BookPage[]; cards: string[]; picture?: boolean; made: number };

export const DRAWER_KEY = 'obolo.drawer';

export function loadDrawer(): Book[] {
  try {
    return JSON.parse(localStorage.getItem(DRAWER_KEY) ?? '[]') as Book[];
  } catch {
    return [];
  }
}

export function putInDrawer(b: Book) {
  try {
    const rest = loadDrawer().filter((x) => x.id !== b.id);
    localStorage.setItem(DRAWER_KEY, JSON.stringify([...rest, b].slice(-30)));
  } catch {
    /* private mode, or too big (photos): the book still shows this time */
  }
}

export function spellbookCards(): string[] {
  try {
    const book = JSON.parse(localStorage.getItem('obolo.spellbook') ?? '[]') as string[][];
    return [...new Set(book.flat())].slice(-24);
  } catch {
    return [];
  }
}
