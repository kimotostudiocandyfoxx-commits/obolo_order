import { describe, expect, it, vi } from 'vitest';
import { firstCards, publishStoryBook, publishStoryGame, storyBookNote, storyGameNote, writeStoryBook, type StoryBookApi, type StoryFlyApi } from './storyFirst';

const err = (code: string) => Object.assign(new Error(code), { code });
const pages = [
  { text: 'たこ焼きが、転がった。', scene: 'a' },
  { text: '宇宙を旅した。', scene: 'b' },
];

describe('day 8 / day 9: the story’s book and game become real works (free, once), flown from the Moon', () => {
  it('the cards go to the server as it takes them (8 at most, 24 characters each, none empty)', () => {
    expect(firstCards([' 主人公：たこ焼き ', '', 'x'.repeat(30), ...Array(10).fill('星')])).toEqual(['主人公：たこ焼き', 'x'.repeat(24), ...Array(6).fill('星')]);
  });

  it('the book: written and kept by the server — never the paid writer on its day', async () => {
    const api = { storyFirstBook: vi.fn(async () => ({ book: { id: 'b1', title: 'たこ焼きの旅', chapters: [] } as never, pages, again: false })), writeStory: vi.fn() } satisfies StoryBookApi;
    expect(await writeStoryBook(api, ['たこ焼き'], ' たこ焼きの話 ')).toEqual({ at: 'real', bookId: 'b1', title: 'たこ焼きの旅', pages });
    expect(api.storyFirstBook).toHaveBeenCalledWith({ cards: ['たこ焼き'], said: 'たこ焼きの話' });
    expect(api.writeStory).not.toHaveBeenCalled();
  });
  it('the book off its day (the eight-day journey’s days after joining): the story’s writer of before; other errors are the story’s', async () => {
    const api = { storyFirstBook: vi.fn(async () => Promise.reject(err('NOT_STORY_DAY'))), writeStory: vi.fn(async () => ({ title: 't', pages })) } satisfies StoryBookApi;
    expect(await writeStoryBook(api, ['たこ焼き'])).toEqual({ at: 'device', title: 't', pages });
    const failing = { storyFirstBook: vi.fn(async () => Promise.reject(err('STORY_FAILED'))), writeStory: vi.fn() } satisfies StoryBookApi;
    await expect(writeStoryBook(failing, ['たこ焼き'])).rejects.toMatchObject({ code: 'STORY_FAILED' });
    expect(failing.writeStory).not.toHaveBeenCalled();
  });

  const fly = (over: Partial<StoryFlyApi> = {}) => {
    const a = {
      flyBook: vi.fn(async (id: string) => ({ id, flownAt: 'now' })),
      flyGame: vi.fn(async (id: string) => ({ id, flownAt: 'now' })),
      storyFirstGame: vi.fn(async () => ({ game: { id: 'g1' } as never, again: false })),
      ...over,
    };
    return a as typeof a & StoryFlyApi;
  };
  it('〔公開する〕 the book: the real one flies to Pluto; one the server did not keep stays on the device', async () => {
    const a = fly();
    expect(await publishStoryBook(a, 'b1')).toEqual({ at: 'planet', id: 'b1' });
    expect(a.flyBook).toHaveBeenCalledWith('b1', true);
    expect(await publishStoryBook(a, undefined)).toEqual({ at: 'device', why: 'not-real' });
    expect(await publishStoryBook(fly({ flyBook: vi.fn(async () => Promise.reject(err('X'))) }), 'b1')).toEqual({ at: 'device', why: 'failed' });
  });
  it('〔公開する〕 the game: made real once (its title and cards), flown to Neptune; replayed, the same game flies again', async () => {
    const a = fly();
    expect(await publishStoryGame(a, { title: '音符のゲーム', cards: ['音符'] })).toEqual({ at: 'planet', id: 'g1' });
    expect(a.storyFirstGame).toHaveBeenCalledWith({ cards: ['音符'], title: '音符のゲーム' });
    expect(a.flyGame).toHaveBeenCalledWith('g1', true);
    const b = fly();
    expect(await publishStoryGame(b, { title: '音符のゲーム', cards: ['音符'] }, 'g1')).toEqual({ at: 'planet', id: 'g1' });
    expect(b.storyFirstGame).not.toHaveBeenCalled();
    expect(await publishStoryGame(fly({ storyFirstGame: vi.fn(async () => Promise.reject(err('NOT_STORY_DAY'))) }), { title: 't', cards: ['a'] })).toEqual({ at: 'device', why: 'not-real' });
    expect(await publishStoryGame(fly(), null)).toEqual({ at: 'device', why: 'not-real' });
  });
  it('the notes say where it is: on the planet for 88 hours, or on this device only', () => {
    expect(storyBookNote({ at: 'planet', id: 'b' })).toContain('冥王星');
    expect(storyBookNote({ at: 'planet', id: 'b' })).toContain('88時間');
    expect(storyBookNote('preview')).toContain('この端末の中だけ');
    expect(storyGameNote({ at: 'planet', id: 'g' })).toContain('海王星');
    expect(storyGameNote({ at: 'device', why: 'failed' })).toContain('この端末の中だけ');
    expect(storyGameNote(null)).toContain('……');
  });
});
