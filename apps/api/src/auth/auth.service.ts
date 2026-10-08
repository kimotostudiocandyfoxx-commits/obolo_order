import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { EntryKind, Locale, VerifyResult } from '@obolo/shared';
import { and, desc, eq, gt } from 'drizzle-orm';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { AppConfig, CONFIG } from '../config';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { invites, users } from '../db/schema';
import type { EmailSender } from '../infra/email';
import type { KvStore } from '../infra/kv';
import { EMAIL, KV } from '../infra/tokens';
import { toMe } from '../users/users.service';
import { sessionKey } from './auth.guard';

const CODE_TTL_SEC = 10 * 60;
const MAX_ATTEMPTS = 5;

/**
 * Email one-time-code login for EXISTING members (accounts are created only from invitations). Spec §4.2 asks for email + passkey/WebAuthn; passkeys are
 * PLACEHOLDER (P-AUTH-1) because the relying-party domain is not final while we run on
 * changing Vercel preview URLs. Parental consent for minors is OPEN #5 (P-AUTH-3).
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
    @Inject(EMAIL) private readonly email: EmailSender,
    private readonly db: Database,
  ) {}

  private hash(email: string, code: string) {
    return createHash('sha256').update(`${email}:${code}`).digest();
  }

  /** The pending, unexpired invitation for an email (newest first), if any. */
  private async pendingInvite(email: string) {
    const [inv] = await this.db.write
      .select()
      .from(invites)
      .where(and(eq(invites.email, email), eq(invites.status, 'pending'), gt(invites.expiresAt, new Date())))
      .orderBy(desc(invites.createdAt))
      .limit(1);
    return inv ?? null;
  }

  /**
   * Entry screen: everyone starts by typing their email. Members get a login code; invited people
   * get a code that proves the address is theirs, then continue to Day 1. Anyone else is refused.
   * PLACEHOLDER (P-INV-3): this reveals whether an email is known; make it silent once email works.
   */
  async requestCode(email: string, locale: Locale): Promise<{ sent: true; kind: EntryKind; devCode?: string }> {
    const [member] = await this.db.write.select({ id: users.id }).from(users).where(eq(users.email, email));
    const kind: EntryKind | null = member ? 'member' : (await this.pendingInvite(email)) ? 'invited' : null;
    if (!kind) throw apiError(HttpStatus.FORBIDDEN, 'NOT_INVITED', 'Obolo Order is invite-only');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.kv.set(`otp:${email}`, this.hash(email, code).toString('hex'), CODE_TTL_SEC);
    await this.kv.del(`otp-attempts:${email}`);
    const subject = locale === 'ja' ? 'Obolo Order ログインコード' : 'Your Obolo Order login code';
    const text =
      locale === 'ja'
        ? `ログインコード: ${code}\n10分間有効です。心当たりがない場合は無視してください。`
        : `Your login code: ${code}\nValid for 10 minutes. Ignore this email if it wasn't you.`;
    await this.email.send(email, subject, text);
    return this.cfg.AUTH_DEMO_SHOW_CODE ? { sent: true, kind, devCode: code } : { sent: true, kind };
  }

  async verify(email: string, code: string): Promise<VerifyResult> {
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

    const [user] = await this.db.write.select().from(users).where(eq(users.email, email));
    if (user?.suspendedAt) throw apiError(HttpStatus.FORBIDDEN, 'ACCOUNT_SUSPENDED', 'This account is suspended');
    if (user) return { kind: 'member', token: await this.createSession(user.id), user: toMe(user) };
    // Email ownership proven → hand over the invitation; the account is created at the name step.
    const inv = await this.pendingInvite(email);
    if (!inv) throw apiError(HttpStatus.FORBIDDEN, 'NOT_INVITED', 'Obolo Order is invite-only');
    return { kind: 'invited', inviteCode: inv.code, inviterName: inv.inviterName };
  }

  async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.kv.set(sessionKey(token), userId, this.cfg.SESSION_TTL_DAYS * 86400);
    return token;
  }

  async logout(token: string) {
    await this.kv.del(sessionKey(token));
  }
}
