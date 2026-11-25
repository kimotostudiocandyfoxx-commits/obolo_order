import { HttpStatus, Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { batiChatPicturePrompt, buddyAnswer, talkBeatsMarked, ChatTurn, DEFAULT_BUDDY_NAME, DEFAULT_PERSONA, type ImageProvider, LlmProvider, moderateText, summarizeMemory } from '@obolo/ai';
import { buddyQuotaDecision, idempotencyKey } from '@obolo/ledger';
import {
  BUDDY_CONTEXT_MESSAGES,
  contextWindow,
  type BuddyMakeKind,
  BUDDY_OVERAGE_MANA,
  BUDDY_SUMMARY_EVERY,
  BuddyChatResponse,
  BuddyMessageView,
  BuddyProfileView,
  BuddySource,
  Locale,
  Paged,
  QUOTA_TIMEZONE,
  UpdateBuddyProfileBody,
  callRequest,
  rememberRequest,
  ruleBeats,
  type TalkBeat,
  type TalkFace,
  type TalkMotion,
} from '@obolo/shared';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { AppConfig, CONFIG } from '../config';
import { decodeCursor, encodeCursor } from '../common/cursor';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { buddyMessages, buddyProfiles, users, wallets } from '../db/schema';
import type { KvStore } from '../infra/kv';
import type { JobQueue } from '../infra/queue';
import { BUDDY_LLM, IMAGES, KV, LLM, QUEUE } from '../infra/tokens';
import { activeBati } from '../look/batis';
import { BatiMemoryService, type RememberResult } from '../look/memory.service';
import { MediaService } from '../media/media.service';
import { LedgerService } from '../wallet/ledger.service';

const toView = (m: typeof buddyMessages.$inferSelect): BuddyMessageView => ({
  id: m.id,
  role: m.role as 'user' | 'buddy',
  text: m.text,
  createdAt: m.createdAt.toISOString(),
  ...(m.extraJson?.sources?.length ? { sources: m.extraJson.sources } : {}),
  ...(m.extraJson?.remembered ? { remembered: m.extraJson.remembered } : {}),
  ...(m.extraJson?.image ? { image: { url: m.extraJson.image.url } } : {}),
  ...(m.extraJson?.face ? { face: m.extraJson.face } : {}),
  ...(m.extraJson?.motion ? { motion: m.extraJson.motion } : {}),
  ...(m.extraJson?.faces?.length ? { faces: m.extraJson.faces } : {}),
  ...(m.extraJson?.marked ? { marked: m.extraJson.marked } : {}),
});

/** a picture in the chat may take this long; after it, the answer comes without one */
const DRAW_TIMEOUT_MS = 60_000;

/** R12: what the chat is sent with — the talk's own recent turns, and whether it can make works (the Moon atelier) */
export type ChatOpts = { history?: { role: 'user' | 'buddy'; text: string }[]; canMake?: boolean };

/**
 * R12: the turns {bati} answers with — the recent ones (the last 20 turns, bounded by size: contextWindow), oldest
 * first, then this message (a copy of it at the end of the sent turns is not repeated)
 */
export function chatHistory(text: string, turns: { role: 'user' | 'buddy'; text: string }[]): ChatTurn[] {
  const t = [...turns];
  if (t.length && t[t.length - 1].role === 'user' && t[t.length - 1].text.trim() === text.trim()) t.pop();
  const out: ChatTurn[] = contextWindow(t).map((m) => ({ role: m.role === 'buddy' ? ('assistant' as const) : ('user' as const), text: m.text }));
  out.push({ role: 'user', text });
  return out;
}

/**
 * M-R208 caps, counted per day in Redis (shared by every instance): looked-up answers per member and for everyone
 * (each takes up to two web searches), pictures drawn per member. A used cap only turns the ability off for the day —
 * Bati still answers (the one-call prompt is told so).
 */
export class BuddyExtrasCaps {
  constructor(
    private readonly kv: KvStore,
    private readonly cfg: Pick<AppConfig, 'BUDDY_SEARCH_DAILY' | 'BUDDY_SEARCH_GLOBAL_DAILY' | 'BUDDY_DRAW_DAILY'>,
  ) {}
  private keys(userId: string, day = quotaDay()) {
    return { search: `buddy-search:${userId}:${day}`, all: `buddy-search-all:${day}`, draw: `buddy-draw:${userId}:${day}` };
  }
  async abilities(userId: string): Promise<{ search: boolean; draw: boolean }> {
    const k = this.keys(userId);
    const [s, a, d] = await Promise.all([this.kv.get(k.search), this.kv.get(k.all), this.kv.get(k.draw)]);
    return {
      search: Number(s ?? 0) < this.cfg.BUDDY_SEARCH_DAILY && Number(a ?? 0) < this.cfg.BUDDY_SEARCH_GLOBAL_DAILY,
      draw: Number(d ?? 0) < this.cfg.BUDDY_DRAW_DAILY,
    };
  }
  async searched(userId: string) {
    const k = this.keys(userId);
    await Promise.all([this.kv.incr(k.search, 2 * 86400), this.kv.incr(k.all, 2 * 86400)]);
  }
  /** takes one of the day's pictures; false when another request took the last one first */
  async takeDraw(userId: string): Promise<boolean> {
    return (await this.kv.incr(this.keys(userId).draw, 2 * 86400)) <= this.cfg.BUDDY_DRAW_DAILY;
  }
}

export function quotaDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: QUOTA_TIMEZONE }).format(now);
}

@Injectable()
export class BuddyService implements OnModuleInit {
  private readonly log = new Logger('Buddy');
  private readonly caps: BuddyExtrasCaps;
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
    // Bati's conversation: Claude Haiku 5.5 when its key is set (client decision 2026-11-21), else the Gemini chain
    @Inject(BUDDY_LLM) private readonly llm: LlmProvider,
    @Inject(QUEUE) private readonly queue: JobQueue,
    private readonly db: Database,
    private readonly ledger: LedgerService,
    // M-R208: moderating what to draw (the ordinary chain, as for every other prompt), painting it, keeping it
    @Inject(LLM) private readonly modLlm: LlmProvider,
    @Inject(IMAGES) private readonly images: ImageProvider,
    private readonly media: MediaService,
    /** M-R222: the member's own 「覚えといて」 / 「〇〇って呼んで」 */
    @Optional() private readonly memory?: BatiMemoryService,
  ) {
    this.caps = new BuddyExtrasCaps(kv, cfg);
  }

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
    const [u] = await this.db.write.select({ batiName: users.batiName }).from(users).where(eq(users.id, userId));
    return { buddyName: u?.batiName || p.buddyName, persona: p.personaJson, hasMemory: !!p.memorySummary };
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

  /** `onText`: the ordinary answer as it is written (POST /buddy/chat/stream); the saved reply comes at the end */
  async chat(userId: string, text: string, localeOverride?: Locale, onText?: (piece: string) => void, origin = '', opts: ChatOpts = {}): Promise<BuddyChatResponse> {
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

    // --- Context: recent turns verbatim + long-term memory summary. R12: the talk's own turns when the app sends them
    // (the Moon atelier: its making questions and lines are not in the stored history), else the stored ones; the last
    // 20 turns, bounded by size (contextWindow).
    const recent = opts.history
      ? []
      : await this.db.write
          .select()
          .from(buddyMessages)
          .where(eq(buddyMessages.userId, userId))
          .orderBy(desc(buddyMessages.createdAt))
          .limit(BUDDY_CONTEXT_MESSAGES);
    const history = chatHistory(text, opts.history ?? [...recent].reverse().map((m) => ({ role: m.role === 'buddy' ? ('buddy' as const) : ('user' as const), text: m.text })));

    // M-R222: only the member's own 「覚えといて」 keeps something ({bati} never asks); 「〇〇って呼んで」 changes the 呼び方
    let remembered: { text: string; result: RememberResult } | undefined;
    let calledAs: string | undefined;
    let me = user;
    if (activeBati(user) && this.memory) {
      const ask = rememberRequest(text, [...history].slice(0, -1).filter((m) => m.role === 'user').pop()?.text);
      const call = ask ? null : callRequest(text);
      if (ask) {
        const r = await this.memory.remember(userId, ask).catch(() => null);
        if (r) {
          remembered = { text: r.text, result: r.result };
          if (r.user) me = r.user;
        }
      } else if (call) {
        const nu = await this.memory.callAs(userId, call).catch(() => false as const);
        if (nu) {
          me = nu;
          calledAs = call;
        }
      }
    }

    const locale = localeOverride ?? (user.locale as Locale);
    let replyText: string;
    let replyKind: 'normal' | 'worry' | 'danger' = 'normal';
    let sources: BuddySource[] | undefined;
    let draw: string | undefined;
    // M-R234/M-R235: {bati}'s face and reaction, from the same call
    let face: TalkFace | undefined;
    let motion: TalkMotion | undefined;
    let faces: TalkBeat[] | undefined;
    let make: BuddyMakeKind | undefined;
    // M-R238: your own words' faces, sentence by sentence — one small call beside the reply (the rules if it fails)
    // M-R243: with its entrances, shapes and marks
    const mine = talkBeatsMarked(this.llm, text, { self: true, timeoutMs: 3000 }).catch(() => ({ faces: ruleBeats(text, true), marked: undefined as string | undefined }));
    // M-R208: whether Bati may look it up / draw today (a used cap turns it off, the talk goes on)
    const can = { ...(await this.caps.abilities(userId).catch(() => ({ search: false, draw: false }))), make: !!opts.canMake };
    try {
      ({ text: replyText, kind: replyKind, sources, draw, face, motion, faces, make } = await buddyAnswer(
        this.llm,
        {
          // the member's own {bati}, named on the Moon, answers under its own name (story chat 2026-11-02)
          buddyName: user.batiName || profile.buddyName,
          persona: profile.personaJson,
          memorySummary: profile.memorySummary as string | null,
          userDisplayName: user.displayName,
          locale,
          // M-R215: the {bati} in the chat talks in its own manner. M-R222: 「覚えてること」 are its only memory (the
          // summary is not sent); it calls them by the society name unless asked otherwise
          ...(() => {
            const b = activeBati(me);
            if (!b) return {};
            return {
              bati: { personality: b.personality, self: b.selfCustom || b.self, call: b.callCustom || b.call, catchphrase: b.catchphrase, custom: b.custom ?? null },
              memorySummary: null,
              memories: (b.memories ?? []).map((p) => p.text),
              role: b.role ?? 'any',
              ...(remembered ? { remembered } : {}),
              ...(calledAs ? { calledAs } : {}),
            };
          })(),
        },
        history,
        onText,
        can,
      ));
    } catch (err) {
      this.log.error(`LLM failed: ${String(err)}`);
      throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'BUDDY_UNAVAILABLE', 'Buddy is resting, try again soon');
    }
    if (sources) await this.caps.searched(userId).catch(() => undefined);
    let image: { url: string; mediaId: string } | undefined;
    if (draw && replyKind === 'normal') {
      const drawn = await this.draw(userId, text, draw, locale, origin);
      if ('image' in drawn) image = drawn.image;
      else replyText = drawn.text;
    }
    const extra =
      sources?.length || image || remembered || face || motion || faces
        ? { ...(sources?.length ? { sources } : {}), ...(image ? { image } : {}), ...(remembered ? { remembered } : {}), ...(face ? { face } : {}), ...(motion ? { motion } : {}), ...(faces?.length ? { faces } : {}) }
        : null;
    const myFaces = await mine;

    const now = Date.now();
    const result = await this.db.write.transaction(async (tx) => {
      const [u] = await tx.insert(buddyMessages).values({ userId, role: 'user', text, extraJson: myFaces.faces.length ? { faces: myFaces.faces, ...(myFaces.marked ? { marked: myFaces.marked } : {}) } : null, createdAt: new Date(now) }).returning();
      const [b] = await tx
        .insert(buddyMessages)
        .values({ userId, role: 'buddy', text: replyText, provider: this.llm.name, extraJson: extra, createdAt: new Date(now + 1) })
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
      kind: replyKind,
      ...(make && replyKind === 'normal' ? { make } : {}),
    };
  }

  /**
   * M-R208 "〜の絵を見せて": what to draw is checked like any other prompt, painted by the image provider and kept with
   * the media service (kind "image"). A refused or failed picture gives Bati's own line instead.
   */
  private async draw(userId: string, asked: string, what: string, locale: Locale, origin: string): Promise<{ image: { url: string; mediaId: string } } | { text: string }> {
    const ja = locale !== 'en';
    if ((await moderateText(`${asked}\n${what}`, this.modLlm)).flagged) return { text: ja ? 'その絵は、ボクには描けないんだ。ほかのものなら描けるよ！' : "I can't draw that one. Ask me for something else!" };
    if (!(await this.caps.takeDraw(userId).catch(() => false))) return { text: ja ? '今日は、もう絵を描けないんだ。また明日ね。' : "I can't draw any more today. Let's draw tomorrow!" };
    try {
      let timer: NodeJS.Timeout | undefined;
      const img = await Promise.race([
        this.images.generate(batiChatPicturePrompt(what)),
        new Promise<never>((_, no) => (timer = setTimeout(() => no(new Error('draw timeout')), DRAW_TIMEOUT_MS))),
      ]).finally(() => clearTimeout(timer));
      const m = await this.media.storeImage(userId, 'image', img.mime, img.data, origin);
      return { image: { url: m.url, mediaId: m.id } };
    } catch (e) {
      this.log.warn(`chat picture failed: ${String(e)}`);
      return { text: ja ? 'うーん、うまく描けなかった……。また頼んでね。' : "Hmm, I couldn't draw it this time. Ask me again!" };
    }
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
