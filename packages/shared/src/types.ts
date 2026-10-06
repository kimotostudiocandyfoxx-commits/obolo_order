import type { BuddyPersona, Locale } from './index';

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
  author: { id: string; handle: string; displayName: string; neoForm?: string | null };
  text: string;
  voiceUrl: string;
  voiceSource: 'recorded' | 'cloned' | 'default';
  voiceDurationSec: number | null;
  starCount: number;
  starredByMe: boolean;
  createdAt: string;
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
