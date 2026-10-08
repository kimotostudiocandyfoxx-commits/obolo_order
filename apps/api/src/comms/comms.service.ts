import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { LlmProvider, moderateText } from '@obolo/ai';
import { CALL_RING_SECONDS, type CallJoin, type CallView, type CommsContact, type CommsFound, type CommsPerson, type CommsStatus, type DmMessage, type SendDmBody } from '@obolo/shared';
import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { callSessions, dmMessages, follows, users } from '../db/schema';
import { LLM } from '../infra/tokens';
import { makeCallProvider, makeMailRealtime, pairKey, type CallProvider, type MailRealtime } from './providers';

const personCols = { id: users.id, handle: users.handle, displayName: users.displayName, neoForm: users.neoForm, pic: users.puniPicUrl };
type CallRow = typeof callSessions.$inferSelect;

/** Agora wants a 32-bit number per person: taken from the user id (two people per channel). */
const agoraUid = (userId: string) => (parseInt(userId.replace(/-/g, '').slice(0, 8), 16) % 0x7fffffff) || 1;

/**
 * Earth mail & phone (client decision 2026-10-08): for members (after the ¥88 ORDER), between
 * ダチ only (people who follow each other — PLACEHOLDER P-COMMS-2). Every message is moderated and
 * kept here; Firebase (when set up) only delivers it in real time. Calls ring and are answered
 * here; Agora (when set up) carries the audio. No counts are ever sent.
 */
@Injectable()
export class CommsService {
  private readonly log = new Logger('Comms');
  private readonly calls: CallProvider;
  private readonly mail: MailRealtime;

  constructor(
    private readonly db: Database,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(LLM) private readonly llm: LlmProvider,
  ) {
    this.calls = makeCallProvider(cfg);
    this.mail = makeMailRealtime(cfg);
  }

  private async isMember(userId: string) {
    if (!this.cfg.COMMS_MEMBERS_ONLY) return true;
    const [u] = await this.db.read.select({ orderedAt: users.orderedAt, status: users.subscriptionStatus }).from(users).where(eq(users.id, userId));
    return !!u && (!!u.orderedAt || u.status === 'active');
  }

  private async mustBeMember(userId: string) {
    if (!(await this.isMember(userId))) throw apiError(HttpStatus.FORBIDDEN, 'NOT_MEMBER', 'Mail and phone open after you join ORDER');
  }

  private async areFriends(a: string, b: string) {
    const rows = await this.db.read
      .select({ n: sql<number>`count(*)` })
      .from(follows)
      .where(or(and(eq(follows.followerId, a), eq(follows.followeeId, b)), and(eq(follows.followerId, b), eq(follows.followeeId, a))));
    return Number(rows[0]?.n ?? 0) === 2;
  }

  /** Both are members and ダチ: they may write to and call each other. */
  private async mustReach(userId: string, peerId: string) {
    await this.mustBeMember(userId);
    if (userId === peerId) throw apiError(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', 'That is you');
    if (!(await this.areFriends(userId, peerId))) throw apiError(HttpStatus.FORBIDDEN, 'NOT_FRIENDS', 'Only ダチ (people who follow each other) can write and call');
    if (!(await this.isMember(peerId))) throw apiError(HttpStatus.FORBIDDEN, 'PEER_NOT_MEMBER', 'They have not joined ORDER yet');
  }

  private async relation(userId: string, other: CommsPerson): Promise<CommsFound> {
    const rows = await this.db.read
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(or(and(eq(follows.followerId, userId), eq(follows.followeeId, other.id)), and(eq(follows.followerId, other.id), eq(follows.followeeId, userId))));
    return { ...other, followedByMe: rows.some((r) => r.followerId === userId), followsMe: rows.some((r) => r.followerId === other.id) };
  }

  /** Find someone by their exact user ID (to become ダチ from the mail / phone screens). */
  async find(userId: string, handle: string): Promise<CommsFound | null> {
    const h = handle.trim().replace(/^@/, '').toLowerCase();
    if (!h) return null;
    const [u] = await this.db.read
      .select(personCols)
      .from(users)
      .where(and(sql`lower(${users.handle}) = ${h}`, isNull(users.deletedAt)));
    if (!u || u.id === userId) return null;
    return this.relation(userId, u);
  }

  async follow(userId: string, otherId: string, on: boolean): Promise<CommsFound> {
    if (userId === otherId) throw apiError(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', 'That is you');
    const [u] = await this.db.read.select(personCols).from(users).where(and(eq(users.id, otherId), isNull(users.deletedAt)));
    if (!u) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found');
    if (on) await this.db.write.insert(follows).values({ followerId: userId, followeeId: otherId }).onConflictDoNothing();
    else await this.db.write.delete(follows).where(and(eq(follows.followerId, userId), eq(follows.followeeId, otherId)));
    return this.relation(userId, u);
  }

  async status(userId: string): Promise<CommsStatus> {
    return { open: await this.isMember(userId), mail: this.mail.kind, call: this.calls.kind, firebaseProjectId: this.mail.projectId };
  }

  /** Your ダチ, the latest conversations first. */
  async contacts(userId: string): Promise<CommsContact[]> {
    await this.mustBeMember(userId);
    const friends = await this.db.read
      .select(personCols)
      .from(follows)
      .innerJoin(users, eq(users.id, follows.followeeId))
      .where(
        and(
          eq(follows.followerId, userId),
          isNull(users.deletedAt),
          sql`EXISTS (SELECT 1 FROM ${follows} g WHERE g.follower_id = ${follows.followeeId} AND g.followee_id = ${userId})`,
        ),
      );
    if (!friends.length) return [];
    const ids = friends.map((f) => f.id);
    const recent = await this.db.read
      .select()
      .from(dmMessages)
      .where(
        and(
          isNull(dmMessages.deletedAt),
          or(and(eq(dmMessages.senderId, userId), inArray(dmMessages.recipientId, ids)), and(eq(dmMessages.recipientId, userId), inArray(dmMessages.senderId, ids))),
        ),
      )
      .orderBy(desc(dmMessages.createdAt))
      .limit(500);
    const last = new Map<string, (typeof recent)[number]>();
    const unread = new Set<string>();
    for (const m of recent) {
      const peer = m.senderId === userId ? m.recipientId : m.senderId;
      if (!last.has(peer)) last.set(peer, m);
      if (m.recipientId === userId && !m.readAt) unread.add(peer);
    }
    return friends
      .map((f) => {
        const m = last.get(f.id);
        return { ...f, lastText: m ? (m.kind === 'voice' && !m.text ? '🎤 ボイス' : m.text) : null, lastAt: m?.createdAt.toISOString() ?? null, unread: unread.has(f.id) };
      })
      .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
  }

  async messages(userId: string, peerId: string, after?: string): Promise<DmMessage[]> {
    await this.mustReach(userId, peerId);
    const pair = or(and(eq(dmMessages.senderId, userId), eq(dmMessages.recipientId, peerId)), and(eq(dmMessages.senderId, peerId), eq(dmMessages.recipientId, userId)));
    const rows = await this.db.read
      .select()
      .from(dmMessages)
      .where(and(pair, isNull(dmMessages.deletedAt), after ? gt(dmMessages.createdAt, new Date(after)) : undefined))
      .orderBy(desc(dmMessages.createdAt))
      .limit(200);
    return rows.reverse().map((m) => ({ id: m.id, fromMe: m.senderId === userId, kind: m.kind as 'text' | 'voice', text: m.text, audioUrl: m.audioUrl, createdAt: m.createdAt.toISOString() }));
  }

  async send(userId: string, peerId: string, body: SendDmBody): Promise<DmMessage> {
    await this.mustReach(userId, peerId);
    if (body.text) {
      const mod = await moderateText(body.text, this.llm);
      if (mod.flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'This message breaks the community rules');
    }
    const [m] = await this.db.write
      .insert(dmMessages)
      .values({ senderId: userId, recipientId: peerId, kind: body.audioUrl ? 'voice' : 'text', text: body.text, audioUrl: body.audioUrl ?? null })
      .returning();
    // real-time delivery (Firebase) — the message is already kept, so a failure here only delays it
    this.mail
      .deliver(pairKey(userId, peerId), { id: m.id, senderId: userId, recipientId: peerId, kind: m.kind, text: m.text, audioUrl: m.audioUrl, createdAt: m.createdAt.toISOString() })
      .catch((e) => this.log.warn(`firebase deliver failed: ${String(e)}`));
    return { id: m.id, fromMe: true, kind: m.kind as 'text' | 'voice', text: m.text, audioUrl: m.audioUrl, createdAt: m.createdAt.toISOString() };
  }

  async markRead(userId: string, peerId: string) {
    await this.db.write
      .update(dmMessages)
      .set({ readAt: new Date() })
      .where(and(eq(dmMessages.senderId, peerId), eq(dmMessages.recipientId, userId), isNull(dmMessages.readAt)));
    return { ok: true };
  }

  /** A Firebase sign-in token: the web app signs in with it and listens to its conversations. */
  async firebaseToken(userId: string) {
    await this.mustBeMember(userId);
    if (this.mail.kind !== 'firebase') throw apiError(HttpStatus.NOT_IMPLEMENTED, 'NOT_CONFIGURED', 'Firebase is not set up yet');
    return { token: await this.mail.customToken(userId), projectId: this.mail.projectId };
  }

  // ── phone ──

  private async view(row: CallRow): Promise<CallView> {
    const people = await this.db.read.select(personCols).from(users).where(inArray(users.id, [row.callerId, row.calleeId]));
    const by = new Map(people.map((p) => [p.id, p as CommsPerson]));
    return { id: row.id, status: row.status as CallView['status'], caller: by.get(row.callerId)!, callee: by.get(row.calleeId)!, createdAt: row.createdAt.toISOString(), answeredAt: row.answeredAt?.toISOString() ?? null };
  }

  /** Calls that rang too long count as missed. */
  private async expireRinging() {
    await this.db.write
      .update(callSessions)
      .set({ status: 'missed', endedAt: new Date() })
      .where(and(eq(callSessions.status, 'ringing'), lt(callSessions.createdAt, new Date(Date.now() - CALL_RING_SECONDS * 1000))));
  }

  private async mine(userId: string, id: string) {
    const [row] = await this.db.write.select().from(callSessions).where(eq(callSessions.id, id));
    if (!row || (row.callerId !== userId && row.calleeId !== userId)) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Call not found');
    return row;
  }

  async startCall(userId: string, to: string): Promise<{ call: CallView; join: CallJoin }> {
    await this.mustReach(userId, to);
    await this.expireRinging();
    const channel = `obolo-${crypto.randomUUID()}`;
    const [row] = await this.db.write.insert(callSessions).values({ callerId: userId, calleeId: to, channel }).returning();
    return { call: await this.view(row), join: this.calls.join(channel, agoraUid(userId)) };
  }

  /** Calls ringing for you now (the Earth app checks this every few seconds). */
  async incoming(userId: string): Promise<CallView[]> {
    if (!(await this.isMember(userId))) return [];
    await this.expireRinging();
    const rows = await this.db.read
      .select()
      .from(callSessions)
      .where(and(eq(callSessions.calleeId, userId), eq(callSessions.status, 'ringing')))
      .orderBy(desc(callSessions.createdAt))
      .limit(3);
    return Promise.all(rows.map((r) => this.view(r)));
  }

  async getCall(userId: string, id: string): Promise<CallView> {
    await this.expireRinging();
    return this.view(await this.mine(userId, id));
  }

  async answer(userId: string, id: string): Promise<{ call: CallView; join: CallJoin }> {
    await this.expireRinging();
    const row = await this.mine(userId, id);
    if (row.calleeId !== userId || row.status !== 'ringing') throw apiError(HttpStatus.CONFLICT, 'CALL_GONE', 'This call is no longer ringing');
    const [up] = await this.db.write.update(callSessions).set({ status: 'active', answeredAt: new Date() }).where(eq(callSessions.id, id)).returning();
    return { call: await this.view(up), join: this.calls.join(row.channel, agoraUid(userId)) };
  }

  async decline(userId: string, id: string): Promise<CallView> {
    const row = await this.mine(userId, id);
    if (row.status !== 'ringing') return this.view(row);
    const [up] = await this.db.write.update(callSessions).set({ status: 'declined', endedAt: new Date() }).where(eq(callSessions.id, id)).returning();
    return this.view(up);
  }

  async end(userId: string, id: string): Promise<CallView> {
    const row = await this.mine(userId, id);
    if (row.status === 'ended' || row.status === 'declined' || row.status === 'missed') return this.view(row);
    // hanging up before it was answered: the other side sees a missed call
    const [up] = await this.db.write
      .update(callSessions)
      .set({ status: row.status === 'ringing' ? 'missed' : 'ended', endedAt: new Date() })
      .where(eq(callSessions.id, id))
      .returning();
    return this.view(up);
  }
}
