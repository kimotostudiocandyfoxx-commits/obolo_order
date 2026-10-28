import { HttpStatus, Injectable } from '@nestjs/common';
import {
  EMPTY_ATELIER,
  JOURNEY_DONE,
  nextJourneyDay,
  JOURNEY_PAYMENT,
  JOURNEY_WAIT_MS,
  MONTHLY_GRANT_MANA,
  type AtelierLayout,
  type CompleteJourneyDayBody,
  type CompleteLap2Body,
  LAP2,
  lap2Done,
  type Locale,
  type Me,
  type UpdateProfileBody,
  isChild,
} from '@obolo/shared';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { users } from '../db/schema';
import { LedgerService } from '../wallet/ledger.service';

/** Bati's expression pictures, kept in onboardingJson['bati.faces'] (JSON) */
function batiFaces(j: Record<string, string> | null): Partial<Record<string, string>> | undefined {
  try {
    return j?.['bati.faces'] ? (JSON.parse(j['bati.faces']) as Record<string, string>) : undefined;
  } catch {
    return undefined;
  }
}

export function toMe(u: typeof users.$inferSelect): Me {
  return {
    id: u.id,
    email: u.email,
    handle: u.handle,
    displayName: u.displayName,
    bio: u.bio,
    country: u.country,
    locale: u.locale as Locale,
    subscriptionStatus: u.subscriptionStatus as Me['subscriptionStatus'],
    journeyDay: u.journeyDay,
    journeyCompletedAt: u.journeyCompletedAt?.toISOString() ?? null,
    invitedByName: u.invitedByName,
    invitedByMessage: u.invitedByMessage ?? null,
    neoForm: u.neoForm,
    avatarUrl: u.avatarUrl,
    lookStandee: (u.onboardingJson as Record<string, string> | null)?.['look.standee'] ?? null,
    lookChibi: (u.onboardingJson as Record<string, string> | null)?.['look.chibi'] ?? null,
    lookIcon: (u.onboardingJson as Record<string, string> | null)?.['look.icon'] ?? null,
    birthYear: Number((u.onboardingJson as Record<string, string> | null)?.['birthYear']) || null,
    child: isChild(Number((u.onboardingJson as Record<string, string> | null)?.['birthYear']) || null),
    bati: u.batiFood ? { food: u.batiFood, name: u.batiName, imageUrl: u.batiImageUrl, faces: batiFaces(u.onboardingJson) } : null,
    orderedAt: u.orderedAt?.toISOString() ?? null,
    voices: { self: !!u.voiceSelfId, bati: !!u.voiceBatiId, selfSings: !!u.voiceSelfUrl, kororin: !!u.voiceKororinId },
    look: u.lookJson ?? null,
    puniPic: u.puniPicUrl ?? null,
    butterfly: u.butterflyUrl ?? null,
    story: Object.fromEntries(Object.entries(u.onboardingJson ?? {}).filter(([k]) => /^(d\d+|l2)\./.test(k))),
    createdAt: u.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly db: Database,
    private readonly ledger: LedgerService,
  ) {}

  /** an Obolo Order's gem fills each month (88). One key per user per month, so webhooks repeating is harmless. */
  async grantMonth(userId: string, at = new Date()) {
    const month = at.toISOString().slice(0, 7);
    await this.db.write.transaction((tx) =>
      this.ledger.applyMana(tx, { userId, delta: MONTHLY_GRANT_MANA, reason: 'monthly_grant', idempotencyKey: `monthly:${userId}:${month}` }),
    );
  }

  async getMe(userId: string): Promise<Me> {
    const [u] = await this.db.write.select().from(users).where(and(eq(users.id, userId), isNull(users.deletedAt)));
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    return toMe(u);
  }

  async updateMe(userId: string, body: UpdateProfileBody): Promise<Me> {
    if (body.handle) {
      const [taken] = await this.db.write
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.handle, body.handle), ne(users.id, userId)));
      if (taken) throw apiError(HttpStatus.CONFLICT, 'HANDLE_TAKEN', 'This handle is already taken');
    }
    const { look, birthYear, ...rest } = body;
    // the birth year is set once (M-R150): the child settings must not be switched off later by the member
    const cur = birthYear !== undefined ? ((await this.load(userId)).onboardingJson ?? {}) as Record<string, string> : null;
    const year = cur && !cur.birthYear && birthYear !== undefined ? { onboardingJson: { ...cur, birthYear: String(birthYear) } } : {};
    const [u] = await this.db.write
      .update(users)
      .set({ ...rest, ...year, ...(look !== undefined ? { lookJson: look } : {}), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return toMe(u);
  }

  /** Uranus: your atelier; only ORDER members have one (the second journey). */
  async getAtelier(userId: string): Promise<AtelierLayout> {
    const u = await this.load(userId);
    if (!u.orderedAt) throw apiError(HttpStatus.FORBIDDEN, 'ORDER_REQUIRED', 'The atelier opens for ORDER members');
    return u.atelierJson ?? EMPTY_ATELIER;
  }

  async saveAtelier(userId: string, layout: AtelierLayout): Promise<AtelierLayout> {
    const u = await this.load(userId);
    if (!u.orderedAt) throw apiError(HttpStatus.FORBIDDEN, 'ORDER_REQUIRED', 'The atelier opens for ORDER members');
    await this.db.write.update(users).set({ atelierJson: layout, updatedAt: new Date() }).where(eq(users.id, userId));
    return layout;
  }

  private async load(userId: string) {
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    return u;
  }

  /**
   * The story of `day` was finished. Idempotent; never moves the journey backwards.
   * Day 8 (the Sun) ends paid (ORDER) or not (a resident, draft 21); either way the journey is then done.
   */
  async completeJourneyDay(userId: string, body: CompleteJourneyDayBody): Promise<Me> {
    const cur = await this.load(userId);
    if (cur.journeyDay !== body.day || cur.journeyCompletedAt) return toMe(cur);
    const [u] = await this.db.write
      .update(users)
      .set({
        journeyCompletedAt: new Date(),
        onboardingJson: { ...cur.onboardingJson, ...Object.fromEntries(Object.entries(body.answers ?? {}).map(([k, v]) => [`d${body.day}.${k}`, v])) },
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return toMe(u);
  }

  /**
   * A chapter of the second journey was finished (Obolo Order only). Chapters go in order and never back;
   * finishing one again (a replay) keeps what was made then.
   */
  async completeLap2(userId: string, body: CompleteLap2Body): Promise<Me> {
    const cur = await this.load(userId);
    const story = (cur.onboardingJson ?? {}) as Record<string, string>;
    if (!cur.orderedAt || body.chapter !== lap2Done(story)) return toMe(cur);
    const id = LAP2[body.chapter].id;
    const [u] = await this.db.write
      .update(users)
      .set({
        onboardingJson: { ...story, ...Object.fromEntries(Object.entries(body.answers ?? {}).map(([k, v]) => [`l2.${id}.${k}`, v])), 'l2.done': String(body.chapter + 1) },
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return toMe(u);
  }

  /**
   * Start the next day: allowed 24 h after the current day was finished, or immediately with
   * skip ("明日まで待てない"). PLACEHOLDER (P-OB-3): skipping is free and unlimited for now.
   */
  async advanceJourney(userId: string, skip: boolean): Promise<Me> {
    const cur = await this.load(userId);
    if (!cur.journeyCompletedAt || cur.journeyDay >= JOURNEY_DONE) return toMe(cur);
    if (!skip && Date.now() < cur.journeyCompletedAt.getTime() + JOURNEY_WAIT_MS) {
      throw apiError(HttpStatus.CONFLICT, 'NOT_YET', 'The next day has not opened yet');
    }
    const [u] = await this.db.write
      .update(users)
      .set({ journeyDay: nextJourneyDay(cur.journeyDay), journeyCompletedAt: null, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return toMe(u);
  }

  /**
   * Operator testing: put the account on `day` (story from the start, no countdown). Days up to 9
   * also forget the order so the Day 9 payment can be tried again (the Stripe customer is kept).
   */
  async jumpJourney(userId: string, day: number): Promise<Me> {
    const [u] = await this.db.write
      .update(users)
      .set({
        journeyDay: day,
        journeyCompletedAt: null,
        ...(day <= JOURNEY_PAYMENT ? { orderedAt: null, stripeSubscriptionId: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return toMe(u);
  }

  /**
   * Day 9 "OK" without Stripe configured (demo, no charge). BillingController refuses it once
   * STRIPE_SECRET_KEY is set. The journey moves to ORDER when the day's story ends.
   */
  async demoOrder(userId: string): Promise<Me> {
    const cur = await this.load(userId);
    // the Sun day, or later as a resident (the Eclipse can be taken any time: D08-S005)
    if (cur.journeyDay < JOURNEY_PAYMENT || cur.orderedAt) return toMe(cur);
    return this.markOrdered(userId, { subscriptionStatus: 'demo' });
  }

  /** Record a paid (or demo) Eclipse. */
  async markOrdered(
    userId: string,
    s: { subscriptionStatus: string; stripeCustomerId?: string | null; stripeSubscriptionId?: string | null },
  ): Promise<Me> {
    const [u] = await this.db.write
      .update(users)
      .set({ ...s, orderedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.orderedAt)))
      .returning();
    if (!u) return this.getMe(userId);
    await this.grantMonth(userId);
    return toMe(u);
  }
}
