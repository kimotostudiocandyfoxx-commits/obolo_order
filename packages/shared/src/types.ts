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
  /** 1–8 = journey day to play, 9 = payment ("ORDERになるか？"), 10 = ORDER member. */
  journeyDay: number;
  /** Set when the current day has been finished (the next unlocks 24 h later or by skipping). */
  journeyCompletedAt: string | null;
  invitedByName: string | null;
  /** OBOLO NEO form id (Day 3), null until chosen. */
  neoForm: string | null;
  createdAt: string;
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
  author: { id: string; handle: string; displayName: string };
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
