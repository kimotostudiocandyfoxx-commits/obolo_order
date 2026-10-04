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
    const [u] = await this.db.write
      .update(users)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return toMe(u);
  }

  private async load(userId: string) {
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    return u;
  }

  /** The story of `day` was finished. Idempotent; never moves the journey backwards. */
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
   * Start the next day: allowed 24 h after the current day was finished, or immediately with
   * skip ("明日まで待てへん"). PLACEHOLDER (P-OB-3): skipping is free and unlimited for now.
   */
  async advanceJourney(userId: string, skip: boolean): Promise<Me> {
    const cur = await this.load(userId);
    if (!cur.journeyCompletedAt || cur.journeyDay >= JOURNEY_PAYMENT) return toMe(cur);
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
   * "ORDERになるか？" → yes. PLACEHOLDER (P-BILL-1): Stripe is not wired, so this only marks the
   * user as an ORDER member in demo mode; the real flow must confirm payment first.
   */
  async becomeOrder(userId: string): Promise<Me> {
    const cur = await this.load(userId);
    if (cur.journeyDay !== JOURNEY_PAYMENT) return toMe(cur);
    const [u] = await this.db.write
      .update(users)
      .set({ journeyDay: JOURNEY_DONE, journeyCompletedAt: null, subscriptionStatus: 'demo', updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return toMe(u);
  }
}
