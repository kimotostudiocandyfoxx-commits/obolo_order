import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { buddyReply, ChatTurn, DEFAULT_BUDDY_NAME, DEFAULT_PERSONA, LlmProvider, summarizeMemory } from '@obolo/ai';
import { buddyQuotaDecision, idempotencyKey } from '@obolo/ledger';
import {
  BUDDY_CONTEXT_MESSAGES,
  BUDDY_OVERAGE_MANA,
  BUDDY_SUMMARY_EVERY,
  BuddyChatResponse,
  BuddyMessageView,
  BuddyProfileView,
  Locale,
  Paged,
  QUOTA_TIMEZONE,
  UpdateBuddyProfileBody,
} from '@obolo/shared';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { AppConfig, CONFIG } from '../config';
import { decodeCursor, encodeCursor } from '../common/cursor';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { buddyMessages, buddyProfiles, users, wallets } from '../db/schema';
import type { KvStore } from '../infra/kv';
import type { JobQueue } from '../infra/queue';
import { KV, LLM, QUEUE } from '../infra/tokens';
import { LedgerService } from '../wallet/ledger.service';

const toView = (m: typeof buddyMessages.$inferSelect): BuddyMessageView => ({
  id: m.id,
  role: m.role as 'user' | 'buddy',
  text: m.text,
  createdAt: m.createdAt.toISOString(),
});

export function quotaDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: QUOTA_TIMEZONE }).format(now);
}

@Injectable()
export class BuddyService implements OnModuleInit {
  private readonly log = new Logger('Buddy');
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
    @Inject(LLM) private readonly llm: LlmProvider,
    @Inject(QUEUE) private readonly queue: JobQueue,
    private readonly db: Database,
    private readonly ledger: LedgerService,
  ) {}

  onModuleInit() {
    this.queue.register('buddy.summarize', ({ userId }) => this.summarize(userId));
  }

  private quotaKey(userId: string) {
    return `buddy-q:${userId}:${quotaDay()}`;
  }

  async getQuota(userId: string) {
    const used = Number((await this.kv.get(this.quotaKey(userId))) ?? 0);
    return { usedToday: used, freeDaily: this.cfg.BUDDY_FREE_DAILY };
  }

  private async ensureProfile(userId: string) {
    const [p] = await this.db.write.select().from(buddyProfiles).where(eq(buddyProfiles.userId, userId));
    if (p) return p;
    const [u] = await this.db.write.select({ locale: users.locale }).from(users).where(eq(users.id, userId));
    const name = DEFAULT_BUDDY_NAME[(u?.locale as Locale) ?? 'ja'] ?? DEFAULT_BUDDY_NAME.ja;
    await this.db.write
      .insert(buddyProfiles)
      .values({ userId, buddyName: name, personaJson: DEFAULT_PERSONA })
      .onConflictDoNothing();
    const [created] = await this.db.write.select().from(buddyProfiles).where(eq(buddyProfiles.userId, userId));
    return created;
  }

  async getProfile(userId: string): Promise<BuddyProfileView> {
    const p = await this.ensureProfile(userId);
    return { buddyName: p.buddyName, persona: p.personaJson, hasMemory: !!p.memorySummary };
  }

  async updateProfile(userId: string, body: UpdateBuddyProfileBody): Promise<BuddyProfileView> {
    await this.ensureProfile(userId);
    await this.db.write
      .update(buddyProfiles)
      .set({
        ...(body.buddyName ? { buddyName: body.buddyName } : {}),
        ...(body.persona ? { personaJson: body.persona } : {}),
        updatedAt: new Date(),
      })
      .where(eq(buddyProfiles.userId, userId));
    return this.getProfile(userId);
  }

  async listMessages(userId: string, cursor?: string, limit = 30): Promise<Paged<BuddyMessageView>> {
    const c = decodeCursor(cursor);
    const rows = await this.db.read
      .select()
      .from(buddyMessages)
      .where(
        and(
          eq(buddyMessages.userId, userId),
          c
            ? or(
                lt(buddyMessages.createdAt, new Date(c.t)),
                and(eq(buddyMessages.createdAt, new Date(c.t)), lt(buddyMessages.id, c.id)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(buddyMessages.createdAt), desc(buddyMessages.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map(toView),
      nextCursor: rows.length > limit && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async chat(userId: string, text: string, localeOverride?: Locale): Promise<BuddyChatResponse> {
    const profile = await this.ensureProfile(userId);
    const [user] = await this.db.write.select().from(users).where(eq(users.id, userId));
    const [wallet] = await this.db.write.select().from(wallets).where(eq(wallets.userId, userId));

    // --- Daily quota (spec §2.2), counted in Redis so it holds across all instances.
    const used = await this.kv.incr(this.quotaKey(userId), 2 * 86400);
    const decision = buddyQuotaDecision({
      usedToday: used - 1,
      freeDaily: this.cfg.BUDDY_FREE_DAILY,
      overageEnabled: this.cfg.BUDDY_OVERAGE_ENABLED,
      overageCost: BUDDY_OVERAGE_MANA,
      manaBalance: wallet?.manaBalance ?? 0,
    });
    if (!decision.allowed) {
      throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'BUDDY_QUOTA', 'Daily Buddy message quota reached');
    }

    // --- Context: recent turns verbatim + long-term memory summary.
    const recent = await this.db.write
      .select()
      .from(buddyMessages)
      .where(eq(buddyMessages.userId, userId))
      .orderBy(desc(buddyMessages.createdAt))
      .limit(BUDDY_CONTEXT_MESSAGES);
    const history: ChatTurn[] = recent
      .reverse()
      .map((m) => ({ role: m.role === 'buddy' ? ('assistant' as const) : ('user' as const), text: m.text }));
    history.push({ role: 'user', text });

    const locale = localeOverride ?? (user.locale as Locale);
    let replyText: string;
    try {
      replyText = await buddyReply(
        this.llm,
        {
          buddyName: profile.buddyName,
          persona: profile.personaJson,
          memorySummary: profile.memorySummary,
          userDisplayName: user.displayName,
          locale,
        },
        history,
      );
    } catch (err) {
      this.log.error(`LLM failed: ${String(err)}`);
      throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'BUDDY_UNAVAILABLE', 'Buddy is resting, try again soon');
    }

    const now = Date.now();
    const result = await this.db.write.transaction(async (tx) => {
      const [u] = await tx.insert(buddyMessages).values({ userId, role: 'user', text, createdAt: new Date(now) }).returning();
      const [b] = await tx
        .insert(buddyMessages)
        .values({ userId, role: 'buddy', text: replyText, provider: this.llm.name, createdAt: new Date(now + 1) })
        .returning();
      if (decision.chargeMana > 0) {
        await this.ledger.applyMana(tx, {
          userId,
          delta: -decision.chargeMana,
          reason: 'buddy_overage',
          refType: 'buddy_message',
          refId: u.id,
          idempotencyKey: idempotencyKey('buddy-overage', userId, u.id),
        });
      }
      const [p] = await tx
        .update(buddyProfiles)
        .set({ messagesSinceSummary: sql`${buddyProfiles.messagesSinceSummary} + 2` })
        .where(eq(buddyProfiles.userId, userId))
        .returning({ since: buddyProfiles.messagesSinceSummary });
      return { u, b, since: p.since };
    });

    if (result.since >= BUDDY_SUMMARY_EVERY) {
      await this.queue.enqueue('buddy.summarize', { userId }, { dedupeKey: `buddy-summarize-${userId}` });
    }

    return {
      userMessage: toView(result.u),
      reply: toView(result.b),
      quota: { usedToday: used, freeDaily: this.cfg.BUDDY_FREE_DAILY },
    };
  }

  /** Background job: fold recent messages into the long-term memory summary. */
  async summarize(userId: string): Promise<void> {
    const [p] = await this.db.write.select().from(buddyProfiles).where(eq(buddyProfiles.userId, userId));
    if (!p || p.messagesSinceSummary <= 0) return;
    const take = Math.min(p.messagesSinceSummary, 40);
    const [user] = await this.db.write.select({ locale: users.locale }).from(users).where(eq(users.id, userId));
    const rows = await this.db.write
      .select()
      .from(buddyMessages)
      .where(eq(buddyMessages.userId, userId))
      .orderBy(desc(buddyMessages.createdAt))
      .limit(take);
    const turns: ChatTurn[] = rows.reverse().map((m) => ({ role: m.role === 'buddy' ? 'assistant' : 'user', text: m.text }));
    const summary = await summarizeMemory(this.llm, (user?.locale as Locale) ?? 'ja', p.memorySummary, turns);
    await this.db.write
      .update(buddyProfiles)
      .set({
        memorySummary: summary,
        messagesSinceSummary: sql`GREATEST(${buddyProfiles.messagesSinceSummary} - ${p.messagesSinceSummary}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(buddyProfiles.userId, userId));
    this.log.log(`memory updated for ${userId}`);
  }

  /** Privacy: "forget everything" — clears memory and history. */
  async forget(userId: string): Promise<void> {
    await this.db.write.transaction(async (tx) => {
      await tx.delete(buddyMessages).where(eq(buddyMessages.userId, userId));
      await tx
        .update(buddyProfiles)
        .set({ memorySummary: null, messagesSinceSummary: 0, updatedAt: new Date() })
        .where(eq(buddyProfiles.userId, userId));
    });
  }
}
