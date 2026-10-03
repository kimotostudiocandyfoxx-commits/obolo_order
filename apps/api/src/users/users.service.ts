import { HttpStatus, Injectable } from '@nestjs/common';
import type { Locale, Me, UpdateProfileBody } from '@obolo/shared';
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
}
