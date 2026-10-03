import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { idempotencyKey } from '@obolo/ledger';
import type { Locale } from '@obolo/shared';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { AppConfig, CONFIG } from '../config';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { users, wallets } from '../db/schema';
import type { EmailSender } from '../infra/email';
import type { KvStore } from '../infra/kv';
import { EMAIL, KV } from '../infra/tokens';
import { toMe } from '../users/users.service';
import { LedgerService } from '../wallet/ledger.service';
import { sessionKey } from './auth.guard';

const CODE_TTL_SEC = 10 * 60;
const MAX_ATTEMPTS = 5;

/**
 * Email one-time-code login. Spec §4.2 asks for email + passkey/WebAuthn; passkeys are
 * PLACEHOLDER (P-AUTH-1) because the relying-party domain is not final while we run on
 * changing Vercel preview URLs. Parental consent for minors is OPEN #5 (P-AUTH-3).
 */
@Injectable()
export class AuthService {
  private readonly log = new Logger('Auth');
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
    @Inject(EMAIL) private readonly email: EmailSender,
    private readonly db: Database,
    private readonly ledger: LedgerService,
  ) {}

  private hash(email: string, code: string) {
    return createHash('sha256').update(`${email}:${code}`).digest();
  }

  async requestCode(email: string, locale: Locale): Promise<{ sent: true; devCode?: string }> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.kv.set(`otp:${email}`, this.hash(email, code).toString('hex'), CODE_TTL_SEC);
    await this.kv.del(`otp-attempts:${email}`);
    const subject = locale === 'ja' ? 'Obolo Order ログインコード' : 'Your Obolo Order login code';
    const text =
      locale === 'ja'
        ? `ログインコード: ${code}\n10分間有効です。心当たりがない場合は無視してください。`
        : `Your login code: ${code}\nValid for 10 minutes. Ignore this email if it wasn't you.`;
    await this.email.send(email, subject, text);
    return this.cfg.AUTH_DEMO_SHOW_CODE ? { sent: true, devCode: code } : { sent: true };
  }

  async verify(email: string, code: string, locale: Locale) {
    const stored = await this.kv.get(`otp:${email}`);
    if (!stored) throw apiError(HttpStatus.BAD_REQUEST, 'CODE_EXPIRED', 'Code expired, request a new one');
    const attempts = await this.kv.incr(`otp-attempts:${email}`, CODE_TTL_SEC);
    if (attempts > MAX_ATTEMPTS) {
      await this.kv.del(`otp:${email}`);
      throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'TOO_MANY_ATTEMPTS', 'Too many attempts, request a new code');
    }
    const ok = timingSafeEqual(Buffer.from(stored, 'hex'), this.hash(email, code));
    if (!ok) throw apiError(HttpStatus.BAD_REQUEST, 'CODE_INVALID', 'Wrong code');
    await this.kv.del(`otp:${email}`);

    const { user, isNew } = await this.findOrCreateUser(email, locale);
    const token = randomBytes(32).toString('base64url');
    await this.kv.set(sessionKey(token), user.id, this.cfg.SESSION_TTL_DAYS * 86400);
    return { token, user: toMe(user), isNew };
  }

  async logout(token: string) {
    await this.kv.del(sessionKey(token));
  }

  private async findOrCreateUser(email: string, locale: Locale) {
    const [existing] = await this.db.write.select().from(users).where(eq(users.email, email));
    if (existing) return { user: existing, isNew: false };

    const base =
      email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 12) || 'star';
    const handle = `${base.length >= 3 ? base : `${base}star`}_${randomBytes(2).toString('hex')}`;
    const user = await this.db.write.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ email, handle, displayName: base, locale })
        .onConflictDoNothing({ target: users.email })
        .returning();
      if (!u) return null; // concurrent sign-up with the same email won the race
      await tx.insert(wallets).values({ userId: u.id });
      if (this.cfg.DEMO_SIGNUP_GRANT_MANA > 0) {
        // PLACEHOLDER (P-WALLET-1): stands in for the monthly 88 MANA subscription grant.
        await this.ledger.applyMana(tx, {
          userId: u.id,
          delta: this.cfg.DEMO_SIGNUP_GRANT_MANA,
          reason: 'demo_grant',
          idempotencyKey: idempotencyKey('signup-grant', u.id, 'v1'),
        });
      }
      return u;
    });
    if (!user) {
      const [u] = await this.db.write.select().from(users).where(eq(users.email, email));
      return { user: u, isNew: false };
    }
    this.log.log(`new user ${user.id}`);
    return { user, isNew: true };
  }
}
