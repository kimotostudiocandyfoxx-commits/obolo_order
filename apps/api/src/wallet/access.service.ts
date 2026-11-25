import { CallHandler, ExecutionContext, HttpStatus, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { CHARGE_ERROR_WORDS, dachiCapped, outOfMana, QUOTA_TIMEZONE, stoppedAtZero, type SpendState } from '@obolo/shared';
import { eq } from 'drizzle-orm';
import type { Observable } from 'rxjs';
import { apiError } from '../common/errors';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { users, wallets } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { activeMember } from '../users/tester';

/** the day (Japan) the daily counts are kept under */
export const accessDay = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: QUOTA_TIMEZONE }).format(now);

/**
 * R18 (client 2026-11-25, shared/access.ts, docs/マナの値段.md 12.): who is stopped at 0 mana. Members never are (their
 * ¥88 covers the small costs); non-members past the first journey are, for making and {bati}'s talk — never for
 * viewing, listening or ダチ.
 */
@Injectable()
export class AccessService {
  constructor(
    private readonly db: Database,
    @Inject(KV) private readonly kv: KvStore,
    @Inject(CONFIG) private readonly cfg: Pick<AppConfig, 'DACHI_DAILY_CAP_FREE'>,
  ) {}

  /** the member / journey / balance of one person (the primary: a gem just bought must count at once) */
  async state(userId: string): Promise<SpendState> {
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    const [w] = await this.db.write.select({ b: wallets.manaBalance }).from(wallets).where(eq(wallets.userId, userId));
    return { member: activeMember(u), journeyDay: u?.journeyDay ?? 1, journeyCompletedAt: u?.journeyCompletedAt ?? null, balance: w?.b ?? 0 };
  }

  /** a non-member past the first journey with no mana */
  async outOfMana(userId: string): Promise<boolean> {
    return outOfMana(await this.state(userId));
  }

  /**
   * One ダチ message (counted for the day). Members: no cap. Non-members: DACHI_DAILY_CAP_FREE a day, then a calm 429
   * until tomorrow. Never stopped at 0 mana.
   */
  async dachiSend(userId: string): Promise<void> {
    const s = await this.state(userId);
    if (s.member) return;
    const n = await this.kv.incr(`dachi-free:${userId}:${accessDay()}`, 2 * 86400);
    if (dachiCapped(false, n, this.cfg.DACHI_DAILY_CAP_FREE))
      throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'DACHI_DAILY_CAP', '今日は、たくさん送ったね。また明日、話そう。');
  }
}

/**
 * The 0-mana stop for the making-side requests (shared STOPPED_AT_ZERO: spells, lyrics, compass, novel chapters, song and
 * video edits, pictures in the talk, reading aloud) — a non-member past the first journey at 0 mana gets the ordinary
 * NO_MANA (the app's gem notice). Runs after the guards (the member is known); anything else passes.
 */
@Injectable()
export class SpendGate implements NestInterceptor {
  constructor(private readonly access: AccessService) {}
  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<{ method: string; path: string; userId?: string }>();
    if (req.userId && stoppedAtZero(req.method, req.path) && (await this.access.outOfMana(req.userId)))
      throw apiError(HttpStatus.PAYMENT_REQUIRED, 'NO_MANA', CHARGE_ERROR_WORDS.NO_MANA);
    return next.handle();
  }
}
