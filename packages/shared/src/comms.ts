import { z } from 'zod';

/**
 * Earth mail & phone (client decision 2026-10-08): opened to each member after the ¥88 ORDER,
 * between ダチ only (people who follow each other). Mail: the API checks and keeps every message,
 * Firebase delivers it in real time. Phone: the API rings / answers / ends, Agora carries the audio.
 * No counts anywhere (client rule): unread is a dot, not a number.
 */
export type CommsPerson = { id: string; handle: string; displayName: string | null; neoForm: string | null; pic: string | null };

export type CommsStatus = {
  /** a paid member (or members-only is off) */
  open: boolean;
  /** how new mail arrives: Firebase real time, or the app checks every few seconds */
  mail: 'firebase' | 'poll';
  /** who carries the call audio: Agora, or demo (rings and connects, no audio) */
  call: 'agora' | 'demo';
  /** Firebase project for the web SDK (null until Firebase is set up) */
  firebaseProjectId: string | null;
};

/** Someone found by their user ID, and how you two are connected (no counts). */
export type CommsFound = CommsPerson & { followedByMe: boolean; followsMe: boolean };

export const FollowBody = z.object({ on: z.boolean() });

export type CommsContact = CommsPerson & { lastText: string | null; lastAt: string | null; unread: boolean };

export type DmMessage = { id: string; fromMe: boolean; kind: 'text' | 'voice'; text: string; audioUrl: string | null; createdAt: string };

export const SendDmBody = z
  .object({ text: z.string().trim().max(500).default(''), audioUrl: z.string().url().max(500).optional() })
  .refine((b) => b.text.length > 0 || !!b.audioUrl, { message: 'empty message' });
export type SendDmBody = z.infer<typeof SendDmBody>;

export const StartCallBody = z.object({ to: z.string().uuid() });
export type StartCallBody = z.infer<typeof StartCallBody>;

export type CallStatus = 'ringing' | 'active' | 'declined' | 'missed' | 'ended';

/** What a phone needs to join the call's audio (null in demo mode). */
export type CallJoin = { provider: 'agora'; appId: string; channel: string; token: string; uid: number; expiresAt: string } | { provider: 'demo'; channel: string };

export type CallView = { id: string; status: CallStatus; caller: CommsPerson; callee: CommsPerson; createdAt: string; answeredAt: string | null };

/** How long a call rings before it counts as missed (seconds). PLACEHOLDER (P-COMMS-3). */
export const CALL_RING_SECONDS = 40;
