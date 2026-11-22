import { HttpStatus, Injectable } from '@nestjs/common';
import type { PlanetWorkKind, PlanetWorkReportBody } from '@obolo/shared';
import { and, eq } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { jupiterPosts, planetPosts, radioShows, saturnPosts, userReports, workHides } from '../db/schema';

/**
 * M-R213: a stranger's work on a planet's wide place carries 〔通報〕 and 〔見えなくする〕.
 *  - hide: per viewer and kept (work_hides); every planet's feed leaves it out for them (common/child.ts notHidden)
 *  - report: into user_reports, the same list the team already reviews (kind saturn-post / jupiter-post / planet-post /
 *    radio-show)
 */
@Injectable()
export class WorkSafetyService {
  constructor(private readonly db: Database) {}

  /** the work's maker (null when it does not exist) */
  protected async author(kind: PlanetWorkKind, id: string): Promise<string | null> {
    const t = kind === 'saturn_post' ? saturnPosts : kind === 'jupiter_post' ? jupiterPosts : kind === 'planet_post' ? planetPosts : radioShows;
    const [r] = await this.db.read.select({ u: t.userId }).from(t).where(eq(t.id, id));
    return r?.u ?? null;
  }

  async hide(userId: string, kind: PlanetWorkKind, id: string, on: boolean): Promise<{ hidden: boolean }> {
    if (on) {
      const by = await this.author(kind, id);
      if (!by || by === userId) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
      await this.db.write.insert(workHides).values({ userId, kind, targetId: id }).onConflictDoNothing();
    } else {
      await this.db.write.delete(workHides).where(and(eq(workHides.userId, userId), eq(workHides.kind, kind), eq(workHides.targetId, id)));
    }
    return { hidden: on };
  }

  async report(userId: string, kind: PlanetWorkKind, id: string, body: PlanetWorkReportBody): Promise<void> {
    const by = await this.author(kind, id);
    if (!by || by === userId) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
    await this.db.write.insert(userReports).values({ reporterId: userId, targetUserId: by, kind: kind.replace('_', '-'), targetId: id, reason: body.reason, note: body.note ?? '' });
  }
}
