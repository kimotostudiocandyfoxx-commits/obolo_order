import { HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { kimorinReply, moderateText, type ChatTurn, type LlmProvider } from '@obolo/ai';
import { CONFIG, type AppConfig } from '../config';
import { textToSpeech } from '../voice/fish.client';
import { toMp3 } from '../voice/audio';
import {
  CLIP_WORD,
  type ClipFile,
  DACHI_CHARACTER_NAMES,
  dachiLine,
  isCharacterThread,
  kimorinDue,
  MIKIE_WELCOME,
  DACHI_HISTORY_PAGE,
  historyOrder,
  historyPage,
  type DachiHistoryPage,
  type DachiHistoryRow,
  DACHI_RECENT_DAYS,
  rankDachi,
  KIMORIN_VOICE,
  speakText,
  type DachiCharacter,
  type DachiMessageView,
  type DachiThreadView,
  type DachiWorkCard,
  type SendDachiMessageBody,
  isTalkFace,
  ruleBeats,
  type TalkFace,
  isVoiceSound,
  type VoiceSound,
} from '@obolo/shared';
import { and, desc, eq, inArray, isNotNull, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { dachiMessages, follows, invites, userBlocks, users } from '../db/schema';
import { MediaService } from '../media/media.service';
import { PushService } from '../push/push.service';
import { LLM } from '../infra/tokens';
import { DachiService } from './dachi.service';
import { DachiVoiceDraftService } from './voice-draft.service';
import { talkLookOf } from '../look/talk';

type Row = typeof dachiMessages.$inferSelect;
/** M-R234: the sender's expression kept beside the card (or alone, for a voice) */
const faceOf = (j: unknown) => (j && typeof j === 'object' && isTalkFace((j as { face?: unknown }).face) ? (j as { face: TalkFace }).face : null);
const cardOf = (j: unknown): DachiWorkCard | null => {
  if (!j || typeof j !== 'object') return null;
  const { face: _face, ...card } = j as DachiWorkCard & { face?: unknown };
  return card as DachiWorkCard;
};
type NewRow = typeof dachiMessages.$inferInsert;
/** a text message's words (work_json { text }) */
/** a 📎 file's view kept with the message (work_json { file }) */
const fileOf = (j: unknown): ClipFile | null => (j && typeof j === 'object' && (j as { file?: unknown }).file && typeof (j as { file: { id?: unknown } }).file.id === 'string' ? (j as { file: ClipFile }).file : null);
const fileWords = (f: ClipFile | null) => (f ? `${CLIP_WORD[f.kind]}「${f.name}」` : 'ファイル');
const textOf = (j: unknown): string | null => (j && typeof j === 'object' && typeof (j as { text?: unknown }).text === 'string' ? (j as { text: string }).text : null);
/** client 2026-11-27: the sound mixed into a voice (work_json { sound }): the mood, and the voice alone for 〔おとをけす〕 */
const soundOf = (j: unknown): { mood: VoiceSound; plainUrl: string } | null => {
  const s = j && typeof j === 'object' ? (j as { sound?: { mood?: unknown; plainUrl?: unknown } }).sound : null;
  return s && isVoiceSound(s.mood) && typeof s.plainUrl === 'string' ? { mood: s.mood, plainUrl: s.plainUrl } : null;
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** dachi = both follow each other (2 rows), no block either way, the other is still here and not suspended */
export const reachable = (p: { follows: number; blocks: number; peerOk: boolean }) => p.follows === 2 && p.blocks === 0 && p.peerOk;

/** the first message's source: {inviter}'s voice from the invitation, or MIKIE⭐︎DRILL's welcome (in {inviter}'s thread, or her own) */
export function welcomeRow(userId: string, at: Date, inv: { inviterId: string | null; inviterIsDachi: boolean; voiceUrl: string | null; voiceMediaId: string | null; voiceSeconds: number | null } | null): NewRow {
  if (inv?.inviterId && inv.inviterIsDachi && inv.voiceUrl) {
    return { senderId: inv.inviterId, recipientId: userId, lineId: 'welcome', kind: 'voice', audioUrl: inv.voiceUrl, audioMediaId: inv.voiceMediaId, seconds: inv.voiceSeconds, createdAt: at };
  }
  return { senderId: null, recipientId: userId, character: 'mikie', peerId: inv?.inviterId && inv.inviterIsDachi ? inv.inviterId : null, lineId: MIKIE_WELCOME.id, kind: 'voice', audioUrl: MIKIE_WELCOME.voice, createdAt: at };
}

/**
 * ダチの声のメッセージ (M-R212, shared/dachiVoice.ts). Voice messages and work cards only between dachi (mutual follows,
 * nobody blocked either way, neither suspended); the story characters' lines are written into the person's threads when
 * they are read (computed on read — no cron): the welcome once dachi, KIMORIN⭐︎'s lines during the waits.
 */
@Injectable()
export class DachiVoiceService {
  private readonly log = new Logger('DachiVoice');
  constructor(
    private readonly db: Database,
    private readonly dachi: DachiService,
    private readonly media: MediaService,
    private readonly push: PushService,
    /** the text messages' check (client 2026-11-24): the same moderation as Saturn's words */
    @Optional() @Inject(LLM) private readonly llm?: LlmProvider,
    /** R9: the Fish key for KIMORIN⭐︎'s voice */
    @Optional() @Inject(CONFIG) private readonly cfg?: Pick<AppConfig, 'FISH_API_KEY' | 'FISH_MODEL'>,
    /** client 2026-11-27: the sound mixed into a voice message (the trial) */
    @Optional() private readonly mixer?: DachiVoiceDraftService,
  ) {}

  // ── small lookups (stubbed in tests) ──

  protected async journey(userId: string) {
    const [u] = await this.db.read
      .select({ journeyDay: users.journeyDay, journeyCompletedAt: users.journeyCompletedAt, dachiAt: users.dachiAt, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userId));
    return u ?? null;
  }

  /** both follow each other, nobody blocked anybody, the other is still here and not suspended */
  protected async areDachi(a: string, b: string): Promise<boolean> {
    if (a === b) return false;
    // the primary: a block or an unfollow just made must count at once
    const res = await this.db.write.execute<{ f: string; bl: string; ok: string }>(sql`SELECT
      (SELECT count(*) FROM ${follows} WHERE (follower_id = ${a} AND followee_id = ${b}) OR (follower_id = ${b} AND followee_id = ${a})) AS f,
      (SELECT count(*) FROM ${userBlocks} WHERE (blocker_id = ${a} AND blocked_id = ${b}) OR (blocker_id = ${b} AND blocked_id = ${a})) AS bl,
      (SELECT count(*) FROM ${users} WHERE id = ${b} AND deleted_at IS NULL AND suspended_at IS NULL) AS ok`);
    const r = res.rows[0];
    return reachable({ follows: Number(r?.f), blocks: Number(r?.bl), peerOk: Number(r?.ok) === 1 });
  }

  protected async invitation(userId: string) {
    const [i] = await this.db.read
      .select({ inviterId: invites.inviterUserId, voiceUrl: invites.voiceUrl, voiceMediaId: invites.voiceMediaId, voiceSeconds: invites.voiceSeconds })
      .from(invites)
      .where(and(eq(invites.acceptedUserId, userId), eq(invites.status, 'accepted')))
      .limit(1);
    return i ?? null;
  }

  protected async sentLines(userId: string): Promise<string[]> {
    const rows = await this.db.read
      .select({ lineId: dachiMessages.lineId })
      .from(dachiMessages)
      .where(and(eq(dachiMessages.recipientId, userId), isNotNull(dachiMessages.lineId)));
    return rows.map((r) => r.lineId!);
  }

  /** a prepared line, once per person (the unique index keeps a second one out) */
  protected async insertLines(rows: NewRow[]) {
    if (rows.length) await this.db.write.insert(dachiMessages).values(rows).onConflictDoNothing();
  }

  protected async insertMessage(row: NewRow): Promise<Row> {
    const [m] = await this.db.write.insert(dachiMessages).values(row).returning();
    return m;
  }

  protected async rows(where: SQL, limit = 200): Promise<Row[]> {
    const rows = await this.db.read.select().from(dachiMessages).where(and(where, isNull(dachiMessages.deletedAt))).orderBy(desc(dachiMessages.createdAt)).limit(limit);
    return rows.reverse();
  }

  // ── the story's arrivals ──

  /** D04-S005c: {name} and {inviter} are dachi now (also with no inviter: the threads appear all the same). Idempotent. */
  async markDachi(userId: string) {
    await this.db.write.update(users).set({ dachiAt: new Date() }).where(and(eq(users.id, userId), isNull(users.dachiAt)));
    await this.arrive(userId);
  }

  /** writes what has arrived by now: the welcome (once), KIMORIN⭐︎'s lines of this wait that are due */
  async arrive(userId: string, now = new Date()) {
    const u = await this.journey(userId);
    if (!u?.dachiAt) return u;
    const sent = await this.sentLines(userId);
    const rows: NewRow[] = [];
    if (!sent.includes('welcome')) {
      const inv = await this.invitation(userId);
      const inviterIsDachi = !!inv?.inviterId && (await this.areDachi(userId, inv.inviterId));
      rows.push(welcomeRow(userId, u.dachiAt, inv ? { ...inv, inviterIsDachi } : null));
    }
    for (const { line, at } of kimorinDue({ userId, journeyDay: u.journeyDay, journeyCompletedAt: u.journeyCompletedAt, dachiAt: u.dachiAt, sent, now })) {
      rows.push({ senderId: null, recipientId: userId, character: 'kimorin', lineId: line.id, kind: 'voice', audioUrl: line.voice, createdAt: at });
    }
    await this.insertLines(rows);
    return u;
  }

  // ── threads ──

  private where(userId: string, thread: string): SQL {
    const m = dachiMessages;
    if (isCharacterThread(thread)) {
      return or(
        and(isNull(m.senderId), eq(m.recipientId, userId), eq(m.character, thread), isNull(m.peerId)),
        and(eq(m.senderId, userId), isNull(m.recipientId), eq(m.character, thread)),
      )!;
    }
    return or(
      and(eq(m.senderId, userId), eq(m.recipientId, thread)),
      and(eq(m.senderId, thread), eq(m.recipientId, userId)),
      and(isNull(m.senderId), eq(m.recipientId, userId), eq(m.peerId, thread)),
    )!;
  }

  /** which thread a row is in, seen by `userId` */
  private threadOf(userId: string, r: Row): string {
    if (r.senderId === userId) return r.recipientId ?? r.character ?? '';
    if (r.senderId) return r.senderId;
    return r.peerId ?? r.character ?? '';
  }

  /** The drawer's conversations, from D04-S005c: {inviter} (or MIKIE⭐︎DRILL when there is none), KIMORIN⭐︎, then other dachi. */
  async threads(userId: string): Promise<DachiThreadView[]> {
    const u = await this.arrive(userId);
    // client 2026-11-24 (iPad, R7): KIMORIN⭐︎ is everyone's ダチ — listed before D04-S005c too (a tester who jumped days
    // never passed it, and production showed no ダチ at all); the rest comes with dachiAt as before
    if (!u?.dachiAt) {
      if (!u) return [];
      const mine = await this.rows(this.where(userId, 'kimorin'), 50);
      const week = Date.now() - DACHI_RECENT_DAYS * 86_400_000;
      return [{ id: 'kimorin', kind: 'kimorin', name: DACHI_CHARACTER_NAMES.kimorin, pic: null, unread: mine.some((r) => r.recipientId === userId && !r.readAt), lastAt: mine.at(-1)?.createdAt.toISOString() ?? null, recent: mine.filter((r) => r.createdAt.getTime() > week).length }];
    }
    const [friends, inv, recent, week] = await Promise.all([
      this.dachi.list(userId),
      this.invitation(userId),
      this.rows(or(eq(dachiMessages.recipientId, userId), eq(dachiMessages.senderId, userId))!, 500),
      this.weekCounts(userId),
    ]);
    const last = new Map<string, string>();
    const unread = new Set<string>();
    for (const r of recent) {
      const t = this.threadOf(userId, r);
      last.set(t, r.createdAt.toISOString());
      if (r.recipientId === userId && !r.readAt) unread.add(t);
    }
    // M-R232: each dachi stands in the talk in the look they made (with its expressions, once made)
    const ids = friends.map((f) => f.id);
    const talk = new Map<string, DachiThreadView['talk']>();
    if (ids.length)
      for (const r of await this.db.read.select({ id: users.id, j: users.onboardingJson, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, ids)))
        talk.set(r.id, talkLookOf((r.j ?? {}) as Record<string, string>, 'me', r.avatarUrl));
    const view = (id: string, kind: DachiThreadView['kind'], name: string, pic: string | null): DachiThreadView => ({ id, kind, name, pic, unread: unread.has(id), lastAt: last.get(id) ?? null, recent: week.get(id) ?? 0, ...(talk.get(id) ? { talk: talk.get(id) } : {}) });
    const out: DachiThreadView[] = [];
    const inviter = friends.find((f) => f.id === inv?.inviterId);
    if (inviter) out.push(view(inviter.id, 'dachi', inviter.displayName, inviter.pic));
    if (last.has('mikie')) out.push(view('mikie', 'mikie', DACHI_CHARACTER_NAMES.mikie, null));
    out.push(view('kimorin', 'kimorin', DACHI_CHARACTER_NAMES.kimorin, null));
    const others = friends.filter((f) => f !== inviter).map((f) => view(f.id, 'dachi', f.displayName, f.pic));
    // R9: ranked by the last 7 days' messages (ties: the most recent), for the Moon temple's great hall and plain
    return rankDachi([...out, ...others]);
  }

  /**
   * R9: messages exchanged in the last 7 days, per thread as `userId` sees it (both ways; a character's lines and
   * answers count for that character). One grouped query on the (recipient, created_at) / (sender, created_at) indexes.
   */
  protected async weekCounts(userId: string): Promise<Map<string, number>> {
    const since = new Date(Date.now() - DACHI_RECENT_DAYS * 86_400_000);
    const res = await this.db.read.execute<{ thread: string; n: string }>(sql`SELECT
      CASE WHEN sender_id = ${userId} THEN COALESCE(recipient_id::text, character)
           WHEN sender_id IS NOT NULL THEN sender_id::text
           ELSE COALESCE(peer_id::text, character) END AS thread,
      count(*) AS n
      FROM ${dachiMessages}
      WHERE (sender_id = ${userId} OR recipient_id = ${userId}) AND created_at > ${since} AND deleted_at IS NULL
      GROUP BY 1`);
    return new Map(res.rows.filter((r) => r.thread).map((r) => [r.thread, Number(r.n)]));
  }

  /** May `userId` use this thread? A character's: once dachi. A person's: only while you are dachi. */
  private async mustReach(userId: string, thread: string) {
    if (isCharacterThread(thread)) {
      // KIMORIN⭐︎: always (everyone's ダチ); MIKIE⭐︎DRILL's: once dachi
      if (thread === 'kimorin') return;
      const u = await this.journey(userId);
      if (!u?.dachiAt) throw apiError(HttpStatus.FORBIDDEN, 'NOT_DACHI', 'Not yet');
      return;
    }
    if (!UUID_RE.test(thread) || !(await this.areDachi(userId, thread))) {
      // a block looks the same as "not dachi" (the blocked person is not told)
      throw apiError(HttpStatus.FORBIDDEN, 'NOT_DACHI', 'Voice messages go only between ダチ');
    }
  }

  /**
   * A talk's messages, oldest first. R10: a page at a time — the newest `limit`, or the `limit` before `before` (the
   * talk asks for the older ones as it is scrolled up, with no end).
   */
  async messages(userId: string, thread: string, page: { before?: string; limit?: number } = {}): Promise<DachiMessageView[]> {
    await this.mustReach(userId, thread);
    if (!page.before) await this.arrive(userId);
    const before = page.before ? new Date(page.before) : null;
    const where = before && !Number.isNaN(before.getTime()) ? and(this.where(userId, thread), lt(dachiMessages.createdAt, before))! : this.where(userId, thread);
    return (await this.rows(where, Math.max(1, Math.min(200, page.limit ?? 200)))).map((r) => this.toView(userId, r));
  }

  /** R10: every ダチ talk, newest first, with its last message (a page at a time: `cursor` = `lastAt|id`) */
  async history(userId: string, cursor?: string | null, limit = DACHI_HISTORY_PAGE): Promise<DachiHistoryPage> {
    const all = await this.threads(userId);
    const lastRow = new Map<string, Row>();
    for (const r of await this.rows(or(eq(dachiMessages.recipientId, userId), eq(dachiMessages.senderId, userId))!, 500)) lastRow.set(this.threadOf(userId, r), r);
    const rows: DachiHistoryRow[] = all.map((t) => ({ ...t, preview: this.previewOf(userId, lastRow.get(t.id)) }));
    return historyPage(historyOrder(rows), cursor, Math.max(1, Math.min(50, limit)));
  }

  private previewOf(userId: string, r: Row | undefined): DachiHistoryRow['preview'] {
    if (!r) return null;
    const fromMe = r.senderId === userId;
    const words = (r.senderId ? null : dachiLine(r.lineId)?.text) ?? textOf(r.workJson);
    if (r.kind === 'work') return { kind: 'work', text: cardOf(r.workJson)?.title || '作品', fromMe };
    if (r.kind === 'file') return { kind: 'work', text: `📎 ${CLIP_WORD[fileOf(r.workJson)?.kind ?? 'file']}`, fromMe };
    if (r.kind === 'voice') return { kind: 'voice', text: words ?? '声のメッセージ', fromMe };
    return { kind: 'text', text: words ?? '', fromMe };
  }

  async send(userId: string, thread: string, body: SendDachiMessageBody, opts: { origin?: string; reply?: boolean; voiced?: boolean } = {}): Promise<DachiMessageView> {
    await this.mustReach(userId, thread);
    const character = isCharacterThread(thread) ? (thread as DachiCharacter) : null;
    const base: NewRow = { senderId: userId, recipientId: character ? null : thread, character };
    let row: NewRow;
    if ('mediaId' in body) {
      const m = await this.media.getOwned(userId, body.mediaId, 'voice');
      if (!m) throw apiError(HttpStatus.NOT_FOUND, 'MEDIA_NOT_FOUND', 'Recording not found');
      // M-R234: the sender's expression rides in work_json (a voice row has no card; no new column)
      // client 2026-11-27 (the trial): the voice's words as its caption — checked like typed words; the sound mixed in
      // quietly as a second file (the clean voice stays for 〔おとをけす〕). No mix (it failed, no mixer): the voice alone.
      const caption = body.caption?.trim() || null;
      if (caption && (await moderateText(caption, this.llm)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'CONTENT_FLAGGED', 'This cannot be sent');
      const mixed = body.sound && body.sound !== 'none' && this.mixer ? await this.mixer.mixFor(userId, m.id, { sound: body.sound, soft: body.soft }, opts.origin ?? '') : null;
      const json = {
        ...(body.face ? { face: body.face } : {}),
        ...(caption ? { text: caption } : {}),
        ...(mixed ? { sound: { mood: body.sound, ...(body.soft ? { soft: true } : {}), plainUrl: m.url, plainMediaId: m.id } } : {}),
      };
      row = { ...base, kind: 'voice', audioUrl: mixed?.url ?? m.url, audioMediaId: mixed?.id ?? m.id, seconds: Math.round((mixed?.seconds ?? body.seconds) * 10) / 10, ...(Object.keys(json).length ? { workJson: json } : {}) };
    } else if ('fileId' in body) {
      // Bluena's 📎: one of your own files; its id in audio_media_id (who may open it: GET /media/files/:id)
      const f = await this.media.getOwnedFile(userId, body.fileId);
      if (!f) throw apiError(HttpStatus.NOT_FOUND, 'FILE_NOT_FOUND', 'File not found');
      row = { ...base, kind: 'file', audioMediaId: f.id, seconds: f.seconds ?? null, workJson: { file: f, ...(body.face ? { face: body.face } : {}) } };
    } else if ('text' in body) {
      // client 2026-11-24: words typed in the ダチ talk — checked like Saturn's words (refused, never sent, when flagged);
      // kept in work_json { text, face } (the kind column is free text: no migration)
      if ((await moderateText(body.text, this.llm)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'CONTENT_FLAGGED', 'This cannot be sent');
      row = { ...base, kind: 'text', workJson: { text: body.text, ...(body.face ? { face: body.face } : {}) } };
    } else {
      row = { ...base, kind: 'work', workJson: body.face ? { ...body.work, face: body.face } : body.work };
    }
    const m = await this.insertMessage(row);
    if (!character) {
      const name = (await this.journey(userId))?.displayName || 'ダチ';
      const file = fileOf(row.workJson);
      const n =
        'text' in body
          ? { title: `💬 ${name}から、メッセージ`, body: body.text.length > 40 ? `${body.text.slice(0, 40)}…` : body.text }
          : file
            ? { title: `📎 ${name}から、${CLIP_WORD[file.kind]}`, body: 'ひらいて見てみよう' }
            : { title: `🎤 ${name}から、声のメッセージ`, body: 'ひらいて聞いてみよう' };
      void this.push
        .notify(thread, { ...n, url: `/moon/atelier?tab=dachi&dachi=${userId}`, tag: `dachi-${userId}` })
        .catch((e: unknown) => this.log.warn(`push failed: ${String(e)}`));
    }
    const view = this.toView(userId, m);
    // R9: KIMORIN⭐︎ answers (within the day's limit, decided by the caller); the message stands even when it cannot
    if (character === 'kimorin' && opts.reply) {
      const reply = await this.kimorinAnswer(userId, body, m, opts.origin ?? '', opts.voiced ?? true).catch((e: unknown) => (this.log.warn(`kimorin reply: ${String(e)}`), null));
      return { ...view, reply };
    }
    return view;
  }

  // ── R9: KIMORIN⭐︎ answers ──

  /** the words of a voice message (the same transcription as the mic's words elsewhere) */
  protected async transcribeVoice(userId: string, url: string): Promise<string> {
    if (!this.llm?.transcribe) return '';
    const raw = await this.media.audioByUrl(userId, url);
    if (!raw) return '';
    return (await this.llm.transcribe(await toMp3(raw), 'audio/mp3')).replace(/\s+/g, ' ').trim().slice(0, 600);
  }

  /** KIMORIN⭐︎'s voice for the words (the story's Fish model, −1 semitone, a little slower); null = text alone */
  protected async kimorinVoice(userId: string, text: string, origin: string): Promise<string | null> {
    const key = this.cfg?.FISH_API_KEY;
    if (!key) return null;
    const raw = await Promise.race([
      textToSpeech(key, this.cfg?.FISH_MODEL ?? 's2.1-pro', { text: speakText(text), referenceId: KIMORIN_VOICE.fish, prosody: { speed: KIMORIN_VOICE.speed, volume: 0 } }),
      new Promise<never>((_, no) => setTimeout(() => no(new Error('slow')), 20_000)),
    ]);
    const mp3 = KIMORIN_VOICE.semitones ? await toMp3(raw, KIMORIN_VOICE.semitones) : raw;
    return (await this.media.storeAudio(userId, 'audio/mpeg', mp3, origin)).url;
  }

  /** the turns of the KIMORIN thread so far, for the answer (the member's words, KIMORIN's words) */
  private turnOf(r: Row): ChatTurn | null {
    const text = (r.senderId ? null : dachiLine(r.lineId)?.text) ?? textOf(r.workJson);
    if (r.senderId) return { role: 'user', text: text ?? (r.kind === 'voice' ? '（声のメッセージ）' : r.kind === 'work' ? `（作品「${cardOf(r.workJson)?.title || '作品'}」）` : r.kind === 'file' ? `（${fileWords(fileOf(r.workJson))}）` : '') };
    return text ? { role: 'assistant', text } : null;
  }

  private async kimorinAnswer(userId: string, body: SendDachiMessageBody, sent: Row, origin: string, voiced = true): Promise<DachiMessageView | null> {
    if (!this.llm) return null;
    let words = '';
    if ('text' in body) words = body.text;
    else if ('mediaId' in body) {
      // the caption is the voice's words already (client 2026-11-27); else the voice itself is heard (the clean one)
      const heard = soundOf(sent.workJson)?.plainUrl ?? sent.audioUrl;
      words = body.caption?.trim() || (heard ? await this.transcribeVoice(userId, heard).catch(() => '') : '');
      if (words && (await moderateText(words, this.llm)).flagged) return null;
    } else if ('fileId' in body) words = `（${fileWords(fileOf(sent.workJson))}を送りました）`;
    else words = `（作品「${body.work.title || '作品'}」を送りました）`;
    if (!words) return null;
    const past = (await this.rows(this.where(userId, 'kimorin'), 12)).filter((r) => r.id !== sent.id).map((r) => this.turnOf(r)).filter((t): t is ChatTurn => !!t?.text);
    const name = (await this.journey(userId))?.displayName ?? '';
    const text = await kimorinReply(this.llm, { userName: name, history: [...past, { role: 'user', text: words }] });
    if (!text) return null;
    // R18: text only (no read-aloud) for a non-member at 0 mana
    const url = !voiced ? null : await this.kimorinVoice(userId, text, origin).catch((e: unknown) => (this.log.warn(`kimorin voice: ${String(e)}`), null));
    const row = await this.insertMessage({ senderId: null, recipientId: userId, character: 'kimorin', kind: url ? 'voice' : 'text', audioUrl: url, workJson: { text } });
    return this.toView(userId, row);
  }

  async markRead(userId: string, thread: string) {
    await this.db.write
      .update(dachiMessages)
      .set({ readAt: new Date() })
      .where(and(this.where(userId, thread), eq(dachiMessages.recipientId, userId), isNull(dachiMessages.readAt)));
    return { ok: true };
  }

  toView(userId: string, r: Row): DachiMessageView {
    const line = r.senderId ? undefined : dachiLine(r.lineId);
    return {
      id: r.id,
      fromMe: r.senderId === userId,
      character: r.senderId ? null : ((r.character as DachiCharacter | null) ?? null),
      kind: r.kind === 'work' ? 'work' : r.kind === 'text' ? 'text' : r.kind === 'file' ? 'file' : 'voice',
      // a character's voice comes from the line data (filled in when the voice is made), so no migration is needed then
      audioUrl: line ? line.voice : (r.audioUrl ?? null),
      seconds: r.seconds ?? null,
      text: line?.text ?? textOf(r.workJson),
      work: r.kind === 'work' ? cardOf(r.workJson) : null,
      ...(r.kind === 'file' ? { file: fileOf(r.workJson) } : {}),
      ...(r.kind === 'voice' && soundOf(r.workJson) ? { sound: soundOf(r.workJson) } : {}),
      face: faceOf(r.workJson),
      // M-R238: a line with words gets its sentences' faces by the rules (no call: the characters' lines are fixed)
      ...(line?.text ? { faces: ruleBeats(line.text) } : textOf(r.workJson) ? { faces: ruleBeats(textOf(r.workJson)!) } : {}),
      read: r.recipientId !== userId || !!r.readAt,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
