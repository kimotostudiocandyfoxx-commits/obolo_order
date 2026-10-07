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
  /** Registered voices (Fish Audio): own voice (Saturn, songs) and Bati's voice. */
  voices: { self: boolean; bati: boolean };
  /** the round ぷにぷに character (null until dressed on the profile) */
  look: PuniLook | null;
  /** the painted ぷにぷに picture (AI, transparent PNG); shown instead of the code-drawn look */
  puniPic: string | null;
  createdAt: string;
}

/**
 * Day 9 "エクリプス" payment (¥88/month). `stripe`: mount Stripe Embedded Checkout with the client
 * secret, then confirm the session. `demo`: billing is not configured — confirm with /me/order.
 */
export type OrderCheckout =
  | { mode: 'stripe'; publishableKey: string; clientSecret: string; sessionId: string }
  | { mode: 'demo' };

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
export type VerifyResult =
  | { kind: 'member'; token: string; user: Me }
  | { kind: 'invited'; inviteCode: string; inviterName: string };

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
  postCount: number;
  followers: number;
  following: number;
  /** stars their posts received */
  stars: number;
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

export type SongEditAction = 'VOLUME_TEMPO_EDIT' | 'LYRICS_EDIT' | 'VOICE_REPLACE' | 'TIMING_EDIT' | 'GENRE_EDIT' | 'CHAT';

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
