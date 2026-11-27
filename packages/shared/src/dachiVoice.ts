import { z } from 'zod';
import { DELIVERY_KINDS } from './schemas';
import { TALK_FACES, type TalkBeat, type TalkFace, type TalkLook } from './talk';
import type { ClipFile } from './clip';
import { VOICE_SOUNDS, type VoiceSound } from './voiceSound';
import type { CuteVoiceMiss } from './cuteVoice';

/**
 * ダチの声のメッセージ (client decision M-R212). After {name} becomes dachi with {inviter} on Saturn (day 3,
 * D04-S005c), the threads with {inviter} and KIMORIN⭐︎ are listed in the atelier's left drawer under {bati}.
 * One voice message from {inviter} is waiting: the voice they recorded when they issued the invitation. If they
 * recorded none, MIKIE⭐︎DRILL's welcome is played in its place; with no inviter at all (an operator invitation)
 * it comes in a thread of MIKIE⭐︎DRILL's own. Messages are voice (held mic, ≤ 60 s) or a Bluena work as a card,
 * and go only between dachi (mutual follows, nobody blocked). Calls are a later members' feature.
 *
 * KIMORIN⭐︎ (no account) sends a short voice line now and then during each day's 24 h wait (M-R214): computed on
 * read from the journey (no cron), at most two per wait, each line once, never as a reminder.
 */

/** longest voice message (seconds); the recorder stops itself here */
export const DACHI_VOICE_MAX_SECONDS = 60;
/** client 2026-11-24: the longest text message in a ダチ talk (characters) */
export const DACHI_TEXT_MAX = 300;
/** PLACEHOLDER (P-DACHI-2): how many messages one person may send per hour / per day (all threads) */
export const DACHI_SEND_PER_HOUR = 30;
/** R18: a hard ceiling against abuse for everyone (the soft caps are DACHI_DAILY_CAP_FREE for non-members, none for members) */
export const DACHI_SEND_PER_DAY = 1000;

/** The story characters who have a thread (no account behind them) */
export const DACHI_CHARACTERS = ['kimorin', 'mikie'] as const;
export type DachiCharacter = (typeof DACHI_CHARACTERS)[number];
export const DACHI_CHARACTER_NAMES: Record<DachiCharacter, string> = { kimorin: 'KIMORIN⭐︎', mikie: 'MIKIE⭐︎DRILL' };

/** A line a character says in a thread. `voice` = the generated voice file under the web app (null until made). */
export interface DachiLine {
  id: string;
  who: DachiCharacter;
  text: string;
  voice: string | null;
  /** KIMORIN⭐︎'s wait lines: the journey day whose wait (that night) it belongs to */
  day?: number;
}

/**
 * MIKIE⭐︎DRILL's welcome when {inviter} recorded no voice, or there is no inviter (story D04-S005c, word for word).
 * VOICE PENDING (docs/placeholders.md P-DACHI-1): no MIKIE⭐︎DRILL voice exists yet — the text is shown until then.
 */
export const MIKIE_WELCOME: DachiLine = { id: 'welcome', who: 'mikie', text: 'ようこそ。……あなたのつぶやき、聞こえたわよ。', voice: null };

/**
 * KIMORIN⭐︎'s voice messages during the waits (client M-R214, word for word — keep the punctuation).
 * VOICES PENDING (docs/placeholders.md P-DACHI-3): to be generated with KIMORIN's voice (design/story-voices.json),
 * then `voice` filled with the file's path (e.g. /story/voices/dachi/k1.mp3).
 */
export const KIMORIN_WAIT_LINES: readonly DachiLine[] = [
  { id: 'k1', who: 'kimorin', day: 3, voice: null, text: '……あの結社、まだ怪しいと思っています。念のため、言っておきます。' },
  { id: 'k2', who: 'kimorin', day: 3, voice: null, text: 'さっきのサイファー、私のコロリンが、いちばん、いい声でしたね。' },
  { id: 'k3', who: 'kimorin', day: 4, voice: null, text: '蝶が、私の部屋の窓の外まで、ついてきました。……ついてきた気がします。' },
  { id: 'k4', who: 'kimorin', day: 4, voice: null, text: '母に、結社の話をしました。……なぜか、母の方が、詳しかったです。' },
  { id: 'k5', who: 'kimorin', day: 5, voice: null, text: '私の曲、また聴いてしまいました。……三回。いえ、四回。' },
  { id: 'k6', who: 'kimorin', day: 5, voice: null, text: '島に、また何か、生えていませんか？　私のには、生えていました。' },
  { id: 'k7', who: 'kimorin', day: 6, voice: null, text: '明日は、金星。……電子レンジの次は、何でしょうね。私の推理では、、、言いません。' },
  { id: 'k8', who: 'kimorin', day: 7, voice: null, text: '……明日で、旅が終わるそうですね。……いえ、べつに、さみしくは、ありません。' },
];

export function dachiLine(id: string | null | undefined): DachiLine | undefined {
  if (!id) return undefined;
  return id === MIKIE_WELCOME.id ? MIKIE_WELCOME : KIMORIN_WAIT_LINES.find((l) => l.id === id);
}

/**
 * Client 2026-11-24 (R9): KIMORIN⭐︎ answers in the ダチ talk (the server, as KIMORIN, through the chat provider) and
 * speaks it in the story's KIMORIN voice: the Fish voice model the story lines are made with (design/story-voices.json
 * chosen.KIMORIN: cloned from the recording, −1 semitone, tempo 0.85). Text alone when no voice can be made.
 */
export const KIMORIN_VOICE = { fish: '84b27f575dba40e4bc7cabe20ac11b0f', semitones: -1, speed: 0.85 } as const;
/** PLACEHOLDER: how many answers KIMORIN⭐︎ gives one person a day (like {bati}'s read-aloud limit) */
export const KIMORIN_REPLIES_PER_DAY = 60;

/** at most this many KIMORIN⭐︎ lines per wait */
export const KIMORIN_PER_WAIT = 2;
const HOUR = 3600_000;
const MIN = 60_000;
/** PLACEHOLDER (P-DACHI-4): "night" is read in Japan time (UTC+9), 20:00–23:30 */
const JST = 9 * HOUR;
const NIGHT_FROM = 20 * HOUR;
const NIGHT_TO = 23.5 * HOUR;

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h;
}

/** the first moment from `t` that falls in the night (JST 20:00–23:30), plus a little of this person's own jitter */
function nextNight(t: number, jitter: number): number {
  const day = Math.floor((t + JST) / (24 * HOUR)) * 24 * HOUR - JST; // JST midnight before t
  const into = t - day;
  if (into >= NIGHT_FROM && into < NIGHT_TO) return t;
  return (into < NIGHT_FROM ? day : day + 24 * HOUR) + NIGHT_FROM + jitter;
}

/**
 * When KIMORIN⭐︎'s lines of one wait arrive, deterministic for the person: the first in the first night after the
 * day was finished (≥ 30 min after), the second 60–100 min later. Both always fall inside the 24 h wait.
 */
export function kimorinSchedule(userId: string, day: number, completedAt: Date): { line: DachiLine; at: Date }[] {
  const lines = KIMORIN_WAIT_LINES.filter((l) => l.day === day).slice(0, KIMORIN_PER_WAIT);
  const h = hash(`${userId}:${day}`);
  const first = nextNight(completedAt.getTime() + 30 * MIN, (h % 40) * MIN);
  const second = first + (60 + ((h >>> 8) % 41)) * MIN;
  return lines.map((line, k) => ({ line, at: new Date(k === 0 ? first : second) }));
}

/**
 * The KIMORIN⭐︎ lines that are due now and not yet sent: only once dachi (dachiAt), only while waiting after a day
 * (journeyCompletedAt set), only that day's lines, each line once (`sent` = the line ids already in the thread).
 */
export function kimorinDue(p: { userId: string; journeyDay: number; journeyCompletedAt: Date | null; dachiAt: Date | null; sent: Iterable<string>; now?: Date }): { line: DachiLine; at: Date }[] {
  if (!p.dachiAt || !p.journeyCompletedAt) return [];
  const now = (p.now ?? new Date()).getTime();
  const sent = new Set(p.sent);
  const dachiAt = p.dachiAt.getTime();
  return kimorinSchedule(p.userId, p.journeyDay, p.journeyCompletedAt).filter(({ line, at }) => !sent.has(line.id) && at.getTime() <= now && at.getTime() >= dachiAt);
}

// --- views & bodies ------------------------------------------------------------------------------------------

/** One conversation in the drawer: a dachi (their user id) or a character ('kimorin' | 'mikie'). */
export interface DachiThreadView {
  id: string;
  kind: 'dachi' | DachiCharacter;
  name: string;
  pic: string | null;
  /** something arrived that you have not heard yet (a dot, never a number) */
  unread: boolean;
  lastAt: string | null;
  /** M-R232: the dachi's own look in the talk (made when they decided it); characters use their story art */
  talk?: TalkLook | null;
  /** R9 (the Moon temple's zones): messages exchanged with this ダチ in the last 7 days, both ways (KIMORIN's too) */
  recent?: number;
}

/**
 * R9 (client): the Moon temple as one place — the ダチ you talk with most stroll in the great hall (at most
 * DACHI_HALL_MAX), everyone else wanders on the plain outside. Ranked by the messages of the last 7 days (both ways),
 * ties to the most recent message; KIMORIN⭐︎ is ranked like anyone (it takes no place ahead of a ダチ who talked more).
 */
export const DACHI_HALL_MAX = 8;
export const DACHI_RECENT_DAYS = 7;
export function rankDachi<T extends { recent?: number; lastAt?: string | null }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => (b.recent ?? 0) - (a.recent ?? 0) || (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
}
/** R10: the ダチ talks as a chat app lists them — newest first, with what was said last */
export interface DachiHistoryRow extends DachiThreadView {
  /** the last message: words, 🎤 a voice, ✦ a work (null = nothing yet) */
  preview: { kind: 'text' | 'voice' | 'work'; text: string; fromMe: boolean } | null;
}
export interface DachiHistoryPage {
  items: DachiHistoryRow[];
  /** the cursor for the next page (null = the end) */
  next: string | null;
}
/** R10: a ダチ talk's messages come a page at a time (older ones as the talk is scrolled up) */
export const DACHI_PAGE = 50;
export const DACHI_HISTORY_PAGE = 20;
/** newest first; ties by id (a stable cursor `lastAt|id`) */
export function historyOrder<T extends { id: string; lastAt: string | null }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? '') || a.id.localeCompare(b.id));
}
/** one page after `cursor` (`lastAt|id` of the last row seen) */
export function historyPage<T extends { id: string; lastAt: string | null }>(ordered: readonly T[], cursor: string | null | undefined, limit = DACHI_HISTORY_PAGE): { items: T[]; next: string | null } {
  let from = 0;
  if (cursor) {
    const i = ordered.findIndex((t) => `${t.lastAt ?? ''}|${t.id}` === cursor);
    from = i >= 0 ? i + 1 : ordered.length;
  }
  const items = ordered.slice(from, from + limit);
  const last = items.at(-1);
  return { items, next: from + limit < ordered.length && last ? `${last.lastAt ?? ''}|${last.id}` : null };
}

/** the great hall (the top DACHI_HALL_MAX) and the plain (the rest), in rank order */
export function dachiZones<T extends { recent?: number; lastAt?: string | null }>(list: readonly T[], max = DACHI_HALL_MAX): { hall: T[]; outside: T[] } {
  const r = rankDachi(list);
  return { hall: r.slice(0, max), outside: r.slice(max) };
}

/** A Bluena work sent as a card: 〔ダチへ〕's delivery shape, with Bluena's folders' kinds too (art, video, radio) */
export const DACHI_WORK_KINDS = [...DELIVERY_KINDS, 'art', 'video', 'radio', 'game'] as const;
export type DachiWorkKind = (typeof DACHI_WORK_KINDS)[number];
export const DachiWorkCard = z.object({
  kind: z.enum(DACHI_WORK_KINDS),
  title: z.string().trim().max(60).default(''),
  text: z.string().trim().max(200).default(''),
  /** the sound / picture / film of the work */
  url: z.string().url().max(2000).optional(),
  posterUrl: z.string().url().max(2000).optional(),
  /** the work's own id where it has one */
  refId: z.string().uuid().optional(),
});
export type DachiWorkCard = z.infer<typeof DachiWorkCard>;

export interface DachiMessageView {
  id: string;
  fromMe: boolean;
  /** a character spoke it (MIKIE⭐︎DRILL's welcome in {inviter}'s thread, KIMORIN⭐︎'s lines) */
  character: DachiCharacter | null;
  /** client 2026-11-24: 'text' — words typed in the ダチ talk (in `text`); 'file' — a 📎 file from the device (in `file`) */
  kind: 'voice' | 'work' | 'text' | 'file';
  /** the voice (an absolute URL, or a path of the web app for a character's line); null = voice not made yet */
  audioUrl: string | null;
  seconds: number | null;
  /** the words of a character's line (shown while its voice is not made), or of a text message */
  text: string | null;
  work: DachiWorkCard | null;
  /**
   * client 2026-11-27 (voiceSound.ts): this voice has a quiet sound mixed in (`audioUrl`); `plainUrl` is the voice
   * alone, for 〔おとをけす〕
   */
  sound?: { mood: VoiceSound; plainUrl: string } | null;
  /** a 📎 file (a picture, a film, a sound, a document); opened through GET /media/files/:id */
  file?: ClipFile | null;
  /** M-R234: the sender's expression, decided when it was sent */
  face?: TalkFace | null;
  /** M-R238: the words' expressions, sentence by sentence (a character's line, a message with words) */
  faces?: TalkBeat[];
  /** M-R239: heard already (yours always are): opening the thread plays the last heard one and every unheard one */
  read?: boolean;
  createdAt: string;
  /** R9: KIMORIN⭐︎'s answer to the message just sent (POST to the KIMORIN thread only) */
  reply?: DachiMessageView | null;
  /**
   * client 2026-11-27 (cuteVoice.ts; only on the answer to the send): the words were asked for in the cute voice —
   * `mana` taken for it, or `miss` why they went as words only (a calm line, never an error)
   */
  cute?: { mana: number } | { miss: CuteVoiceMiss };
}

/** M-R234: the sender's expression with the message */
const SendFace = z.enum(TALK_FACES).optional();
export const SendDachiMessageBody = z.union([
  z.object({
    mediaId: z.string().uuid(),
    seconds: z.number().positive().max(DACHI_VOICE_MAX_SECONDS + 1),
    face: SendFace,
    // client 2026-11-27 (the trial, voiceSound.ts): the voice's words as its caption (the member may have touched them
    // up), and the sound mixed in quietly (`soft`: the weakest うれしい); left out = the voice as it is
    caption: z.string().trim().max(DACHI_TEXT_MAX).optional(),
    sound: z.enum(VOICE_SOUNDS).optional(),
    soft: z.boolean().optional(),
  }),
  z.object({ work: DachiWorkCard, face: SendFace }),
  // client 2026-11-24: words typed in the ダチ talk (the small keyboard beside the mic)
  // client 2026-11-27 (cuteVoice.ts): `spoken` — a member who is not recorded asks for the words to be read by the
  // default cute voice (mana; with none, or when it cannot be made, the words go alone). Ignored for everyone else.
  z.object({ text: z.string().trim().min(1).max(DACHI_TEXT_MAX), face: SendFace, spoken: z.boolean().optional() }),
  // Bluena's 📎: one of your own files (POST /media/files …/done), sent into the talk
  z.object({ fileId: z.string().uuid(), face: SendFace }),
]);
export type SendDachiMessageBody = z.infer<typeof SendDachiMessageBody>;

/** a thread id: a user id (uuid) or a character */
export const isCharacterThread = (id: string): id is DachiCharacter => (DACHI_CHARACTERS as readonly string[]).includes(id);

/** client 2026-11-27: a recording made ready to send (POST /dachi/voice): in the member's voice settings, heard as words */
export interface DachiVoiceDraft {
  /** the cleaned voice (the member's own media, kind 'voice') */
  mediaId: string;
  url: string;
  /** its length now (the recording in the member's voice settings: the silences cut, faster — voiceTune.ts) */
  seconds: number;
  /** the words heard ('' when none could be heard) */
  text: string;
  /** the sound picked from the words */
  sound: VoiceSound;
  soft: boolean;
}
export const VoicePreviewBody = z.object({ mediaId: z.string().uuid(), sound: z.enum(VOICE_SOUNDS), soft: z.boolean().optional() });
export type VoicePreviewBody = z.infer<typeof VoicePreviewBody>;
