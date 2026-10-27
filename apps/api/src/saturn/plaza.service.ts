import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { LlmProvider, moderateText } from '@obolo/ai';
import { SATURN_LIFETIME_HOURS, type CreatePlazaBody, type PlazaView } from '@obolo/shared';
import { and, count, desc, eq, gt, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { saturnPlazaMembers, saturnPlazas, saturnPosts, users } from '../db/schema';
import { LLM } from '../infra/tokens';

type PlazaRow = typeof saturnPlazas.$inferSelect;

/**
 * ひろば (client decision 2026-10-07): Saturn's みんな tab is a map of named places floating on
 * the rings (日本, 北海道, K-POP好き …). Anyone can make one, join one, search them, and drop voices
 * in them. PLACEHOLDER (P-SAT-13): ordering is by members; drawn island art later.
 * A ひろば may be the maker's own (access 'me', L2-SATURN-S004): only they see it, join it and drop voices
 * in it, and its voices stay out of every other feed.
 */
@Injectable()
export class PlazaService {
  constructor(
    private readonly db: Database,
    @Inject(LLM) private readonly llm: LlmProvider,
  ) {}

  async list(viewerId: string, q?: string, limit = 30): Promise<PlazaView[]> {
    const term = q?.trim().slice(0, 30);
    const rows = await this.db.read
      .select()
      .from(saturnPlazas)
      .where(and(isNull(saturnPlazas.deletedAt), or(eq(saturnPlazas.access, 'open'), eq(saturnPlazas.createdBy, viewerId)), term ? ilike(saturnPlazas.name, `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`) : undefined))
      .orderBy(desc(saturnPlazas.memberCount), saturnPlazas.createdAt)
      .limit(limit);
    return this.views(viewerId, rows);
  }

  async get(viewerId: string, id: string): Promise<PlazaView> {
    const [row] = await this.db.read
      .select()
      .from(saturnPlazas)
      .where(and(eq(saturnPlazas.id, id), isNull(saturnPlazas.deletedAt)));
    if (!row || !this.canEnter(row, viewerId)) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Plaza not found');
    return (await this.views(viewerId, [row]))[0];
  }

  private canEnter(row: Pick<PlazaRow, 'access' | 'createdBy'>, userId: string) {
    return row.access === 'open' || row.createdBy === userId;
  }

  /** Makes a ひろば and joins it (an open name that already exists: you join that one). */
  async create(userId: string, body: CreatePlazaBody): Promise<PlazaView> {
    const name = body.name.replace(/\s+/g, ' ');
    const access = body.access ?? 'open';
    const mod = await moderateText(name, this.llm);
    if (mod.flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'This name breaks the community rules');
    if (access === 'me') {
      const [mine] = await this.db.write.insert(saturnPlazas).values({ name, icon: body.icon, createdBy: userId, access }).returning();
      return this.join(userId, mine.id, true);
    }
    const [same] = await this.db.write.select().from(saturnPlazas).where(and(eq(saturnPlazas.name, name), eq(saturnPlazas.access, 'open'), isNull(saturnPlazas.deletedAt)));
    if (same) return this.join(userId, same.id, true);
    const [row] = await this.db.write.insert(saturnPlazas).values({ name, icon: body.icon, createdBy: userId }).onConflictDoNothing().returning();
    const id = row?.id ?? (await this.db.write.select({ id: saturnPlazas.id }).from(saturnPlazas).where(and(eq(saturnPlazas.name, name), eq(saturnPlazas.access, 'open'))))[0]?.id;
    if (!id) throw apiError(HttpStatus.CONFLICT, 'CONFLICT', 'Could not make the plaza');
    return this.join(userId, id, true);
  }

  async join(userId: string, plazaId: string, on: boolean): Promise<PlazaView> {
    await this.db.write.transaction(async (tx) => {
      const [p] = await tx
        .select({ id: saturnPlazas.id, access: saturnPlazas.access, createdBy: saturnPlazas.createdBy })
        .from(saturnPlazas)
        .where(and(eq(saturnPlazas.id, plazaId), isNull(saturnPlazas.deletedAt)));
      if (!p || (on && !this.canEnter(p, userId))) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Plaza not found');
      const changed = on
        ? (await tx.insert(saturnPlazaMembers).values({ plazaId, userId }).onConflictDoNothing().returning({ u: saturnPlazaMembers.userId })).length
        : -(await tx
            .delete(saturnPlazaMembers)
            .where(and(eq(saturnPlazaMembers.plazaId, plazaId), eq(saturnPlazaMembers.userId, userId)))
            .returning({ u: saturnPlazaMembers.userId })).length;
      if (changed) await tx.update(saturnPlazas).set({ memberCount: sql`GREATEST(${saturnPlazas.memberCount} + ${changed}, 0)` }).where(eq(saturnPlazas.id, plazaId));
    });
    const [row] = await this.db.write.select().from(saturnPlazas).where(eq(saturnPlazas.id, plazaId));
    return (await this.views(userId, [row], this.db.write))[0];
  }

  /** For a post dropped in a ひろば: it must exist; the author joins it. */
  async ensureForPost(userId: string, plazaId: string): Promise<void> {
    const [p] = await this.db.write
      .select({ id: saturnPlazas.id, access: saturnPlazas.access, createdBy: saturnPlazas.createdBy })
      .from(saturnPlazas)
      .where(and(eq(saturnPlazas.id, plazaId), isNull(saturnPlazas.deletedAt)));
    if (!p || !this.canEnter(p, userId)) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Plaza not found');
    await this.join(userId, plazaId, true);
  }

  private async views(viewerId: string, rows: PlazaRow[], db: Database['read'] = this.db.read): Promise<PlazaView[]> {
    const ids = rows.map((r) => r.id);
    if (!ids.length) return [];
    const since = new Date(Date.now() - SATURN_LIFETIME_HOURS * 3600_000);
    const live = and(inArray(saturnPosts.plazaId, ids), isNull(saturnPosts.deletedAt), isNull(saturnPosts.replyToId), gt(saturnPosts.createdAt, since));
    const [mine, counts, recent] = await Promise.all([
      db
        .select({ id: saturnPlazaMembers.plazaId })
        .from(saturnPlazaMembers)
        .where(and(eq(saturnPlazaMembers.userId, viewerId), inArray(saturnPlazaMembers.plazaId, ids))),
      db.select({ id: saturnPosts.plazaId, n: count() }).from(saturnPosts).where(live).groupBy(saturnPosts.plazaId),
      // a few faces per island: the latest speakers there
      db
        .select({ plazaId: saturnPosts.plazaId, id: users.id, neoForm: users.neoForm, look: users.lookJson, pic: users.puniPicUrl })
        .from(saturnPosts)
        .innerJoin(users, eq(users.id, saturnPosts.userId))
        .where(live)
        .orderBy(desc(saturnPosts.createdAt))
        .limit(Math.min(400, ids.length * 40)),
    ]);
    const joined = new Set(mine.map((m) => m.id));
    const n = new Map(counts.map((c) => [c.id, c.n]));
    const faces = new Map<string, PlazaView['faces']>();
    for (const r of recent) {
      if (!r.plazaId) continue;
      const list = faces.get(r.plazaId) ?? [];
      if (list.length < 7 && !list.some((f) => f.id === r.id)) list.push({ id: r.id, neoForm: r.neoForm, look: r.look, pic: r.pic });
      faces.set(r.plazaId, list);
    }
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      memberCount: r.memberCount,
      voiceCount: n.get(r.id) ?? 0,
      joined: joined.has(r.id),
      faces: faces.get(r.id) ?? [],
      access: r.access === 'me' ? 'me' : 'open',
    }));
  }
}
