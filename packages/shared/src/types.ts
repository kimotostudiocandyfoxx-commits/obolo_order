import type { BuddyPersona, Locale } from './index';
import type { SongEditCommand } from './schemas';
import type { PuniLook } from './puni';

/** API response shapes. Kept framework-free so web, api and future native shells share them. */

export interface Me {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  bio: string;
  country: string;
  locale: Locale;
  subscriptionStatus: 'none' | 'demo' | 'active' | 'past_due' | 'canceled';
  /** 1–8 = journey day to play, 9 = the Eclipse day (story + payment), 10 = ORDER member. */
  journeyDay: number;
  /** Set when the current day has been finished (the next unlocks 24 h later or by skipping). */
  journeyCompletedAt: string | null;
  invitedByName: string | null;
  /** OBOLO NEO form id (Day 3), null until chosen. */
  neoForm: string | null;
  /** Generated OBOLO NEO look (Day 3), null until chosen — falls back to the neoForm emblem. */
  avatarUrl: string | null;
  /** The visitor's Bati: egg on Day 3 (food), hatched and named on Day 4. */
  bati: BatiView | null;
  /** Day 9: when the Eclipse was paid for (null = not yet). */
  orderedAt: string | null;
  /** Registered voices (Fish Audio): own voice (Saturn, songs) and Bati's voice.
   *  `selfSings` = the recording is kept, so songs are sung in it (Seed-VC; registered before 2026-10-09 = no). */
  voices: { self: boolean; bati: boolean; selfSings?: boolean };
  /** the round ぷにぷに character (null until dressed on the profile) */
  look: PuniLook | null;
  /** the painted ぷにぷに picture (AI, transparent PNG); shown instead of the code-drawn look */
  puniPic: string | null;
  /** Jupiter: your painted butterfly (🦋 蝶を描いてもらう) */
  butterfly: string | null;
  createdAt: string;
}

/**
 * Day 9 "エクリプス" payment (¥88/month). `stripe`: mount Stripe Embedded Checkout with the client
 * secret, then confirm the session. `demo`: billing is not configured — confirm with /me/order.
 */
export type OrderCheckout = { mode: 'stripe'; publishableKey: string; clientSecret: string; sessionId: string } | { mode: 'demo' };

export interface BatiView {
  /** favourite food the egg was made from */
  food: string;
  /** set once it has hatched and been named */
  name: string | null;
  imageUrl: string | null;
}

export interface NeoLookCandidate {
  id: string;
  url: string;
}

export interface NeoLookResult {
  candidates: NeoLookCandidate[];
  /** tries left for this OBOLO NEO (3 per apprentice; ORDER members are not limited) */
  triesLeft: number;
  /** refinements left (3 per apprentice) */
  refinesLeft?: number;
}

/** Result of POST /auth/request-code: who is this email? */
export type EntryKind = 'member' | 'invited';

/** POST /auth/verify returns a session for members, or the invitation to start Day 1 for invitees. */
export type VerifyResult = { kind: 'member'; token: string; user: Me } | { kind: 'invited'; inviteCode: string; inviterName: string };

export interface InviteView {
  code: string;
  inviterName: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
}

export interface MyInviteView extends InviteView {
  email: string;
  createdAt: string;
}

export interface WalletView {
  manaBalance: number;
  earningsBalanceJpy: number;
  /** ISO date when MANA would expire if the user stays inactive (spec §3.1.1). */
  manaExpiresAt: string | null;
  recent: LedgerEntryView[];
}

export interface LedgerEntryView {
  id: string;
  ledger: 'mana' | 'earnings';
  delta: number;
  reason: string;
  createdAt: string;
}

export interface BuddyProfileView {
  buddyName: string;
  persona: BuddyPersona;
  hasMemory: boolean;
}

export interface BuddyMessageView {
  id: string;
  role: 'user' | 'buddy';
  text: string;
  createdAt: string;
}

export interface BuddyQuotaView {
  usedToday: number;
  freeDaily: number;
}

export interface BuddyChatResponse {
  userMessage: BuddyMessageView;
  reply: BuddyMessageView;
  quota: BuddyQuotaView;
}

export interface SaturnPostView {
  id: string;
  author: { id: string; handle: string; displayName: string; neoForm?: string | null; look?: PuniLook | null; pic?: string | null };
  text: string;
  voiceUrl: string;
  voiceSource: 'recorded' | 'cloned' | 'default';
  voiceDurationSec: number | null;
  starCount: number;
  starredByMe: boolean;
  createdAt: string;
  /** set on a reply: the post it answers */
  replyToId?: string | null;
  replyCount?: number;
  repostCount?: number;
  /** quote repost: the post it introduces (one level, no nesting) */
  repostOf?: SaturnPostRef | null;
  /** a photo posted with the voice (the character holds it) */
  photoUrl?: string | null;
}

/** A ひろば on Saturn's みんな map. `faces` = a few people who spoke there lately (drawn on the island). */
export interface PlazaView {
  id: string;
  name: string;
  icon: string;
  memberCount: number;
  /** voices alive there now (88 hours) */
  voiceCount: number;
  joined: boolean;
  faces: { id: string; neoForm?: string | null; look?: PuniLook | null; pic?: string | null }[];
}

/** A short form of a post, embedded in a quote repost. */
export interface SaturnPostRef {
  id: string;
  author: { id: string; handle: string; displayName: string; neoForm?: string | null; look?: PuniLook | null; pic?: string | null };
  text: string;
  voiceUrl: string;
}

/** Someone's Saturn page. */
export interface SaturnProfileView {
  user: { id: string; handle: string; displayName: string; neoForm?: string | null; bio: string; look?: PuniLook | null; pic?: string | null };
  // no counts on anyone's page (client rule 2026-10-07: no followers, following, friends or stars received)
  followedByMe: boolean;
  isMe: boolean;
}

export interface Paged<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

/**
 * Mercury 作曲 (client decision 2026-10-06): the partner (KIMORIN / Bati) talks with the visitor,
 * then an LLM designs the song. The design is the blueprint for the instrumental (MusicGen) and the
 * vocal (DiffSinger): lyrics in kana, chords, tempo and a melody of one note per mora.
 */
export interface SongNote {
  /** one mora in hiragana ("きょ", "ん", "っ"); '' = rest */
  kana: string;
  /** MIDI note number; null for a rest */
  midi: number | null;
  beats: number;
}

export interface SongLine {
  text: string;
  kana: string;
  notes: SongNote[];
}

export interface SongSection {
  name: 'verse' | 'chorus' | 'bridge';
  lines: SongLine[];
}

export interface SongDesign {
  title: string;
  emoji: string;
  genre: string;
  mood: string;
  bpm: number;
  /** pitch class of the key, 0 = C … 11 = B */
  keyRoot: number;
  scale: 'major' | 'minor';
  /** chord loop as scale degrees (0 = I) and as names for display */
  progression: number[];
  chords: string[];
  sections: SongSection[];
  /** English prompt for the instrumental generator (no vocals) */
  instrumentalPrompt: string;
  /** the partner's line when handing the song over */
  comment: string;
  /** length of one pass through all sections */
  seconds: number;
}

export interface ComposeChatResult {
  reply: string;
  /** enough was said to make a song: show the genre buttons */
  ready: boolean;
}

export interface InstrumentalResult {
  url: string;
  seconds: number;
}

/** How the song is sung (chosen by the LLM from the song design; sent to Fish as tags / prosody). */
export interface SingDirection {
  /** tags for the whole song, e.g. ["bright"] (after [singing]) */
  style: string[];
  /** tags at the start of each section, e.g. chorus: ["pitch_up", "energetic"] */
  sections: { name: 'verse' | 'chorus' | 'bridge'; tags: string[] }[];
  /** Fish prosody.speed (0.5–2.0) */
  speed: number;
  /** Fish prosody.volume in dB */
  volume: number;
  /** a [breath] after every n lines (0 = none) */
  breathEvery: number;
}

/** One sung lyric line: its own vocal file, so a single line can be re-sung or moved. */
export interface SongPhrase {
  index: number;
  section: 'verse' | 'chorus' | 'bridge';
  text: string;
  /** which registered voice sings it (self = own voice, bati = Bati's voice) */
  slot: 'self' | 'bati';
  url: string;
  /** length of the vocal file */
  seconds: number;
  /** where the line starts in the design (beats from the top) and how long its slot is */
  startBeat: number;
  beats: number;
}

/** How the stored parts are put together (changing these costs no AI call). */
export interface SongMix {
  /** whole-song speed (pitch kept), 0.8–1.25 */
  tempo: number;
  /** gain in dB added to the vocal / the instrumental */
  vocalDb: number;
  bgmDb: number;
  /** the vocal comes in this many beats later */
  delayBeats: number;
  /** extra silence (seconds) after phrase i, pushing the later lines back */
  gaps: number[];
}

export interface SongView {
  id: string;
  title: string;
  /** the finished song (vocal + instrumental) */
  url: string;
  instrumentalUrl: string;
  instrumentalPrompt: string;
  bpm: number;
  phrases: SongPhrase[];
  mix: SongMix;
  direction: SingDirection;
  seconds: number;
  savedAt: string | null;
}

export type SongEditAction = 'VOLUME_TEMPO_EDIT' | 'LYRICS_EDIT' | 'VOICE_REPLACE' | 'TIMING_EDIT' | 'GENRE_EDIT' | 'SONG_EXTEND' | 'CHAT';

export interface SongEditResult {
  /** the partner's answer in the chat */
  reply: string;
  action: SongEditAction;
  song: SongView;
  /** the GPU studio is starting: send `command` again once it is ready */
  pending?: 'MUSIC_WARMING';
  command?: SongEditCommand;
}

export interface PuniPicResult {
  candidates: { id: string; url: string }[];
  /** tries left today */
  left: number;
}

// --- Jupiter (パタパタ, docs/jupiter.md) ------------------------------------------------------------

/** Someone on Jupiter: how their butterfly is drawn. */
export interface JupiterAuthor {
  id: string;
  handle: string;
  displayName: string;
  neoForm?: string | null;
  /** painted butterfly (🦋 蝶を描いてもらう) */
  butterfly?: string | null;
  /** their Saturn character, shown with wings when there is no painted butterfly */
  pic?: string | null;
}

/** A private 根っこ item: everything you add lands here first. */
export interface JupiterRootView {
  id: string;
  kind: 'photo' | 'video';
  url: string;
  posterUrl: string | null;
  createdAt: string;
}

export interface JupiterPostView {
  id: string;
  author: JupiterAuthor;
  kind: 'photo' | 'video';
  url: string;
  posterUrl: string | null;
  text: string;
  filter: string;
  /** branch slot 0–3 on the owner's tree */
  branch: number;
  starCount: number;
  starredByMe: boolean;
  createdAt: string;
  replyCount: number;
  /** the latest few who replied (their butterflies are shown on the sticker) */
  repliers: JupiterAuthor[];
}

/** A reply to a Jupiter post (words, spoken or typed). */
export interface JupiterReplyView {
  id: string;
  author: JupiterAuthor;
  text: string;
  createdAt: string;
}

/** One butterfly in the sky: a person and their posts of the last 88 hours (newest first). */
export interface JupiterFlyer {
  author: JupiterAuthor;
  posts: JupiterPostView[];
}

/** Someone's tree (profile). */
export interface JupiterTreeView {
  author: JupiterAuthor;
  /** the four branch names (signs on the tree) */
  branches: string[];
  /** posts that finished flying (older than 88 hours), newest first */
  leaves: JupiterPostView[];
  /** still flying */
  flying: JupiterPostView[];
  // no counts (client rule 2026-10-07): no fruits / friends numbers
  followedByMe: boolean;
  isMe: boolean;
}

// --- Mars ---------------------------------------------------------------------------------------------

/** A video in your 裏スタジオ (private): every video you keep lives on Mars. */
export interface MarsBackstageVideo {
  id: string;
  url: string;
  posterUrl: string | null;
  seconds: number | null;
  title: string;
  createdAt: string;
}

// --- Mercury & Mars timelines (client decision 2026-10-07: they work like Saturn / Jupiter) ---------

export type TimelinePlanet = 'mercury' | 'mars';

/** Someone on Mercury / Mars: their picture (Saturn character) or NEO form. */
export interface PlanetAuthor {
  id: string;
  handle: string;
  displayName: string;
  neoForm?: string | null;
  pic?: string | null;
}

/**
 * A post on Mercury (a song: round) or Mars (a movie: square). It sails / flies on the
 * timelines for 88 hours, then stays on the owner's island / studio. No counts are sent
 * (client rule 2026-10-07): only whether you starred it and who answered lately.
 */
export interface PlanetPostView {
  id: string;
  planet: TimelinePlanet;
  author: PlanetAuthor;
  kind: 'song' | 'video';
  title: string;
  text: string;
  url: string;
  posterUrl: string | null;
  seconds: number | null;
  starredByMe: boolean;
  repliers: PlanetAuthor[];
  createdAt: string;
}

export interface PlanetFlyer {
  author: PlanetAuthor;
  posts: PlanetPostView[];
}

/** An island (Mercury) / studio (Mars): still sailing / flying, and what stays there. */
export interface PlanetProfileView {
  author: PlanetAuthor;
  flying: PlanetPostView[];
  works: PlanetPostView[];
  followedByMe: boolean;
  isMe: boolean;
}

export interface PlanetReplyView {
  id: string;
  author: PlanetAuthor;
  text: string;
  createdAt: string;
}
