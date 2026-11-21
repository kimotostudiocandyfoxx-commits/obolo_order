import { z } from 'zod';
import type { CommsPerson } from './comms';

/**
 * Venus — the radio planet (client decision 2026-11-21, docs/工房とブルーナ_設計.md §9–10).
 * A show is voice + the songs the host plays from Bluena (songs born on this platform whose maker
 * left "radio / DJ OK" on). The booth lives on Venus (the one exception to "make on the Moon").
 * Recorded shows go to Bluena's Venus folder (private) until 〔公開する〕. Live shows are voice only;
 * the picture (thumbnail + a looping motion) and the playing song travel as show data.
 * No counts anywhere (client rule): no listener numbers, no play counts.
 */

/** how the thumbnail moves while a show plays (drawn by the listener's app, no video is sent) */
export const RADIO_LOOPS = ['drift', 'ripple', 'stars', 'pulse', 'still'] as const;
export type RadioLoop = (typeof RADIO_LOOPS)[number];

/** a song that went on air: when (seconds into the show), what, by whom */
export const RadioCue = z.object({
  at: z.number().min(0).max(4 * 3600),
  songId: z.string().max(80),
  title: z.string().trim().max(60),
  by: z.string().trim().max(40),
  /** the maker (to go to their Mercury island); null for the sample songs */
  byId: z.string().uuid().nullable().optional(),
});
export type RadioCue = z.infer<typeof RadioCue>;

/** a recorded show is at most an hour (PLACEHOLDER P-RADIO-1: the length the team allows) */
export const RADIO_SHOW_MAX_SECONDS = 3600;
/** the raw recording accepted (opus/aac at ~96 kbps for an hour ≈ 45 MB) */
export const RADIO_SHOW_MAX_BYTES = 80 * 1024 * 1024;
/** a live show with no word from the host for this long is treated as ended */
export const RADIO_LIVE_STALE_SECONDS = 120;

export const CreateRadioShowBody = z.object({
  /** the recording, after POST /media/show */
  mediaId: z.string().uuid(),
  title: z.string().trim().min(1).max(40),
  /** a picture from Bluena (after POST /media/photo, or one of your Jupiter photos) */
  thumbUrl: z.string().url().max(500).nullable().optional(),
  loop: z.enum(RADIO_LOOPS).default('drift'),
  seconds: z.number().min(1).max(RADIO_SHOW_MAX_SECONDS),
  cues: z.array(RadioCue).max(200).default([]),
  /** the live show this recording came from (its recording is kept automatically) */
  liveId: z.string().uuid().optional(),
});
export type CreateRadioShowBody = z.infer<typeof CreateRadioShowBody>;

export const StartRadioLiveBody = z.object({
  title: z.string().trim().min(1).max(40),
  thumbUrl: z.string().url().max(500).nullable().optional(),
  loop: z.enum(RADIO_LOOPS).default('drift'),
});
export type StartRadioLiveBody = z.infer<typeof StartRadioLiveBody>;

/** the host tells the listeners what is playing now (null = only the voice) */
export const RadioNowBody = z.object({ now: RadioCue.omit({ at: true }).nullable() });
export type RadioNowBody = z.infer<typeof RadioNowBody>;

export const RadioMessageBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('comment'), text: z.string().trim().min(1).max(60) }),
  /** a request: one of the songs on Mercury (a planet post id) */
  z.object({ kind: z.literal('request'), postId: z.string().uuid(), text: z.string().trim().max(40).default('') }),
]);
export type RadioMessageBody = z.infer<typeof RadioMessageBody>;

export const RadioReportBody = z.object({
  target: z.enum(['show', 'live', 'message']),
  id: z.string().uuid(),
  reason: z.enum(['mean', 'scary', 'song', 'other']),
  note: z.string().trim().max(200).optional(),
});
export type RadioReportBody = z.infer<typeof RadioReportBody>;

export const RadioSongPermissionBody = z.object({ allow: z.boolean() });

/** a song the booth can load (Bluena = the DJ's USB stick) */
export type RadioDeckSong = {
  id: string;
  title: string;
  url: string;
  bpm: number | null;
  seconds: number;
  /** the maker's name as shown on air */
  by: string;
  byId: string | null;
  /** your own song / one you kept in Bluena from someone else */
  from: 'mine' | 'saved' | 'sample';
  /** your own song only: whether you let radio / DJ use it (off = it stays out of shows) */
  allowRadio?: boolean;
};

export type RadioShowView = {
  id: string;
  title: string;
  host: CommsPerson;
  thumbUrl: string | null;
  loop: RadioLoop;
  audioUrl: string;
  seconds: number;
  cues: RadioCue[];
  /** private = in your Bluena (Venus folder); public = on Venus */
  status: 'private' | 'public';
  source: 'recorded' | 'live';
  createdAt: string;
  publishedAt: string | null;
  mine: boolean;
};

export type RadioMessageView = {
  id: string;
  kind: 'comment' | 'request';
  text: string;
  /** for a request: the song asked for */
  song: { postId: string; title: string; by: string } | null;
  from: CommsPerson;
  createdAt: string;
  mine: boolean;
};

export type RadioLiveView = {
  id: string;
  title: string;
  host: CommsPerson;
  thumbUrl: string | null;
  loop: RadioLoop;
  /** live = ON AIR; ended = the host closed it; stopped = the team stopped it */
  status: 'live' | 'ended' | 'stopped';
  now: Omit<RadioCue, 'at'> | null;
  startedAt: string;
  mine: boolean;
  /**
   * who carries the voice: 'test' = the trial set-up (screens and flow only, no sound reaches
   * listeners yet — PLACEHOLDER P-RADIO-2 until the streaming service's keys are in place).
   */
  transport: 'test' | 'realtime';
};

export type RadioLiveState = RadioLiveView & { messages: RadioMessageView[] };

export type RadioHome = {
  live: RadioLiveView[];
  shows: RadioShowView[];
};
