import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ArtTitleBody, IncantBody, LyricsBody, SpellBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { SpellService } from './spell.service';
import { LyricsService } from './lyrics.service';
import { IncantService } from './incant.service';
import { ArtTitleService } from './art-title.service';

/** R11: the スペル (spell) {bati} lays out before a paid making — free (no mana); 30 a minute per member */
@Controller('moon')
@UseGuards(AuthGuard)
export class SpellController {
  constructor(
    private readonly spells: SpellService,
    private readonly lyricsWriter: LyricsService,
    private readonly incants: IncantService,
    private readonly artTitles: ArtTitleService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('spell')
  @HttpCode(200)
  async spell(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `moon-spell:${userId}`, 30, 60);
    return this.spells.spell(parseBody(SpellBody, body));
  }

  /** R13: a song's スペル入りの歌詞 (lyrics with metatag talismans), or the lyrics changed by the words — free; 20 a minute */
  @Post('lyrics')
  @HttpCode(200)
  async lyrics(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `moon-lyrics:${userId}`, 20, 60);
    return this.lyricsWriter.lyrics(parseBody(LyricsBody, body));
  }

  /** story 2026-11-25: {bati}'s one title for a picture's spell (as a song's name comes with its lyrics) — free; 20 a minute */
  @Post('art-title')
  @HttpCode(200)
  async artTitle(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `moon-art-title:${userId}`, 20, 60);
    return this.artTitles.title(parseBody(ArtTitleBody, body));
  }

  /** R17: words to {bati} checked for the secret spell's passphrase (server only); anything else: { premium: false } */
  @Post('incant')
  @HttpCode(200)
  async incant(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `moon-incant:${userId}`, 30, 60);
    return this.incants.incant(userId, parseBody(IncantBody, body).said);
  }
}
