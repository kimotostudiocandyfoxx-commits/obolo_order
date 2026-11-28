import type { StoryFirstBookBody, StoryFirstBookView, StoryFirstGameBody, StoryFirstGameView, StoryResult } from '@obolo/shared';

/**
 * Client 2026-11-28 (docs/planets.md 09): the book of day 8 (Pluto) and the game of day 9 (Neptune) made inside the
 * story become REAL works of the member, like day 10's goods (storyGoods.ts). The server makes them free and once
 * (POST /moon/story-first/book|game: the absorbed 'storyFirst' cost, only on the journey day they belong to); the story
 * then flies them from the Moon with the Moon's own calls (flyBook / flyGame) — one work = one post, 88 hours on the
 * ダチ's homes, the homecoming report, the member's own place on Pluto / Neptune.
 *
 *  - the book: the feather pen's short story is written by the server and kept as the member's book; the picture book's
 *    pictures stay on the device (the real book has its typographic cover). Off the journey day (the eight-day journey's
 *    accounts on their days after joining: NOT_STORY_DAY) the story writes as before (writeStory, its mana asked first).
 *  - the game: the device's notes game stays the story's own toy; the real game is the catch template with the story's
 *    title and cards, made when it is published (〔公開する〕), its id remembered on the device so a replay flies the same.
 */
export const STORY_FIRST_CARDS = 8;
/** the story's cards as the server takes them (8 at most, 24 characters each) */
export const firstCards = (cards: readonly string[]): string[] =>
  cards
    .map((c) => c.trim().slice(0, 24))
    .filter(Boolean)
    .slice(0, STORY_FIRST_CARDS);

const codeOf = (e: unknown) => (e as { code?: string } | null)?.code;

export type StoryBookResult =
  /** written by the server and kept as the member's real book */
  | { at: 'real'; bookId: string; title: string; pages: { text: string; scene: string }[] }
  /** not the journey day: the story's writer of before (paid) */
  | { at: 'device'; title: string; pages: { text: string; scene: string }[] };

export interface StoryBookApi {
  storyFirstBook(body: StoryFirstBookBody): Promise<StoryFirstBookView>;
  writeStory(cards: string[]): Promise<StoryResult>;
}

/** day 8: the server writes the story's book and keeps it (free, once); off its day, the story's writer of before */
export async function writeStoryBook(api: StoryBookApi, cards: readonly string[], said?: string): Promise<StoryBookResult> {
  const c = firstCards(cards);
  if (!c.length) throw Object.assign(new Error('no cards'), { code: 'VALIDATION' });
  try {
    const r = await api.storyFirstBook({ cards: c, ...(said?.trim() ? { said: said.trim().slice(0, 400) } : {}) });
    const pages = r.pages.length ? r.pages : r.book.chapters.map((ch) => ({ text: ch.text, scene: '' }));
    return { at: 'real', bookId: r.book.id, title: r.book.title, pages };
  } catch (e) {
    if (codeOf(e) !== 'NOT_STORY_DAY') throw e;
    const r = await api.writeStory([...cards]);
    return { at: 'device', title: r.title, pages: r.pages };
  }
}

export type StoryFlightResult = { at: 'planet'; id: string } | { at: 'device'; why: 'not-real' | 'failed' };

export interface StoryFlyApi {
  flyBook(id: string, on?: boolean): Promise<{ id: string; flownAt: string | null }>;
  flyGame(id: string, on?: boolean): Promise<{ id: string; flownAt: string | null }>;
  storyFirstGame(body: StoryFirstGameBody): Promise<StoryFirstGameView>;
}

/** 〔公開する〕 on day 8: the real book flies to Pluto (a book the server did not keep stays on the device) */
export async function publishStoryBook(api: StoryFlyApi, bookId: string | null | undefined): Promise<StoryFlightResult> {
  if (!bookId) return { at: 'device', why: 'not-real' };
  try {
    await api.flyBook(bookId, true);
    return { at: 'planet', id: bookId };
  } catch {
    return { at: 'device', why: 'failed' };
  }
}

/** 〔公開する〕 on day 9: the story's game made a real game (once: `sentId` from an earlier play is flown again) and flown to Neptune */
export async function publishStoryGame(api: StoryFlyApi, game: { title: string; cards: readonly string[] } | null | undefined, sentId?: string | null): Promise<StoryFlightResult> {
  try {
    let id = sentId ?? null;
    if (!id) {
      const cards = firstCards(game?.cards ?? []);
      if (!game || !cards.length) return { at: 'device', why: 'not-real' };
      id = (await api.storyFirstGame({ cards, title: game.title.slice(0, 20) })).game.id;
    }
    await api.flyGame(id, true);
    return { at: 'planet', id };
  } catch (e) {
    return { at: 'device', why: codeOf(e) === 'NOT_STORY_DAY' ? 'not-real' : 'failed' };
  }
}

/** the screen's own note under the shelf (not a character's line). PROVISIONAL wording for the story session */
export function storyBookNote(r: StoryFlightResult | 'preview' | null): string {
  if (r === null) return '（図書館の棚に、並べています……）';
  if (r !== 'preview' && r.at === 'planet') return '（冥王星の{neo}の図書館に並びました。ダチと、推してくれている人のホームにも、88時間とどきます）';
  return '（図書館の棚と空の灯りは、いまはこの端末の中だけです。ダチには、まだ届きません）';
}
export function storyGameNote(r: StoryFlightResult | 'preview' | null): string {
  if (r === null) return '（深海の都の館に、灯りをともしています……）';
  if (r !== 'preview' && r.at === 'planet') return '（海王星の{neo}の館に灯りました。ダチと、推してくれている人のホームにも、88時間とどきます）';
  return '（深海の都の館は、いまはこの端末の中だけに灯ります。ほかの人には、まだ見えません）';
}
