import type { GameTier } from '@obolo/shared';
import type { AtelierKind } from '@/lib/atelier/unlock';
import { FLY_READY_KINDS, KIND_HOME_PLANET, type BluenaPlanet, type BookView, type GameView, type SpellTag, type SongLyrics } from '@obolo/shared';
import type { ClipFile, RefineTarget, WorkMaterial, WorkOrigin } from '@obolo/shared';
import type { MadeSong } from '@/lib/mercury/compose';
import type { VideoReel } from './video';

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
  ref?: { /** client 2026-11-25: a book's / a game's id on the server */ bookId?: string; gameId?: string; postId?: string; rootId?: string; /** the root's photo (an MV's still, M-R253 §3) */ mediaId?: string; songId?: string; backstageId?: string; /** R13: the video's project on the server (its free changes go there) */ mvId?: string; showId?: string; demoSong?: MadeSong; style?: string; /** R17: the game tier this card was asked at (a cheap tweak that failed is offered at full) */ gameTier?: GameTier; /** a stand-in made on the review page (makers.ts makeTest) */ test?: boolean };
  flown?: boolean;
  worn?: boolean;
  /** put into Bluena (the card's edge flashes once) */
  saved?: boolean;
  /** M-R253 §1: the tries inside this work (the face's fields are the ones above); `active` = the face */
  versions?: Version[];
  active?: number;
  /** the server's record of the work (planet kinds) */
  atelierId?: string;
  /** §3: the works used as its material (shown small on the card) */
  materials?: WorkMaterial[];
  /** §5: the talk it was made in */
  origin?: WorkOrigin;
  /** §4: the slow job it is waiting for (the card counts down) */
  job?: { id: string; long: boolean };
  /** R16: the job this card was waiting for, once it was over (done, or failed: the try before is the face again): an older copy still waiting for it gives way */
  settled?: { job: string; failed?: boolean };
  /** §2: the part the try being made changes */
  target?: RefineTarget;
  /** client 2026-11-25 (本): the book as it is now (its chapters, read in the reader) */
  book?: BookView;
  /** client 2026-11-25 (ゲーム): the game on its face (played in the sandbox) */
  game?: GameView;
  /** the spell it was last cast with (a book's / a game's change edits it) */
  spell?: SpellTag[];
  /** R17: made with the secret spell (its failure says so, and offers the normal spell) */
  premium?: boolean;
  /** R13: what a video is made of (its pictures and how they move): its words after it change this, for free */
  reel?: VideoReel;
  /** R13: a song's lyrics with metatags (sung from them; its lyric sheet keeps the section labels) */
  lyrics?: SongLyrics;
  /** R13: a song changed for free — how many versions there are, what the last change did, its length now */
  tweak?: { versions: number; what?: string; seconds?: number; /** the lyrics as sung (before any cut / repeat) */ lyrics0?: SongLyrics; /** R16: the versions before this one (Bluena's viewer switches between them) */ past?: { url?: string; what?: string; lyrics?: SongLyrics }[] };
  /** R18 (君の声にする魔法): a song kept in two voices — the original and the member's own; `using` is the one heard */
  voice?: { using: 'original' | 'own'; versions: ('original' | 'own')[] };
  /** the planet it belongs to (KIND_HOME_PLANET), kept for the later 〔星へ飛ばす〕 of planets without a screen yet */
  home?: BluenaPlanet;
};

/** one try of a work */
export type Version = Pick<Work, 'prompt' | 'title' | 'text' | 'image' | 'candidates' | 'pick' | 'audio' | 'video' | 'poster' | 'source' | 'note' | 'ref' | 'reel'> & { target?: RefineTarget; at: string };

const FACE_KEYS = ['prompt', 'title', 'text', 'image', 'candidates', 'pick', 'audio', 'video', 'poster', 'source', 'note', 'ref', 'reel'] as const;

/** the face's fields as a try */
export function versionOf(w: Work, target?: RefineTarget): Version {
  const v = { at: new Date().toISOString() } as Version;
  for (const k of FACE_KEYS) if (w[k] !== undefined) (v as Record<string, unknown>)[k] = w[k];
  if (target) v.target = target;
  return v;
}

/** the tries of a work (a work made before M-R253 is its one try) */
export const versionsOf = (w: Work): Version[] => w.versions ?? (w.status === 'ready' ? [versionOf(w)] : []);

/** the work with try `i` as its face (the one looked at last) */
export function faceTo(w: Work, i: number): Work {
  const vs = versionsOf(w);
  if (!vs.length) return w;
  const k = Math.max(0, Math.min(vs.length - 1, i));
  const out: Work = { ...w, versions: vs, active: k };
  for (const key of FACE_KEYS) delete (out as Record<string, unknown>)[key];
  return { ...out, ...vs[k], prompt: vs[k].prompt ?? w.prompt } as Work;
}

/** a finished try put on top of the work (it becomes the face); `base` = the work before the redo */
export function stack(base: Work | undefined, made: Work, target?: RefineTarget): Work {
  const before = base ? versionsOf(base) : [];
  const vs = [...before, versionOf(made, target)].slice(-12);
  return { ...made, id: base?.id ?? made.id, atelierId: base?.atelierId ?? made.atelierId, materials: base?.materials ?? made.materials, origin: base?.origin ?? made.origin, versions: vs, active: vs.length - 1, job: undefined, target: undefined };
}

/** a swipe left / right among the tries: the next index (kept in range) */
export function swipeTo(i: number, dir: -1 | 1, n: number): number {
  return Math.max(0, Math.min(n - 1, i + dir));
}

export type Msg = { id: string; who: 'me'; text: string; /** Bluena's 📎: a file from the device handed over */ file?: ClipFile } | { id: string; who: 'bati'; text: string; chips?: string[]; /** a story line: the script's speaker (KIMORIN, OBOLON, コロリン …) */ speaker?: string; /** M-R236: the works {bati} found (「★がついた曲、見せて」), shown as cards */ found?: Work[]; /** M-R263: a change {bati} made (the preview card and 〔元に戻す〕) */ changed?: { id: string; from: string; to: string; undone?: boolean }; /** client 2026-11-24: a picture in the talk (a lookup's, 「〇〇の絵を見せて」) */ pic?: { url: string; title?: string; source?: string; pageUrl?: string }; /** R11: {bati}'s spell before a paid making (its talismans float over the bowl; the talk keeps a record line) and what came of it */ plan?: { kind: AtelierKind; /** the spell's tags (Japanese shown; English never) */ tags: SpellTag[]; added?: SpellTag[]; removed?: SpellTag[]; price: number; have: number | null; done?: 'yes' | 'changed' | 'short' }; /** R13: the lyrics with metatags shown (the talk keeps a record line: 「歌詞：Aメロ・サビ…」) */ lyricsRec?: SongLyrics } | { id: string; who: 'work'; work: Work };

/** the kinds that fly to a planet (〔星へ飛ばす〕) */
// client 2026-11-25: from the one shared map (KIND_HOME_PLANET); a planet without its screen yet (Pluto's books,
// Neptune's games) keeps its home as data and shows no 〔星へ飛ばす〕
export const FLIES: Partial<Record<AtelierKind, 'saturn' | 'jupiter' | 'mercury' | 'mars' | 'venus'>> = Object.fromEntries(FLY_READY_KINDS.map((k) => [k, KIND_HOME_PLANET[k]]));

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
