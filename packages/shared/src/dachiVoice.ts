import { z } from 'zod';
import { DELIVERY_KINDS } from './schemas';

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
/** PLACEHOLDER (P-DACHI-2): how many messages one person may send per hour / per day (all threads) */
export const DACHI_SEND_PER_HOUR = 30;
export const DACHI_SEND_PER_DAY = 120;

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
}

/** A Bluena work sent as a card: 〔ダチへ〕's delivery shape, with Bluena's folders' kinds too (art, video, radio) */
export const DACHI_WORK_KINDS = [...DELIVERY_KINDS, 'art', 'video', 'radio'] as const;
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
  kind: 'voice' | 'work';
  /** the voice (an absolute URL, or a path of the web app for a character's line); null = voice not made yet */
  audioUrl: string | null;
  seconds: number | null;
  /** the words of a character's line (shown while its voice is not made) */
  text: string | null;
  work: DachiWorkCard | null;
  createdAt: string;
}

export const SendDachiMessageBody = z.union([
  z.object({ mediaId: z.string().uuid(), seconds: z.number().positive().max(DACHI_VOICE_MAX_SECONDS + 1) }),
  z.object({ work: DachiWorkCard }),
]);
export type SendDachiMessageBody = z.infer<typeof SendDachiMessageBody>;

/** a thread id: a user id (uuid) or a character */
export const isCharacterThread = (id: string): id is DachiCharacter => (DACHI_CHARACTERS as readonly string[]).includes(id);
