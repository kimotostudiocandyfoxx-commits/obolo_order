import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DACHI_LINK_HOURS, type DachiLinkAsk, type DachiLinkPeek, type DachiLinkView, type DachiView } from '@obolo/shared';
import { randomBytes } from 'node:crypto';
import { and, eq, or } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { follows, userBlocks, users } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';

const TTL = DACHI_LINK_HOURS * 3600;
interface Link {
  issuer: string;
  exp: number;
  /** the one who opened it and pressed 〔ダチになる〕 */
  opener?: string;
}
const linkKey = (t: string) => `dachilink:${t}`;
const claimKey = (t: string) => `dachilink-claim:${t}`;
const mineKey = (u: string) => `dachilink-mine:${u}`;

/**
 * 〔🤝 ダチの招待状〕 (M-R175): dachi only with people one really knows. No search, no requests from strangers: a link
 * (or its QR) that works once for 48 hours; the first one to open it and press 〔ダチになる〕 holds it, and the giver is
 * asked 「〈名前〉が、ダチの招待状を開きました。ダチになる？」 — only when both press it are they dachi, so a link sent on
 * to someone else does not make a stranger a dachi. No mana, no age limit. Kept in the KV store (it expires by itself).
 */
@Injectable()
export class DachiLinkService {
  constructor(
    private readonly db: Database,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  private async read(token: string): Promise<Link | null> {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
    const raw = await this.kv.get(linkKey(token));
    if (!raw) return null;
    const l = JSON.parse(raw) as Link;
    return l.exp > Date.now() ? l : null;
  }
  private async write(token: string, l: Link) {
    await this.kv.set(linkKey(token), JSON.stringify(l), Math.max(1, Math.ceil((l.exp - Date.now()) / 1000)));
  }
  private async mine(userId: string): Promise<string[]> {
    const raw = await this.kv.get(mineKey(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  }
  private async person(id: string): Promise<DachiView | null> {
    const [u] = await this.db.read.select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl, deletedAt: users.deletedAt }).from(users).where(eq(users.id, id));
    return u && !u.deletedAt ? { id: u.id, displayName: u.displayName, pic: u.avatarUrl } : null;
  }
  private async blocked(a: string, b: string): Promise<boolean> {
    const r = await this.db.read
      .select({ x: userBlocks.blockerId })
      .from(userBlocks)
      .where(or(and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)), and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a))))
      .limit(1);
    return r.length > 0;
  }

  /** 〔🤝 ダチの招待状〕: a new link of one's own */
  async create(userId: string): Promise<DachiLinkView> {
    const token = randomBytes(18).toString('base64url');
    const exp = Date.now() + TTL * 1000;
    await this.write(token, { issuer: userId, exp });
    const live = [];
    for (const t of await this.mine(userId)) if (await this.read(t)) live.push(t);
    await this.kv.set(mineKey(userId), JSON.stringify([...live, token].slice(-20)), TTL);
    return { token, expiresAt: new Date(exp).toISOString() };
  }

  /** what the one who opens the link sees */
  async peek(userId: string, token: string): Promise<DachiLinkPeek> {
    const l = await this.read(token);
    const from = l ? await this.person(l.issuer) : null;
    if (!l || !from) throw apiError(HttpStatus.NOT_FOUND, 'DACHI_LINK_GONE', 'This dachi invitation is no longer open');
    const mine = l.issuer === userId;
    const state = mine ? (l.opener ? 'waiting' : 'open') : !l.opener ? 'open' : l.opener === userId ? 'waiting' : 'gone';
    return { from, state, mine };
  }

  /** the one who opened it presses 〔ダチになる〕: the first one holds the link; the giver is asked next */
  async open(userId: string, token: string): Promise<DachiLinkPeek> {
    const l = await this.read(token);
    if (!l || l.issuer === userId || (await this.blocked(l.issuer, userId))) throw apiError(HttpStatus.NOT_FOUND, 'DACHI_LINK_GONE', 'This dachi invitation is no longer open');
    if (!l.opener) {
      // only the first one to press it holds it (a link sent on cannot be taken by a second person)
      const n = await this.kv.incr(claimKey(token), TTL);
      if (n === 1) {
        l.opener = userId;
        await this.write(token, l);
      }
    }
    return this.peek(userId, token);
  }

  /** the giver's side: whose answer is waiting for theirs */
  async asks(userId: string): Promise<DachiLinkAsk[]> {
    const out: DachiLinkAsk[] = [];
    for (const t of await this.mine(userId)) {
      const l = await this.read(t);
      if (!l?.opener) continue;
      const who = await this.person(l.opener);
      if (who) out.push({ token: t, who });
    }
    return out;
  }

  /** the giver presses 〔ダチになる〕 too: now they are dachi (both ways), and the link is used up */
  async confirm(userId: string, token: string): Promise<DachiView> {
    const l = await this.read(token);
    if (!l || l.issuer !== userId || !l.opener) throw apiError(HttpStatus.NOT_FOUND, 'DACHI_LINK_GONE', 'This dachi invitation is no longer open');
    const who = await this.person(l.opener);
    if (!who || (await this.blocked(userId, l.opener))) throw apiError(HttpStatus.NOT_FOUND, 'DACHI_LINK_GONE', 'This dachi invitation is no longer open');
    await this.db.write
      .insert(follows)
      .values([
        { followerId: userId, followeeId: l.opener },
        { followerId: l.opener, followeeId: userId },
      ])
      .onConflictDoNothing();
    await this.end(userId, token);
    return who;
  }

  /** 〔やめる〕 (the giver): the link no longer opens */
  async end(userId: string, token: string): Promise<void> {
    const l = await this.read(token);
    if (l && l.issuer !== userId) return;
    await this.kv.del(linkKey(token));
    await this.kv.del(claimKey(token));
    await this.kv.set(mineKey(userId), JSON.stringify((await this.mine(userId)).filter((t) => t !== token)), TTL);
  }
}
