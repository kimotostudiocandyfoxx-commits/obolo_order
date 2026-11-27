import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { moderateText, type LlmProvider } from '@obolo/ai';
import { cleanSongTitle } from '@obolo/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { planetPosts, songs } from '../db/schema';
import { LLM } from '../infra/tokens';
import { SongTitleVoiceService } from './song-title-voice.service';

/**
 * 月で作る → 星, story session 2026-11-27: a song's title is changed by words after it is made, as an art's is
 * (「タイトルは〇〇にして」「〇〇ってタイトルにして」 in the Moon atelier → PATCH /compose/songs/:id/title). The title goes
 * through the same check as an art's (a title that breaks the rules is refused: MODERATION). The song keeps the new
 * title, every live Mercury post flown from it shows it (the title follows the song wherever it sails), and the title is
 * read again in the maker's voice in the background (the 'song.title' job; nothing when they have no voice).
 */
@Injectable()
export class SongRetitleService {
  constructor(
    private readonly db: Database,
    @Inject(LLM) private readonly llm: LlmProvider,
    @Optional() private readonly titleVoice?: SongTitleVoiceService,
  ) {}

  async retitle(userId: string, songId: string, raw: string, origin: string): Promise<{ id: string; title: string }> {
    const title = cleanSongTitle(raw);
    if (!title) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'A title is needed');
    if ((await moderateText(title, this.llm)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'This title breaks the community rules');
    const [s] = await this.db.write
      .update(songs)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(songs.id, songId), eq(songs.userId, userId), isNull(songs.deletedAt)))
      .returning({ id: songs.id, title: songs.title });
    if (!s) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Song not found');
    await this.db.write
      .update(planetPosts)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(planetPosts.sourceId, songId), eq(planetPosts.userId, userId), eq(planetPosts.planet, 'mercury'), eq(planetPosts.kind, 'song'), isNull(planetPosts.deletedAt)));
    // the reading of the title before is replaced by the job (it reads the song's title of now)
    await this.titleVoice?.later(userId, songId, origin).catch(() => false);
    return s;
  }
}
