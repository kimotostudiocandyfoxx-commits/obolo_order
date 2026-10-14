/**
 * What the visitor makes on the first journey, day by day (client 2026-10-14): three kororins on Saturn
 * (day 3) → two of them become stickers on Jupiter (day 4) → one sticker becomes a song on Mercury
 * (day 5) → the song gets an MV on Mars (day 6). Each day saves its piece with the day's answers
 * ("d3.kororins", "d4.stickers", "d5.song", "d6.mv" in Me.story) and the next day picks it up.
 */
export interface StickerMade {
  /** the words (a kororin's) */
  text: string;
  /** the picture: a photo or Bati's drawing; null = words only */
  url: string | null;
}
export interface SongMade {
  id: string;
  title: string;
  url: string;
  /** the sticker's picture became the jacket */
  jacket: string | null;
  /** the sticker's words */
  words: string;
}
export interface MvMade {
  id: string;
  url: string;
  poster: string | null;
  title: string;
}
export interface Made {
  kororins?: string[];
  stickers?: StickerMade[];
  song?: SongMade;
  mv?: MvMade;
}

const parse = <T,>(raw: string | undefined): T | undefined => {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

/** From the saved days (Me.story) and today's answers (today's win). */
export function madeFrom(story: Record<string, string> | undefined, today: Record<string, string> = {}): Made {
  const s = story ?? {};
  return {
    kororins: parse<string[]>(today.kororins ?? s['d3.kororins']),
    stickers: parse<StickerMade[]>(today.stickers ?? s['d4.stickers']),
    song: parse<SongMade>(today.song ?? s['d5.song']),
    mv: parse<MvMade>(today.mv ?? s['d6.mv']),
  };
}
