import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  DACHI_CHARACTER_NAMES,
  dachiLine,
  isCharacterThread,
  kimorinDue,
  MIKIE_WELCOME,
  type DachiCharacter,
  type DachiMessageView,
  type DachiThreadView,
  type DachiWorkCard,
  type SendDachiMessageBody,
  isTalkFace,
  ruleBeats,
  type TalkFace,
} from '@obolo/shared';
import { and, desc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { dachiMessages, follows, invites, userBlocks, users } from '../db/schema';
import { MediaService } from '../media/media.service';
import { PushService } from '../push/push.service';
import { DachiService } from './dachi.service';
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
    if (!u?.dachiAt) return [];
    const [friends, inv, recent] = await Promise.all([
      this.dachi.list(userId),
      this.invitation(userId),
      this.rows(or(eq(dachiMessages.recipientId, userId), eq(dachiMessages.senderId, userId))!, 500),
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
    const view = (id: string, kind: DachiThreadView['kind'], name: string, pic: string | null): DachiThreadView => ({ id, kind, name, pic, unread: unread.has(id), lastAt: last.get(id) ?? null, ...(talk.get(id) ? { talk: talk.get(id) } : {}) });
    const out: DachiThreadView[] = [];
    const inviter = friends.find((f) => f.id === inv?.inviterId);
    if (inviter) out.push(view(inviter.id, 'dachi', inviter.displayName, inviter.pic));
    if (last.has('mikie')) out.push(view('mikie', 'mikie', DACHI_CHARACTER_NAMES.mikie, null));
    out.push(view('kimorin', 'kimorin', DACHI_CHARACTER_NAMES.kimorin, null));
    const others = friends.filter((f) => f !== inviter).map((f) => view(f.id, 'dachi', f.displayName, f.pic));
    others.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
    return [...out, ...others];
  }

  /** May `userId` use this thread? A character's: once dachi. A person's: only while you are dachi. */
  private async mustReach(userId: string, thread: string) {
    if (isCharacterThread(thread)) {
      const u = await this.journey(userId);
      if (!u?.dachiAt) throw apiError(HttpStatus.FORBIDDEN, 'NOT_DACHI', 'Not yet');
      return;
    }
    if (!UUID_RE.test(thread) || !(await this.areDachi(userId, thread))) {
      // a block looks the same as "not dachi" (the blocked person is not told)
      throw apiError(HttpStatus.FORBIDDEN, 'NOT_DACHI', 'Voice messages go only between ダチ');
    }
  }

  async messages(userId: string, thread: string): Promise<DachiMessageView[]> {
    await this.mustReach(userId, thread);
    await this.arrive(userId);
    return (await this.rows(this.where(userId, thread))).map((r) => this.toView(userId, r));
  }

  async send(userId: string, thread: string, body: SendDachiMessageBody): Promise<DachiMessageView> {
    await this.mustReach(userId, thread);
    const character = isCharacterThread(thread) ? (thread as DachiCharacter) : null;
    const base: NewRow = { senderId: userId, recipientId: character ? null : thread, character };
    let row: NewRow;
    if ('mediaId' in body) {
      const m = await this.media.getOwned(userId, body.mediaId, 'voice');
      if (!m) throw apiError(HttpStatus.NOT_FOUND, 'MEDIA_NOT_FOUND', 'Recording not found');
      // M-R234: the sender's expression rides in work_json (a voice row has no card; no new column)
      row = { ...base, kind: 'voice', audioUrl: m.url, audioMediaId: m.id, seconds: Math.round(body.seconds * 10) / 10, ...(body.face ? { workJson: { face: body.face } } : {}) };
    } else {
      row = { ...base, kind: 'work', workJson: body.face ? { ...body.work, face: body.face } : body.work };
    }
    const m = await this.insertMessage(row);
    if (!character) {
      const name = (await this.journey(userId))?.displayName || 'ダチ';
      void this.push
        .notify(thread, { title: `🎤 ${name}から、声のメッセージ`, body: 'ひらいて聞いてみよう', url: '/moon/atelier', tag: `dachi-${userId}` })
        .catch((e: unknown) => this.log.warn(`push failed: ${String(e)}`));
    }
    return this.toView(userId, m);
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
      kind: r.kind === 'work' ? 'work' : 'voice',
      // a character's voice comes from the line data (filled in when the voice is made), so no migration is needed then
      audioUrl: line ? line.voice : r.audioUrl,
      seconds: r.seconds ?? null,
      text: line?.text ?? null,
      work: r.kind === 'work' ? cardOf(r.workJson) : null,
      face: faceOf(r.workJson),
      // M-R238: a line with words gets its sentences' faces by the rules (no call: the characters' lines are fixed)
      ...(line?.text ? { faces: ruleBeats(line.text) } : {}),
      read: r.recipientId !== userId || !!r.readAt,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
