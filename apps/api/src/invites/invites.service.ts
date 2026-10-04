import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { idempotencyKey } from '@obolo/ledger';
import type { InviteView, Locale, MyInviteView } from '@obolo/shared';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { AppConfig, CONFIG } from '../config';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { invites, users, wallets } from '../db/schema';
import type { EmailSender } from '../infra/email';
import { EMAIL } from '../infra/tokens';
import { toMe } from '../users/users.service';
import { LedgerService } from '../wallet/ledger.service';

/** PLACEHOLDER (P-INV-1): how many invitations a member may send per 30 days. */
export const INVITES_PER_MONTH = 10;

const toView = (i: typeof invites.$inferSelect): InviteView => ({
  code: i.code,
  inviterName: i.inviterName,
  status: i.status === 'pending' && i.expiresAt < new Date() ? 'expired' : (i.status as InviteView['status']),
  expiresAt: i.expiresAt.toISOString(),
});

@Injectable()
export class InvitesService {
  private readonly log = new Logger('Invites');
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(EMAIL) private readonly email: EmailSender,
    private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly auth: AuthService,
  ) {}

  async get(code: string): Promise<InviteView> {
    const [i] = await this.db.read.select().from(invites).where(eq(invites.code, code));
    if (!i) throw apiError(HttpStatus.NOT_FOUND, 'INVITE_NOT_FOUND', 'Invitation not found');
    return toView(i);
  }

  async listMine(userId: string): Promise<MyInviteView[]> {
    const rows = await this.db.read
      .select()
      .from(invites)
      .where(eq(invites.inviterUserId, userId))
      .orderBy(desc(invites.createdAt))
      .limit(50);
    return rows.map((r) => ({ ...toView(r), email: r.email, createdAt: r.createdAt.toISOString() }));
  }

  /** A member invites someone. */
  async createByMember(userId: string, email: string) {
    const [me] = await this.db.write.select().from(users).where(eq(users.id, userId));
    if (!me) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    const since = new Date(Date.now() - 30 * 86400_000);
    const [{ n }] = await this.db.write
      .select({ n: sql<number>`count(*)::int` })
      .from(invites)
      .where(and(eq(invites.inviterUserId, userId), gte(invites.createdAt, since)));
    if (n >= INVITES_PER_MONTH) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'INVITE_LIMIT', 'Invitation limit reached');
    return this.create(email, me.displayName, me.id, me.locale as Locale);
  }

  /** Operator-issued invitation (bootstraps the first members). */
  createByAdmin(email: string, inviterName: string) {
    return this.create(email, inviterName, null, 'ja');
  }

  private async create(email: string, inviterName: string, inviterUserId: string | null, locale: Locale) {
    const [member] = await this.db.write.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (member) throw apiError(HttpStatus.CONFLICT, 'ALREADY_MEMBER', 'This person is already a member');
    const code = randomBytes(12).toString('base64url');
    const [row] = await this.db.write
      .insert(invites)
      .values({
        code,
        email,
        inviterName,
        inviterUserId,
        expiresAt: new Date(Date.now() + this.cfg.INVITE_TTL_DAYS * 86400_000),
      })
      .returning();
    if (this.cfg.WEB_ORIGIN) {
      const url = `${this.cfg.WEB_ORIGIN.replace(/\/$/, '')}/invite/${code}`;
      const subject = locale === 'ja' ? '招待信号を受信しました — OBOLO ORDER' : 'An invitation signal has arrived — OBOLO ORDER';
      const text =
        locale === 'ja'
          ? `${inviterName} から OBOLO ORDER 本部への招待が届いています。\n\n${url}\n\nこのリンクは${this.cfg.INVITE_TTL_DAYS}日間有効です。`
          : `${inviterName} has invited you to OBOLO ORDER headquarters.\n\n${url}\n\nThis link is valid for ${this.cfg.INVITE_TTL_DAYS} days.`;
      await this.email.send(email, subject, text).catch((e) => this.log.warn(`invite email failed: ${String(e)}`));
    }
    return { ...toView(row), email: row.email, createdAt: row.createdAt.toISOString() };
  }

  /** Visitor tells OBOLON their name → the account is created and a session issued. */
  async accept(code: string, displayName: string) {
    const created = await this.db.write.transaction(async (tx) => {
      const [inv] = await tx.select().from(invites).where(eq(invites.code, code)).for('update');
      if (!inv) throw apiError(HttpStatus.NOT_FOUND, 'INVITE_NOT_FOUND', 'Invitation not found');
      if (inv.status === 'accepted') throw apiError(HttpStatus.CONFLICT, 'INVITE_USED', 'Invitation already used');
      if (inv.status !== 'pending' || inv.expiresAt < new Date()) {
        throw apiError(HttpStatus.GONE, 'INVITE_EXPIRED', 'Invitation expired');
      }
      const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, inv.email));
      if (existing) throw apiError(HttpStatus.CONFLICT, 'ALREADY_MEMBER', 'Already a member — log in on Earth');

      const handle = `order_${randomBytes(3).toString('hex')}`;
      const [u] = await tx
        .insert(users)
        .values({
          email: inv.email,
          handle,
          displayName,
          locale: 'ja',
          invitedByUserId: inv.inviterUserId,
          invitedByName: inv.inviterName,
          journeyDay: 1,
        })
        .returning();
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
      await tx
        .update(invites)
        .set({ status: 'accepted', acceptedUserId: u.id, acceptedAt: new Date() })
        .where(eq(invites.id, inv.id));
      return u;
    });
    this.log.log(`invite accepted → user ${created.id}`);
    return { token: await this.auth.createSession(created.id), user: toMe(created), isNew: true };
  }
}
