import type { AtelierKind } from '@/lib/atelier/unlock';
import type { MadeSong } from '@/lib/mercury/compose';

/**
 * One thing made in the Moon atelier's chat (M-R210/M-R211): it shows as a card in the talk and is put into Bluena
 * the moment it appears (no 〔しまう〕). Where it lives depends on the kind — the planets' own stores, so the planet's
 * 「自分の場所」 shows the same item (no copy): コロリン = a room-only Saturn post, アート = a Jupiter root, 曲 = a saved
 * song, 映像 = the Mars backstage, ラジオ = a private radio show. Your look, {bati}'s dress-ups, lookups and pictures are
 * kept on this device (Bluena's own folders; see shelf.ts).
 */
export type Work = {
  id: string;
  kind: AtelierKind;
  /** the words it was made from (a refinement adds to them) */
  prompt: string;
  status: 'making' | 'ready' | 'failed' | 'record';
  title?: string;
  text?: string;
  image?: string;
  candidates?: { id: string; url: string }[];
  pick?: string;
  audio?: string;
  video?: string;
  poster?: string | null;
  source?: { title: string; source: string; pageUrl: string };
  note?: string;
  ref?: { postId?: string; rootId?: string; songId?: string; backstageId?: string; showId?: string; demoSong?: MadeSong; style?: string };
  flown?: boolean;
  worn?: boolean;
  /** put into Bluena (the card's edge flashes once) */
  saved?: boolean;
};

export type Msg = { id: string; who: 'me'; text: string } | { id: string; who: 'bati'; text: string; chips?: string[] } | { id: string; who: 'work'; work: Work };

/** the kinds that fly to a planet (〔星へ飛ばす〕) */
export const FLIES: Partial<Record<AtelierKind, 'saturn' | 'jupiter' | 'mercury' | 'mars' | 'venus'>> = {
  voice: 'saturn',
  art: 'jupiter',
  song: 'mercury',
  video: 'mars',
  radio: 'venus',
};

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
