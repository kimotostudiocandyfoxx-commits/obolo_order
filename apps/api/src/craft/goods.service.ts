import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { type LlmProvider, moderateText } from '@obolo/ai';
import { GOODS_PER_DAY, goodsTitle, jstDay, type GoodsMakeBody, type GoodsView } from '@obolo/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { goods, jupiterRoots } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV, LLM } from '../infra/tokens';
import { PlanetWorksService } from '../planets/planet-works.service';
import { seesWork } from '../planets/planet-songs.service';
import { goodsFacts, goodsView, notFound, ownArt, sentTo, type GoodsRow } from './craft.store';

/**
 * Story session 2026-11-25 (グッズ): a goods item from the Moon atelier — a kind and one of the member's own arts. Free:
 * nothing is painted (the app composites the art onto the kind's mock-up), so no confirm and no mana; GOODS_PER_DAY a day.
 * A title said by the member goes through the words check; {bati}'s own (the art's title + the kind) is from words that
 * passed it already. Tagged at making (goodsTags: the kind, the art's style and moods) and again when flown to Uranus.
 */
@Injectable()
export class GoodsService {
  constructor(
    private readonly db: Database,
    @Inject(KV) private readonly kv: KvStore,
    @Inject(LLM) private readonly modLlm: LlmProvider,
    @Optional() private readonly works?: PlanetWorksService,
  ) {}

  protected async own(userId: string, id: string): Promise<GoodsRow> {
    const [row] = await this.db.write
      .select()
      .from(goods)
      .where(and(eq(goods.id, id), eq(goods.userId, userId), isNull(goods.deletedAt)));
    if (!row) throw notFound('Goods');
    return row;
  }

  /** the art's spell (its style and moods are the goods' moods); none: a photo, or the art is gone */
  protected async artSpell(rootId: string | null) {
    if (!rootId) return null;
    const [r] = await this.db.read.select({ spell: jupiterRoots.spellJson }).from(jupiterRoots).where(eq(jupiterRoots.id, rootId)).limit(1);
    return r?.spell ?? null;
  }

  async make(userId: string, b: GoodsMakeBody): Promise<GoodsView> {
    const art = await ownArt(this.db, userId, b.rootId);
    if (!art) throw notFound('Art');
    if (b.title && (await moderateText(b.title, this.modLlm)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'その言葉は使えません');
    const n = await this.kv.incr(`goods-day:${userId}:${jstDay(new Date().toISOString())}`, 30 * 3600);
    if (n > GOODS_PER_DAY) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'GOODS_LIMIT', '今日は、もうたくさん作ったね');
    const [row] = await this.db.write
      .insert(goods)
      .values({ userId, kind: b.kind, rootId: art.id, artUrl: art.url, title: b.title || goodsTitle(b.kind, art.title) })
      .returning();
    await this.works?.tag('goods', row.id, goodsFacts(row, art.spellJson));
    return goodsView(row);
  }

  async list(userId: string): Promise<GoodsView[]> {
    const rows = await this.db.read
      .select()
      .from(goods)
      .where(and(eq(goods.userId, userId), isNull(goods.deletedAt)))
      .orderBy(desc(goods.createdAt))
      .limit(200);
    return rows.map(goodsView);
  }

  /** the maker's own, one a ダチ was sent, or (flown) one the viewer's Uranus home reaches */
  async read(viewerId: string, id: string): Promise<GoodsView> {
    const [row] = await this.db.read
      .select()
      .from(goods)
      .where(and(eq(goods.id, id), isNull(goods.deletedAt)));
    if (!row || (row.userId !== viewerId && !(await sentTo(this.db, row.userId, viewerId, id)) && !(row.flownAt && (await seesWork(this.db, viewerId, 'uranus', id))))) throw notFound('Goods');
    return goodsView(row);
  }

  /** to the Uranus home (its 88 hours start now; tagged again); `on: false` brings it back to the Moon */
  async fly(userId: string, id: string, on = true): Promise<{ id: string; flownAt: string | null }> {
    const row = await this.own(userId, id);
    const flownAt = on ? new Date() : null;
    await this.db.write.update(goods).set({ flownAt, updatedAt: new Date() }).where(eq(goods.id, row.id));
    if (on) await this.works?.tag('goods', row.id, goodsFacts(row, await this.artSpell(row.rootId)));
    return { id: row.id, flownAt: flownAt?.toISOString() ?? null };
  }
}
