import { Injectable } from '@nestjs/common';
import { DELIVERY_HOURS, type DachiView, type DeliverBody, type DeliveryView } from '@obolo/shared';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { Database } from '../db/db';
import { deliveries, follows, invites, users } from '../db/schema';

const toDachi = (u: { id: string; displayName: string; avatarUrl: string | null }): DachiView => ({ id: u.id, displayName: u.displayName, pic: u.avatarUrl });

/**
 * ダチ (story draft 21, M-R124): the dachi are mutual follows. On the first journey they are {inviter} (made
 * dachi on Saturn, D04-S005c) and KIMORIN⭐︎ (a story character: the app shows him, no account). Delivering a
 * work puts it in each dachi's 〔推し〕 for 88 hours; nothing is counted or shown back to the sender.
 */
@Injectable()
export class DachiService {
  constructor(private readonly db: Database) {}

  /** the dachi: people who follow you and whom you follow, minus anyone blocked either way */
  async list(userId: string): Promise<DachiView[]> {
    const rows = await this.db.read
      .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(
        sql`${users.id} IN (SELECT f.followee_id FROM follows f JOIN follows g ON g.follower_id = f.followee_id AND g.followee_id = f.follower_id WHERE f.follower_id = ${userId})
          AND ${users.id} NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ${userId})
          AND ${users.id} NOT IN (SELECT blocker_id FROM user_blocks WHERE blocked_id = ${userId})
          AND ${users.deletedAt} IS NULL`,
      );
    return rows.map(toDachi);
  }

  /** D04-S005c: the one who invited you becomes your dachi (both ways). Idempotent; no inviter → nothing. */
  async befriendInviter(userId: string): Promise<DachiView | null> {
    const [inv] = await this.db.read
      .select({ inviter: invites.inviterUserId })
      .from(invites)
      .where(and(eq(invites.acceptedUserId, userId), eq(invites.status, 'accepted')))
      .limit(1);
    if (!inv?.inviter || inv.inviter === userId) return null;
    await this.db.write
      .insert(follows)
      .values([
        { followerId: userId, followeeId: inv.inviter },
        { followerId: inv.inviter, followeeId: userId },
      ])
      .onConflictDoNothing();
    const [u] = await this.db.read.select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, inv.inviter));
    return u ? toDachi(u) : null;
  }

  /** 〔ダチへ〕: one row per dachi now. Returns how many it went to (not shown on screen: no numbers). */
  async deliver(userId: string, body: DeliverBody): Promise<{ to: number }> {
    const dachi = await this.list(userId);
    if (!dachi.length) return { to: 0 };
    await this.db.write.insert(deliveries).values(
      dachi.map((d) => ({ fromUserId: userId, toUserId: d.id, kind: body.kind, title: body.title, text: body.text, url: body.url ?? null, posterUrl: body.posterUrl ?? null, refId: body.refId ?? null })),
    );
    return { to: dachi.length };
  }

  /** 〔推し〕: what the dachi delivered to you in the last 88 hours, newest first (8 at a time on screen) */
  async oshi(userId: string, kind?: string): Promise<DeliveryView[]> {
    const since = new Date(Date.now() - DELIVERY_HOURS * 3600_000);
    const rows = await this.db.read
      .select({ d: deliveries, from: { id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl } })
      .from(deliveries)
      .innerJoin(users, eq(users.id, deliveries.fromUserId))
      .where(
        and(
          eq(deliveries.toUserId, userId),
          gt(deliveries.createdAt, since),
          kind ? eq(deliveries.kind, kind) : undefined,
          sql`${deliveries.fromUserId} NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ${userId})`,
        ),
      )
      .orderBy(desc(deliveries.createdAt))
      .limit(40);
    return rows.map(({ d, from }) => ({
      id: d.id,
      kind: d.kind as DeliveryView['kind'],
      title: d.title,
      text: d.text,
      url: d.url,
      posterUrl: d.posterUrl,
      from: toDachi(from),
      createdAt: d.createdAt.toISOString(),
      returnsAt: new Date(d.createdAt.getTime() + DELIVERY_HOURS * 3600_000).toISOString(),
    }));
  }
}
