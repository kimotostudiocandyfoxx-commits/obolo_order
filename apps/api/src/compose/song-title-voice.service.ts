import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { Database } from '../db/db';
import { planetPosts, songs, users } from '../db/schema';
import type { JobPayloads, JobQueue } from '../infra/queue';
import { QUEUE } from '../infra/tokens';
import { MediaService } from '../media/media.service';
import { canUseMedia } from '../voice/media-consent';
import { VOICE_MODELS, type VoiceModels } from '../voice/voice-models';
import { costScope } from '../wallet/cost-scope';

/** what is kept in songs.design_json.titleVoice */
export interface TitleVoice {
  /** the title as it was read (titleKey) */
  text: string;
  url: string;
  at: string;
}

/** a title as it is read and compared: ASCII spaces / line breaks folded into one space, none at the ends (the same as the backfill's SQL) */
export const titleKey = (t: string) => t.replace(/[ \t\r\n]+/g, ' ').replace(/^ +| +$/g, '');

/** the stored reading of `title` (its URL), only when it is that title's — a post under another title reads nothing */
export function titleVoiceOf(design: unknown, title: string): string | null {
  const v = (design as { titleVoice?: Partial<TitleVoice> } | null)?.titleVoice;
  return v?.url && typeof v.text === 'string' && titleKey(v.text) === titleKey(title) ? v.url : null;
}

/**
 * client 2026-11-25 (Mercury, the story session's answer): when a song is made and its maker has a registered voice (their
 * own Fish voice model, users.voice_self_id, and the consent rules let it be used: canUseMedia), only the title is read in
 * that voice, in the background ('song.title'), kept in their Bluena (MediaService: it counts to their storage) and saved
 * on the song (design_json.titleVoice). No registered voice: nothing is read (titleVoice null). A failure never touches the
 * song (the job is separate; queueing never throws). Mercury's opener plays it with the title's entrance (2.2 s).
 * Cost: part of the song's price (TITLE_VOICE_CHARS in @obolo/shared manaPrice.ts); outside a paid song's making it is
 * absorbed ('titleVoice').
 */
@Injectable()
export class SongTitleVoiceService implements OnModuleInit {
  private readonly log = new Logger('TitleVoice');
  constructor(
    private readonly db: Database,
    private readonly media: MediaService,
    @Inject(QUEUE) private readonly queue: JobQueue,
    @Inject(VOICE_MODELS) private readonly models: VoiceModels,
  ) {}

  onModuleInit() {
    this.queue.register('song.title', (p) => this.make(p));
  }

  /**
   * Queue the title's reading of a song just made (or of the title a post flies under). Never throws; false when there is
   * nothing to read it in. A paid song's making (the scope LedgerService.charge tagged) goes with the job.
   */
  async later(userId: string, songId: string, origin: string, text?: string): Promise<boolean> {
    try {
      if (!(await this.voiceOf(userId))) return false;
      const s = costScope.get();
      const paid = s?.paid && (s.kind === 'song' || s.kind === 'songPremium') ? { kind: s.kind, ...(s.job ? { job: s.job } : {}) } : undefined;
      const key = createHash('sha256')
        .update(`${songId}|${titleKey(text ?? '')}`)
        .digest('hex')
        .slice(0, 24);
      await this.queue.enqueue('song.title', { userId, songId, origin, ...(text ? { text } : {}), ...(paid ? { paid } : {}) }, { dedupeKey: `st-${key}` });
      return true;
    } catch (e) {
      this.log.warn(`title voice not queued for ${songId}: ${String(e)}`);
      return false;
    }
  }

  /** the job: read the title in the maker's voice, keep it, save it on the song */
  async make(p: JobPayloads['song.title']): Promise<void> {
    const s = await this.songOf(p.userId, p.songId);
    if (!s) return;
    const text = titleKey(p.text ?? s.title);
    if (!text || titleVoiceOf(s.design, text)) return;
    const ref = await this.voiceOf(p.userId);
    if (!ref) return;
    if (p.paid) costScope.tag({ kind: p.paid.kind, ...(p.paid.job ? { job: p.paid.job } : {}), paid: true });
    // the reading of the title before (a post under another title): out of the Bluena once the new one is kept
    const old = (s.design as { titleVoice?: Partial<TitleVoice> } | null)?.titleVoice?.url;
    const mp3 = await this.models.speak(ref, text);
    const m = await this.media.storeAudio(p.userId, 'audio/mpeg', mp3, p.origin);
    await this.keep(p.songId, { text, url: m.url, at: new Date().toISOString() });
    if (old && old !== m.url) await this.media.removeByUrl(p.userId, old).catch(() => undefined);
    this.log.log(`title voice of song ${p.songId} made for ${p.userId}`);
  }

  /**
   * Admin backfill: the songs flying on Mercury (live posts) of members with a registered voice whose post title has no
   * reading yet, newest first, `limit` at a time — queued (absorbed: nobody asked for them). Run again until 0.
   */
  async backfill(limit: number, origin: string): Promise<{ queued: number; looked: number }> {
    const rows = await this.backfillRows(limit);
    let queued = 0;
    for (const r of rows) if (await this.later(r.userId, r.songId, origin, r.title)) queued++;
    return { queued, looked: rows.length };
  }

  // --- the database (methods, so the tests stand in for them) -------------------------------------------------------

  /** the member's own voice model, when it may be used (none: null) */
  protected async voiceOf(userId: string): Promise<string | null> {
    if (!this.models.enabled) return null;
    const [u] = await this.db.read.select().from(users).where(eq(users.id, userId));
    return u && !u.deletedAt && u.voiceSelfId && canUseMedia(u) ? u.voiceSelfId : null;
  }

  protected async songOf(userId: string, songId: string): Promise<{ title: string; design: unknown } | undefined> {
    const [r] = await this.db.write
      .select({ title: songs.title, design: songs.designJson })
      .from(songs)
      .where(and(eq(songs.id, songId), eq(songs.userId, userId), isNull(songs.deletedAt)));
    return r;
  }

  /** only the titleVoice key is written (a change saved meanwhile keeps the rest of the design) */
  protected async keep(songId: string, v: TitleVoice): Promise<void> {
    await this.db.write
      .update(songs)
      .set({ designJson: sql`jsonb_set(${songs.designJson}, '{titleVoice}', ${JSON.stringify(v)}::jsonb)`, updatedAt: new Date() })
      .where(eq(songs.id, songId));
  }

  protected async backfillRows(limit: number): Promise<{ userId: string; songId: string; title: string }[]> {
    // titleKey in SQL
    const fold = (x: unknown) => sql`btrim(regexp_replace(${x}, E'[ \\t\\r\\n]+', ' ', 'g'), ' ')`;
    return this.db.read
      .select({ userId: songs.userId, songId: songs.id, title: planetPosts.title })
      .from(planetPosts)
      .innerJoin(songs, eq(songs.id, planetPosts.sourceId))
      .innerJoin(users, eq(users.id, songs.userId))
      .where(
        and(
          eq(planetPosts.planet, 'mercury'),
          eq(planetPosts.kind, 'song'),
          isNull(planetPosts.deletedAt),
          isNull(songs.deletedAt),
          isNull(users.deletedAt),
          isNotNull(users.voiceSelfId),
          sql`${fold(planetPosts.title)} <> ''`,
          sql`(${songs.designJson} -> 'titleVoice' ->> 'text') IS DISTINCT FROM ${fold(planetPosts.title)}`,
        ),
      )
      .orderBy(desc(planetPosts.createdAt))
      .limit(limit);
  }
}
