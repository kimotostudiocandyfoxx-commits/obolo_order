import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  JOURNEY_DONE,
  JOURNEY_PAYMENT,
  LAP2_DONE,
  LAP2_WAIT_MS,
  MEMBERS_DAYS,
  batiPersonaByRules,
  lap2Done,
  lap2OpensAt,
  type Me,
  type TesterJumpBody,
} from '@obolo/shared';
import { eq } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { buddyMessages, buddyProfiles, moonWorks, users, workHomecomings } from '../db/schema';
import { DachiVoiceService } from '../dachi/dachi-voice.service';
import type { KvStore } from '../infra/kv';
import type { JobQueue } from '../infra/queue';
import { KV, QUEUE } from '../infra/tokens';
import type { BatiRecord } from '../look/batis';
import { isTester } from './tester';
import { toMe, UsersService } from './users.service';

type User = typeof users.$inferSelect;

/** the default first {bati} of the tester entrance (no model call: the rules' persona, M-R225 / M-R230) */
export const TESTER_BATI = { seed: 'いちご', name: 'バティ', egg: 'sun' as const };

/**
 * What 〔最初から〕 keeps of onboarding_json: the start-of-app agreement's answers (consent.media) and the birth year
 * (set once, M-R150). Everything else there is the journey (answers d1.…, l2.…, sys.…, the looks, {bati}'s faces).
 */
const KEEP_ON_RESET = ['birthYear', 'consent.media'];

/**
 * The tester entrance (docs/本番の状態.md 「テスターの入口」): only accounts on the server's allowlist (users/tester.ts).
 * Reuses the operator day-jump (UsersService.jumpJourney / jumpMembersDay) and never lifts the daily generation caps
 * or the mana: those stay as for everyone. Every action is logged with the account id.
 */
@Injectable()
export class TesterService {
  private readonly log = new Logger('Tester');

  constructor(
    private readonly db: Database,
    private readonly users: UsersService,
    private readonly dachiVoice: DachiVoiceService,
    @Inject(KV) private readonly kv: KvStore,
    @Inject(QUEUE) private readonly queue: JobQueue,
  ) {}

  protected async user(userId: string): Promise<User> {
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    return u;
  }

  /** 403 for everyone not on the allowlist */
  async guard(userId: string): Promise<User> {
    const u = await this.user(userId);
    if (!isTester(u)) throw apiError(HttpStatus.FORBIDDEN, 'NOT_TESTER', 'Testers only');
    return u;
  }

  private note(userId: string, action: string, detail = '') {
    this.log.log(`tester ${action}${detail ? ` ${detail}` : ''} user=${userId}`);
  }

  /**
   * 〔全部ひらく〕: the first journey done (every Moon atelier kind open, lib/atelier/unlock.ts), an Obolo Order (a demo
   * order, no charge), {bati} born (a default one when there is none: the picture painted in the background), the ダチ
   * threads there (D04-S005c). Bluena and the finds need nothing more. Idempotent.
   */
  async unlockAll(userId: string, origin: string): Promise<Me> {
    await this.guard(userId);
    this.note(userId, 'unlock-all');
    await this.ensureBati(userId, origin);
    // the operator day-jump to "the journey done" (keeps an order already made, and the members' days' progress)
    await this.users.jumpJourney(userId, JOURNEY_DONE);
    if (!(await this.user(userId)).orderedAt) await this.users.markOrdered(userId, { subscriptionStatus: 'demo' });
    // a member's 88 mana for this month (one key per month, so pressing again does not add more; 〔マナ +88〕 does)
    await this.users.grantMonth(userId).catch((e) => this.log.warn(`tester month grant failed: ${String(e)}`));
    await this.dachiVoice.markDachi(userId).catch((e) => this.log.warn(`tester dachi failed: ${String(e)}`));
    return this.users.getMe(userId);
  }

  /** 〔マナ +88〕: 88 more mana to try paid makings (refused at 8,888 or more) */
  async mana(userId: string): Promise<Me> {
    await this.guard(userId);
    this.note(userId, 'mana');
    await this.users.addTesterMana(userId);
    return this.users.getMe(userId);
  }

  /** 〔N日目〕 / 〔会員N〕: that day from its start, no wait. From day 3 {bati} is there (born on day 2). */
  async jump(userId: string, day: TesterJumpBody['day'], origin: string): Promise<Me> {
    await this.guard(userId);
    this.note(userId, 'jump', `day=${day}`);
    if (typeof day === 'string') {
      await this.ensureBati(userId, origin);
      await this.dachiVoice.markDachi(userId).catch(() => undefined);
      return this.users.jumpMembersDay(userId, (MEMBERS_DAYS.indexOf(day) + 1) as 1 | 2 | 3);
    }
    if (day >= 3) await this.ensureBati(userId, origin);
    return this.users.jumpJourney(userId, day);
  }

  /**
   * 〔次の日へ〕: the next day now, from its start — finished or not, the wait skipped. 1 → … → 8 (the Sun) → 会員1 →
   * 会員2 → 会員3; after the last members' day nothing is left (unchanged). An order made early is kept.
   */
  async next(userId: string, origin: string): Promise<Me> {
    const u = await this.guard(userId);
    const story = (u.onboardingJson ?? {}) as Record<string, string>;
    if (u.journeyDay < JOURNEY_PAYMENT) {
      const day = u.journeyDay + 1;
      this.note(userId, 'next', `day=${day}`);
      if (day >= 3) await this.ensureBati(userId, origin);
      const [nu] = await this.db.write.update(users).set({ journeyDay: day, journeyCompletedAt: null, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
      return toMe(nu);
    }
    if (u.journeyDay === JOURNEY_PAYMENT || !u.orderedAt) {
      this.note(userId, 'next', 'day=m1');
      await this.ensureBati(userId, origin);
      return this.users.jumpMembersDay(userId, 1);
    }
    const done = lap2Done(story);
    if (done >= LAP2_DONE) {
      this.note(userId, 'next', 'nothing left');
      return toMe(u);
    }
    // waiting for members' day done+1 → it opens now; playing it → the one after it
    const waiting = lap2OpensAt(story) !== null && Date.now() < (lap2OpensAt(story) ?? 0);
    const target = waiting ? done + 1 : done + 2;
    if (target > LAP2_DONE) {
      // the last members' day skipped: all three done
      this.note(userId, 'next', 'day=end');
      const [nu] = await this.db.write
        .update(users)
        .set({ onboardingJson: { ...story, 'l2.done': String(LAP2_DONE), 'l2.at': new Date(Date.now() - LAP2_WAIT_MS).toISOString() }, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      return toMe(nu);
    }
    this.note(userId, 'next', `day=m${target}`);
    return this.users.jumpMembersDay(userId, target as 1 | 2 | 3);
  }

  /**
   * 〔最初から〕: this account back to before day 1, in one transaction; the account and its login stay. Wiped: the
   * journey (day, answers, the order), what the journey made on the account (the NEO look, the ぷにぷに, the butterfly,
   * the branches, Uranus's atelier), every {bati} (with its voice, the kororin voice and the egg), the talk with {bati}
   * (messages and memory), the Moon atelier's works list (moon_works, soft-deleted) and their homecomings. Kept: the
   * account (email, name, handle, login sessions), the agreement and the birth year, the member's own voice, the ダチ
   * (follows, the ダチ messages and when they became dachi), the posts on the planets, the mana and its ledger, the
   * daily caps. Idempotent: a second reset leaves the same state.
   */
  async reset(userId: string): Promise<Me> {
    const u = await this.guard(userId);
    this.note(userId, 'reset');
    const j = (u.onboardingJson ?? {}) as Record<string, string>;
    const kept = Object.fromEntries(KEEP_ON_RESET.filter((k) => j[k] !== undefined).map((k) => [k, j[k]]));
    const now = new Date();
    const nu = await this.db.write.transaction(async (tx) => {
      await tx.delete(buddyMessages).where(eq(buddyMessages.userId, userId));
      await tx.delete(buddyProfiles).where(eq(buddyProfiles.userId, userId));
      await tx.update(moonWorks).set({ deletedAt: now, updatedAt: now }).where(eq(moonWorks.userId, userId));
      await tx.delete(workHomecomings).where(eq(workHomecomings.userId, userId));
      const [row] = await tx
        .update(users)
        .set({
          journeyDay: 1,
          journeyCompletedAt: null,
          orderedAt: null,
          stripeSubscriptionId: null,
          subscriptionStatus: 'demo',
          neoForm: null,
          avatarUrl: null,
          lookJson: null,
          puniPicUrl: null,
          butterflyUrl: null,
          jupiterBranches: null,
          atelierJson: null,
          batiFood: null,
          batiName: null,
          batiImageUrl: null,
          batisJson: null,
          batiId: null,
          batiEggAt: null,
          voiceBatiId: null,
          voiceBatiUrl: null,
          voiceBatiState: null,
          voiceKororinId: null,
          voiceKororinUrl: null,
          onboardingJson: kept,
          updatedAt: now,
        })
        .where(eq(users.id, userId))
        .returning();
      return row;
    });
    await this.kv.del(`bati:egg:${userId}`).catch(() => undefined);
    await this.kv.del(`bati:painting:${userId}`).catch(() => undefined);
    return toMe(nu);
  }

  /**
   * {bati} as the story would have left it on day 2: when there is none, a first one with the default seed and the
   * rules' persona (no model call), named; its picture is painted in the background (the same job as the story's).
   */
  async ensureBati(userId: string, origin: string) {
    const u = await this.user(userId);
    if (u.batiFood) return;
    const p = batiPersonaByRules(TESTER_BATI.seed, TESTER_BATI.egg, Math.random(), { first: true });
    const rec: BatiRecord = {
      id: randomUUID(),
      name: TESTER_BATI.name,
      egg: TESTER_BATI.egg,
      seed: TESTER_BATI.seed,
      seedKind: 'food',
      personality: p.personality,
      self: p.self,
      call: p.call,
      catchphrase: p.catchphrase,
      trait: p.trait,
      intro: p.intro,
      imageUrl: null,
      bornImageUrl: null,
      createdAt: new Date().toISOString(),
    };
    await this.db.write
      .update(users)
      .set({ batisJson: [rec], batiId: rec.id, batiFood: rec.seed, batiName: rec.name, batiImageUrl: null, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await this.db.write
      .insert(buddyProfiles)
      .values({ userId, buddyName: rec.name!, personaJson: { cheer: 70, polite: 30, humor: 60 } })
      .onConflictDoUpdate({ target: buddyProfiles.userId, set: { buddyName: rec.name!, updatedAt: new Date() } });
    await this.kv.set(`bati:egg:${userId}`, rec.egg, 7 * 24 * 3600).catch(() => undefined);
    await this.kv.set(`bati:painting:${userId}`, String(Date.now()), 600).catch(() => undefined);
    await this.queue.enqueue('bati.paint', { userId, origin }, { dedupeKey: `bati-paint-${userId}-${Date.now()}` }).catch((e) => this.log.warn(`tester bati paint failed: ${String(e)}`));
  }
}
