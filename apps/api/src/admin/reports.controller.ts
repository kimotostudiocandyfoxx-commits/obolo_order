import { Body, Controller, Get, Headers, HttpCode, Inject, Ip, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { suspendedKey } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { dmMessages, userReports, users } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { assertAdmin } from './admin.guard';

const ReviewBody = z.object({ status: z.enum(['open', 'reviewed']) });
const SuspendBody = z.object({ on: z.boolean() });
const personCols = { id: users.id, handle: users.handle, displayName: users.displayName, email: users.email, suspendedAt: users.suspendedAt };
/** Suspension flag lifetime in Redis (the DB column is the record; this makes it immediate). */
const SUSPEND_TTL = 10 * 365 * 86400;

/**
 * The team's report review (admin token only): reports from members about mail, calls and people,
 * with the reported conversation for mail; mark them handled, suspend / reinstate the account.
 */
@Controller('admin')
export class AdminReportsController {
  constructor(
    private readonly db: Database,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  private async guard(token: string | undefined, ip: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
  }

  @Get('reports')
  async list(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Query('status') status?: string) {
    await this.guard(token, ip);
    const st = status === 'reviewed' ? 'reviewed' : status === 'all' ? null : 'open';
    const rows = await this.db.read
      .select()
      .from(userReports)
      .where(st ? eq(userReports.status, st) : undefined)
      .orderBy(desc(userReports.createdAt))
      .limit(100);
    const ids = [...new Set(rows.flatMap((r) => [r.reporterId, r.targetUserId]))];
    const people = ids.length ? await this.db.read.select(personCols).from(users).where(inArray(users.id, ids)) : [];
    const by = new Map(people.map((p) => [p.id, { ...p, suspendedAt: p.suspendedAt?.toISOString() ?? null }]));
    const targets = [...new Set(rows.map((r) => r.targetUserId))];
    const counts = targets.length
      ? await this.db.read
          .select({ id: userReports.targetUserId, n: sql<number>`count(*)` })
          .from(userReports)
          .where(inArray(userReports.targetUserId, targets))
          .groupBy(userReports.targetUserId)
      : [];
    const countBy = new Map(counts.map((c) => [c.id, Number(c.n)]));
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        kind: r.kind,
        reason: r.reason,
        note: r.note,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        reporter: by.get(r.reporterId) ?? null,
        target: by.get(r.targetUserId) ?? null,
        /** how many reports this person has had in total (for the team only) */
        targetReports: countBy.get(r.targetUserId) ?? 1,
        // mail: the conversation between the two, latest 30 (what was reported)
        conversation:
          r.kind === 'mail'
            ? (
                await this.db.read
                  .select({ id: dmMessages.id, senderId: dmMessages.senderId, text: dmMessages.text, kind: dmMessages.kind, createdAt: dmMessages.createdAt })
                  .from(dmMessages)
                  .where(
                    and(
                      isNull(dmMessages.deletedAt),
                      or(
                        and(eq(dmMessages.senderId, r.reporterId), eq(dmMessages.recipientId, r.targetUserId)),
                        and(eq(dmMessages.senderId, r.targetUserId), eq(dmMessages.recipientId, r.reporterId)),
                      ),
                    ),
                  )
                  .orderBy(desc(dmMessages.createdAt))
                  .limit(30)
              )
                .reverse()
                .map((m) => ({ id: m.id, fromTarget: m.senderId === r.targetUserId, text: m.kind === 'voice' && !m.text ? '🎤 ボイス' : m.text, createdAt: m.createdAt.toISOString() }))
            : [],
      })),
    );
  }

  @Post('reports/:id')
  @HttpCode(200)
  async review(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await this.guard(token, ip);
    const { status } = parseBody(ReviewBody, body);
    await this.db.write.update(userReports).set({ status }).where(eq(userReports.id, id));
    return { ok: true, status };
  }

  @Post('users/:id/suspend')
  @HttpCode(200)
  async suspend(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await this.guard(token, ip);
    const { on } = parseBody(SuspendBody, body);
    await this.db.write.update(users).set({ suspendedAt: on ? new Date() : null }).where(eq(users.id, id));
    if (on) await this.kv.set(suspendedKey(id), '1', SUSPEND_TTL);
    else await this.kv.del(suspendedKey(id));
    return { ok: true, suspended: on };
  }
}
