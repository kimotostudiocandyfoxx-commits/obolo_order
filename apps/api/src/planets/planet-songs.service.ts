import { HttpStatus, Injectable } from '@nestjs/common';
import type { PlanetSongView, SongMix, SongPhrase } from '@obolo/shared';
import { and, eq, or, sql, type SQL } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { timedLyrics } from '../compose/lyrics';
import { Database } from '../db/db';
import { planetPosts, planetWorkMeta, songs, users } from '../db/schema';
import { continentWhere } from './continents.service';
import { aroundWhere, ownWhere, storeOf } from './planet-home.service';

/** whoever may see a Mercury song post: its maker; their dachi / 推し (any time, not only its 88 hours); anyone it drifts to */
export function songSeenWhere(viewerId: string): SQL {
  const s = storeOf('mercury')!;
  return or(ownWhere(s, viewerId), aroundWhere(s, viewerId, 'planet_post', new Date(0)), continentWhere(viewerId, 'mercury') ?? sql`FALSE`)!;
}

/**
 * Handoff 02 §2 (M-R288): a Mercury song opened — its sound, jacket and title, and the lyrics with their times, worked out
 * from what the song was made of (the same times the MV burns in). A post with no song behind it, or a song with no words,
 * plays without lyrics. The title read in the maker's voice does not exist yet (null; the opener then reads nothing).
 */
@Injectable()
export class PlanetSongsService {
  constructor(private readonly db: Database) {}

  async song(viewerId: string, id: string): Promise<PlanetSongView> {
    const [r] = (await this.db.read
      .select({ id: planetPosts.id, title: planetPosts.title, url: planetPosts.url, art: planetPosts.posterUrl, seconds: planetPosts.seconds, phrases: songs.phrasesJson, design: songs.designJson, mix: songs.mixJson })
      .from(planetPosts)
      .innerJoin(users, eq(users.id, planetPosts.userId))
      .leftJoin(planetWorkMeta, sql`${planetWorkMeta.kind} = 'planet_post' AND ${planetWorkMeta.workId} = ${planetPosts.id}`)
      .leftJoin(songs, eq(songs.id, planetPosts.sourceId))
      .where(and(eq(planetPosts.id, id), eq(planetPosts.kind, 'song'), sql`${users.deletedAt} IS NULL`, songSeenWhere(viewerId)))
      .limit(1)) as { id: string; title: string; url: string; art: string | null; seconds: number | null; phrases: unknown; design: unknown; mix: unknown }[];
    if (!r) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Song not found');
    const lyrics = Array.isArray(r.phrases) ? timedLyrics(r.phrases as SongPhrase[], r.design as { bpm?: number }, r.mix as SongMix) : [];
    return {
      kind: 'planet_post',
      id: r.id,
      title: r.title,
      url: r.url,
      art: r.art,
      seconds: r.seconds,
      titleVoice: null,
      lyrics: lyrics.map((l) => ({ t: Math.round(l.t * 100) / 100, end: Math.round(l.end * 100) / 100, text: l.text })),
    };
  }
}
