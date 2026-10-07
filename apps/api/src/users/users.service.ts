import { HttpStatus, Injectable } from '@nestjs/common';
import {
  JOURNEY_DONE,
  JOURNEY_PAYMENT,
  JOURNEY_WAIT_MS,
  type CompleteJourneyDayBody,
  type Locale,
  type Me,
  type UpdateProfileBody,
} from '@obolo/shared';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { users } from '../db/schema';

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
    neoForm: u.neoForm,
    avatarUrl: u.avatarUrl,
    bati: u.batiFood ? { food: u.batiFood, name: u.batiName, imageUrl: u.batiImageUrl } : null,
    orderedAt: u.orderedAt?.toISOString() ?? null,
    voices: { self: !!u.voiceSelfId, bati: !!u.voiceBatiId },
    look: u.lookJson ?? null,
    puniPic: u.puniPicUrl ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly db: Database) {}

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
    const { look, ...rest } = body;
    const [u] = await this.db.write
      .update(users)
      .set({ ...rest, ...(look !== undefined ? { lookJson: look } : {}), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return toMe(u);
  }

  private async load(userId: string) {
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    return u;
  }

  /**
   * The story of `day` was finished. Idempotent; never moves the journey backwards.
   * Day 9 (the Eclipse day) can only be finished after paying; the next day is ORDER (10).
   */
  async completeJourneyDay(userId: string, body: CompleteJourneyDayBody): Promise<Me> {
    const cur = await this.load(userId);
    if (cur.journeyDay !== body.day || cur.journeyCompletedAt) return toMe(cur);
    if (body.day === JOURNEY_PAYMENT && !cur.orderedAt) throw apiError(HttpStatus.PAYMENT_REQUIRED, 'ORDER_REQUIRED', 'The Eclipse has not been paid for');
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
   * Start the next day: allowed 24 h after the current day was finished, or immediately with
   * skip ("明日まで待てへん"). PLACEHOLDER (P-OB-3): skipping is free and unlimited for now.
   */
  async advanceJourney(userId: string, skip: boolean): Promise<Me> {
    const cur = await this.load(userId);
    if (!cur.journeyCompletedAt || cur.journeyDay >= JOURNEY_DONE) return toMe(cur);
    if (!skip && Date.now() < cur.journeyCompletedAt.getTime() + JOURNEY_WAIT_MS) {
      throw apiError(HttpStatus.CONFLICT, 'NOT_YET', 'The next day has not opened yet');
    }
    const [u] = await this.db.write
      .update(users)
      .set({ journeyDay: cur.journeyDay + 1, journeyCompletedAt: null, updatedAt: new Date() })
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
    if (cur.journeyDay !== JOURNEY_PAYMENT || cur.orderedAt) return toMe(cur);
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
    return u ? toMe(u) : this.getMe(userId);
  }
}
