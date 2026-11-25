import { HttpStatus, Injectable } from '@nestjs/common';
import { PLANET_HOMES, type HomePlanet, type PlanetSongView, type SongMix, type SongPhrase } from '@obolo/shared';
import { and, eq, or, sql, type SQL } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { timedLyrics } from '../compose/lyrics';
import { titleVoiceOf } from '../compose/song-title-voice.service';
import { Database } from '../db/db';
import { planetPosts, planetWorkMeta, songs, users } from '../db/schema';
import { continentWhere } from './continents.service';
import { aroundWhere, ownWhere, storeOf } from './planet-home.service';

/** whoever may see a planet's work: its maker; their dachi / 推し (any time, not only its 88 hours); anyone it drifts to */
export function workSeenWhere(viewerId: string, planet: HomePlanet): SQL {
  const s = storeOf(planet);
  const kind = PLANET_HOMES[planet].store;
  if (!s || !kind) return sql`FALSE`;
  return or(ownWhere(s, viewerId), aroundWhere(s, viewerId, kind, new Date(0)), continentWhere(viewerId, planet) ?? sql`FALSE`)!;
}
/** whoever may see a Mercury song post (02 §2) */
export const songSeenWhere = (viewerId: string): SQL => workSeenWhere(viewerId, 'mercury');

/**
 * 05: the viewer may open this work of the planet the way its home does (Neptune: play the game, Pluto: read the book)
 * — the same people as above (a work flown there, not hidden, the maker not blocked)
 */
export async function seesWork(db: Database, viewerId: string, planet: HomePlanet, id: string): Promise<boolean> {
  const s = storeOf(planet);
  if (!s) return false;
  const [hit] = (await db.read
    .select({ id: s.id })
    .from(s.t as never)
    .innerJoin(users, sql`${users.id} = ${s.userId}`)
    .leftJoin(planetWorkMeta, sql`${planetWorkMeta.kind} = ${PLANET_HOMES[planet].store} AND ${planetWorkMeta.workId} = ${s.id}`)
    .where(and(sql`${s.id} = ${id}`, sql`${users.deletedAt} IS NULL`, workSeenWhere(viewerId, planet)))
    .limit(1)) as { id: string }[];
  return !!hit;
}

/**
 * Handoff 02 §2 (M-R288): a Mercury song opened — its sound, jacket and title, and the lyrics with their times, worked out
 * from what the song was made of (the same times the MV burns in). A post with no song behind it, or a song with no words,
 * plays without lyrics. `titleVoice`: the title read in the maker's own voice (client 2026-11-25: made when the song was made
 * by a member with a registered voice — SongTitleVoiceService), only when it is this post's title and the voice is still registered; else null (nothing read).
 */
@Injectable()
export class PlanetSongsService {
  constructor(private readonly db: Database) {}

  async song(viewerId: string, id: string): Promise<PlanetSongView> {
    const [r] = (await this.db.read
      .select({ id: planetPosts.id, title: planetPosts.title, url: planetPosts.url, art: planetPosts.posterUrl, seconds: planetPosts.seconds, phrases: songs.phrasesJson, design: songs.designJson, mix: songs.mixJson, voice: users.voiceSelfId })
      .from(planetPosts)
      .innerJoin(users, eq(users.id, planetPosts.userId))
      .leftJoin(planetWorkMeta, sql`${planetWorkMeta.kind} = 'planet_post' AND ${planetWorkMeta.workId} = ${planetPosts.id}`)
      .leftJoin(songs, eq(songs.id, planetPosts.sourceId))
      .where(and(eq(planetPosts.id, id), eq(planetPosts.kind, 'song'), sql`${users.deletedAt} IS NULL`, songSeenWhere(viewerId)))
      .limit(1)) as { id: string; title: string; url: string; art: string | null; seconds: number | null; phrases: unknown; design: unknown; mix: unknown; voice?: string | null }[];
    if (!r) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Song not found');
    const lyrics = Array.isArray(r.phrases) ? timedLyrics(r.phrases as SongPhrase[], r.design as { bpm?: number }, r.mix as SongMix) : [];
    return {
      kind: 'planet_post',
      id: r.id,
      title: r.title,
      url: r.url,
      art: r.art,
      seconds: r.seconds,
      // a maker who took their voice away (〔声を消す〕) is not heard any more
      titleVoice: r.voice ? titleVoiceOf(r.design, r.title) : null,
      lyrics: lyrics.map((l) => ({ t: Math.round(l.t * 100) / 100, end: Math.round(l.end * 100) / 100, text: l.text })),
    };
  }
}
