import { Body, Controller, Get, Injectable, Inject, Put, UseGuards } from '@nestjs/common';
import { CastOshiBody, CastSaveBody, isCastOshiKey, type CastChoicesView, type CastOshiKey } from '@obolo/shared';
import { and, desc, eq } from 'drizzle-orm';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import { Database } from '../db/db';
import { castChoices } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';

/** at most this many ☆ cast works are kept per member (there are 20 × 8 of them) */
const MAX_SAVES = 200;

/**
 * Client 2026-11-28: the homes' residents (the app's own characters — static files of the web app, no accounts) are the
 * member's oshi from the start; what the member changes is kept here, per member (cast_choices):
 *  - ♡ off for a resident: they no longer come to the member's homes (♡ on again: they come back);
 *  - ☆ a cast work: kept in the member's Bluena (its id cast-<key>-<planet>), ☆ again: out of it.
 * Nothing else reads these rows: the residents are not members, so the homecoming report and the ★ counters (which
 * count bluena_saves of members' works) are untouched. There is no report for the cast (they are the app's own).
 */
@Injectable()
export class CastChoicesService {
  constructor(private readonly db: Database) {}

  async view(userId: string): Promise<CastChoicesView> {
    const rows = await this.db.read
      .select({ what: castChoices.what, key: castChoices.key, at: castChoices.createdAt })
      .from(castChoices)
      .where(eq(castChoices.userId, userId))
      .orderBy(desc(castChoices.createdAt))
      .limit(MAX_SAVES + 64);
    return {
      unoshi: rows.filter((r) => r.what === 'unoshi' && isCastOshiKey(r.key)).map((r) => r.key as CastOshiKey),
      saved: rows.filter((r) => r.what === 'save').map((r) => ({ id: r.key, savedAt: r.at.toISOString() })),
    };
  }

  protected async set(userId: string, what: 'unoshi' | 'save', key: string, on: boolean): Promise<void> {
    if (on) await this.db.write.insert(castChoices).values({ userId, what, key }).onConflictDoNothing();
    else await this.db.write.delete(castChoices).where(and(eq(castChoices.userId, userId), eq(castChoices.what, what), eq(castChoices.key, key)));
  }

  /** ♡ on (the default: no row) / off (a row 'unoshi') */
  async oshi(userId: string, b: CastOshiBody): Promise<CastChoicesView> {
    await this.set(userId, 'unoshi', b.key, !b.on);
    return this.view(userId);
  }

  /** ☆ into Bluena / out of it */
  async save(userId: string, b: CastSaveBody): Promise<CastChoicesView> {
    if (b.on && (await this.view(userId)).saved.length >= MAX_SAVES) return this.view(userId);
    await this.set(userId, 'save', b.id, b.on);
    return this.view(userId);
  }
}

@Controller('me/cast')
@UseGuards(AuthGuard)
export class CastChoicesController {
  constructor(
    private readonly cast: CastChoicesService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get()
  view(@UserId() userId: string) {
    return this.cast.view(userId);
  }

  @Put('oshi')
  async oshi(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `cast-choice:${userId}`, 120, 600);
    return this.cast.oshi(userId, parseBody(CastOshiBody, body));
  }

  @Put('save')
  async save(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `cast-choice:${userId}`, 120, 600);
    return this.cast.save(userId, parseBody(CastSaveBody, body));
  }
}
