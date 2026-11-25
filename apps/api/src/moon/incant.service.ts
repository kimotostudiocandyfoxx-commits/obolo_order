import { Inject, Injectable, Logger } from '@nestjs/common';
import { premiumRequest, premiumWords, type IncantView } from '@obolo/shared';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { users } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { activeMember } from '../users/tester';
import { livePrice } from '../wallet/price-book';

/** how long the passphrase's grant lasts (the spell laid out, changed and said yes to) */
export const PREMIUM_GRANT_SEC = 60 * 60;
export const grantKey = (userId: string, grant: string) => `premium-grant:${userId}:${grant}`;
/**
 * the passphrase (client 2026-11-25: 「上級魔法で」 — 「上級魔法で、夏の曲を唱えて」「上級魔法でお願い」, its reading in kana too);
 * PREMIUM_SPELL_WORDS replaces it. Kept here only (the server), never in the web or the story.
 */
export const PREMIUM_WORDS_DEFAULT = ['上級魔法で', 'じょうきゅうまほうで', 'ジョウキュウマホウで'];

/**
 * R17 (client 2026-11-25): the secret spell. Never listed, never offered: only an Obolo Order member (activeMember) who
 * says its passphrase to {bati} (PREMIUM_SPELL_WORDS; default 「上級魔法で」) gets a grant — the song made with it is sung
 * by the premium engine at its own price. Anyone else, or with PREMIUM_SPELL=off, gets the same answer as any other
 * words ({ premium: false }): no sign the spell exists. The passphrase is only on the server.
 */
@Injectable()
export class IncantService {
  private readonly log = new Logger('Incant');
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly db: Database,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  async incant(userId: string, said: string): Promise<IncantView> {
    if (this.cfg.PREMIUM_SPELL === 'off' || !this.cfg.MUSIC_RUNWARE_KEY) return { premium: false };
    const request = premiumRequest(said, premiumWords(this.cfg.PREMIUM_SPELL_WORDS, PREMIUM_WORDS_DEFAULT));
    if (request === null) return { premium: false };
    if (!(await this.member(userId))) return { premium: false };
    const grant = randomUUID();
    await this.kv.set(grantKey(userId, grant), '1', PREMIUM_GRANT_SEC);
    this.log.log(`secret spell granted to ${userId}`);
    return { premium: true, grant, price: await this.price(), request };
  }

  /** whether this grant is the member's own and still good (and the spell is still on) */
  async check(userId: string, grant: string): Promise<boolean> {
    if (this.cfg.PREMIUM_SPELL === 'off' || !this.cfg.MUSIC_RUNWARE_KEY) return false;
    if (!(await this.kv.get(grantKey(userId, grant)))) return false;
    return this.member(userId);
  }

  /** what the secret spell costs now: the price rule's live quote (the same the charge takes) */
  protected price(): Promise<number> {
    return livePrice('songPremium');
  }

  protected async member(userId: string): Promise<boolean> {
    const [u] = await this.db.read.select({ id: users.id, email: users.email, orderedAt: users.orderedAt, subscriptionStatus: users.subscriptionStatus }).from(users).where(eq(users.id, userId));
    return activeMember(u, this.cfg);
  }
}
