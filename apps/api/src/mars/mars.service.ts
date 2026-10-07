import { HttpStatus, Injectable } from '@nestjs/common';
import type { MarsBackstageBody, MarsBackstageVideo } from '@obolo/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { marsBackstage, mediaObjects } from '../db/schema';

type Row = typeof marsBackstage.$inferSelect;

/**
 * Mars 裏スタジオ (client decision 2026-10-07): every video a member keeps lives here, private —
 * photos on Jupiter, videos on Mars. PLACEHOLDER (P-MARS-4): publishing a kept video to the 星図
 * comes when the Mars timeline is connected to the server.
 */
@Injectable()
export class MarsService {
  constructor(private readonly db: Database) {}

  async backstage(userId: string): Promise<MarsBackstageVideo[]> {
    const rows = await this.db.read
      .select()
      .from(marsBackstage)
      .where(and(eq(marsBackstage.userId, userId), isNull(marsBackstage.deletedAt)))
      .orderBy(desc(marsBackstage.createdAt))
      .limit(300);
    return rows.map(view);
  }

  /** A video upload (POST /media/video) goes into your 裏スタジオ. */
  async keep(userId: string, body: MarsBackstageBody): Promise<MarsBackstageVideo> {
    const [m] = await this.db.write
      .select({ id: mediaObjects.id, url: mediaObjects.url })
      .from(mediaObjects)
      .where(and(eq(mediaObjects.id, body.mediaId), eq(mediaObjects.userId, userId), eq(mediaObjects.kind, 'video'), isNull(mediaObjects.deletedAt)));
    if (!m) throw apiError(HttpStatus.BAD_REQUEST, 'MEDIA_NOT_FOUND', 'Upload the video first');
    let posterUrl: string | null = null;
    if (body.posterUrl) {
      const [p] = await this.db.write
        .select({ url: mediaObjects.url })
        .from(mediaObjects)
        .where(and(eq(mediaObjects.url, body.posterUrl), eq(mediaObjects.userId, userId), eq(mediaObjects.kind, 'poster')));
      posterUrl = p?.url ?? null;
    }
    const [r] = await this.db.write
      .insert(marsBackstage)
      .values({ userId, mediaId: m.id, url: m.url, posterUrl, seconds: body.seconds ?? null, title: body.title ?? '' })
      .returning();
    return view(r);
  }

  async remove(userId: string, id: string): Promise<void> {
    const res = await this.db.write
      .update(marsBackstage)
      .set({ deletedAt: new Date() })
      .where(and(eq(marsBackstage.id, id), eq(marsBackstage.userId, userId), isNull(marsBackstage.deletedAt)))
      .returning({ id: marsBackstage.id });
    if (!res.length) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
  }
}

function view(r: Row): MarsBackstageVideo {
  return { id: r.id, url: r.url, posterUrl: r.posterUrl, seconds: r.seconds, title: r.title, createdAt: r.createdAt.toISOString() };
}
