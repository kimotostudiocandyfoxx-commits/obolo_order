import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ComposeChatBody, ComposeDesignBody, InstrumentalBody, SingBody, SongEditBody, FullSongBody, lyricsSections, songSpellKey, spellPrompt, SongTweakBody, SONG_TWEAKS_PER_HOUR } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { ComposeService } from './compose.service';
import { JobsService } from '../jobs/jobs.service';
import { SongService } from './song.service';
import { SongTweakService } from './song-tweak.service';
import { Database } from '../db/db';
import { LedgerService } from '../wallet/ledger.service';
import { startConfirmed } from '../wallet/confirmed';

/** Mercury 作曲 (see ComposeService). */
@Controller('compose')
@UseGuards(AuthGuard)
export class ComposeController {
  constructor(
    private readonly compose: ComposeService,
    private readonly songs: SongService,
    private readonly tweaks: SongTweakService,
    private readonly jobs: JobsService,
    private readonly ledger: LedgerService,
    private readonly db: Database,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('chat')
  @HttpCode(200)
  async chat(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `compose-chat:${userId}`, 20, 60);
    return this.compose.chat(parseBody(ComposeChatBody, body));
  }

  /** The GPU studio's state (warming up, downloading, error) for the song card. */
  @Get('music-status')
  async musicStatus(@UserId() userId: string) {
    await rateLimit(this.kv, `compose-status:${userId}`, 30, 60);
    return this.compose.musicStatus();
  }

  /** PLACEHOLDER (P-MER-4): 30 tries a day per member (retries while the GPU warms up count too). */
  @Post('instrumental')
  @HttpCode(200)
  async instrumental(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    const b = parseBody(InstrumentalBody, body);
    await rateLimit(this.kv, `compose-inst:${userId}`, 30, 86400);
    return this.compose.instrumental(userId, b, `${req.protocol}://${req.get('host')}`);
  }

  /** Step 3: sing it (one Fish call per lyric line) and mix. PLACEHOLDER (P-VOICE-3): 10 a day. */
  @Post('sing')
  @HttpCode(200)
  async sing(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    const b = parseBody(SingBody, body);
    await rateLimit(this.kv, `compose-sing:${userId}`, 10, 86400);
    return this.songs.create(userId, b, `${req.protocol}://${req.get('host')}`);
  }

  /**
   * The whole song sung by the music studio (ACE-Step + HTDemucs + Seed-VC, 2026-10-09), as a
   * background job: answers at once with the job; GET /jobs/:id until it is done (and a push).
   * PLACEHOLDER (P-MER-7): 20 a day.
   */
  @Post('song')
  @HttpCode(202)
  async fullSong(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    const b = parseBody(FullSongBody, body);
    await rateLimit(this.kv, `compose-song:${userId}`, 20, 86400);
    // a song costs mana (2): taken before the studio starts; given back if the job cannot be queued. R11: from the Moon
    // atelier only with the member's yes to the plan and its price (once per yes)
    const { confirm, spell, ...rest } = b;
    // R11: the work is made from exactly the spell said yes to (its English); R13: and sung from exactly the lyrics said
    // yes to (their sections come from them, not from the request)
    const styled = spell ? { ...rest, instrumentalPrompt: spellPrompt('song', spell).slice(0, 500) } : rest;
    const song = b.lyrics ? { ...styled, sections: lyricsSections(b.lyrics), ...(b.lyrics.title && !b.title ? { title: b.lyrics.title } : {}) } : styled;
    return startConfirmed({
      ledger: this.ledger,
      db: this.db,
      kv: this.kv,
      jobs: this.jobs,
      userId,
      kind: 'song',
      confirm,
      spell: songSpellKey(spell, b.lyrics),
      required: b.from === 'atelier',
      // R16: the yes goes with the job (a song that fails for good gives its mana back)
      create: () => this.jobs.create(userId, 'song', { body: song, origin: `${req.protocol}://${req.get('host')}`, ...(confirm ? { confirm } : {}) }),
    });
  }

  /** Your saved songs (the soil of your island on Mercury). */
  @Get('songs')
  saved(@UserId() userId: string) {
    return this.songs.saved(userId);
  }

  @Get('songs/:id')
  async song(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.songs.get(userId, id);
  }

  /** 手直し: a chat message about the song. PLACEHOLDER (P-MER-8): 40 edits a day. */
  @Post('songs/:id/edit')
  @HttpCode(200)
  async edit(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Req() req: Request) {
    const b = parseBody(SongEditBody, body);
    await rateLimit(this.kv, `compose-edit:${userId}`, 40, 86400);
    // a genre edit runs the GPU: it also counts as an instrumental (P-MER-4)
    if (b.command?.action === 'GENRE_EDIT' || b.command?.action === 'SONG_EXTEND') await rateLimit(this.kv, `compose-inst:${userId}`, 30, 86400);
    return this.songs.edit(userId, id, b, `${req.protocol}://${req.get('host')}`);
  }

  /**
   * R13: a finished song changed for free (no mana) — tempo, key, a part cut / again, length, fades, balance, karaoke,
   * room — rendered on our side from its stems; 「元に戻して」 one back. A change that needs the studio is answered `paid`.
   * SONG_TWEAKS_PER_HOUR a member (each runs ffmpeg here).
   */
  @Post('songs/:id/tweak')
  @HttpCode(200)
  async tweak(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Req() req: Request) {
    const b = parseBody(SongTweakBody, body);
    if (!b.undo) await rateLimit(this.kv, `compose-tweak:${userId}`, SONG_TWEAKS_PER_HOUR, 3600);
    return this.tweaks.tweak(userId, id, b, `${req.protocol}://${req.get('host')}`);
  }

  /** 保存する (the client also buries it in the island). */
  @Post('songs/:id/save')
  @HttpCode(200)
  async save(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.songs.save(userId, id);
  }

  /** PLACEHOLDER (P-MER-4): 20 songs a day per member until the pricing (MANA) is decided. */
  @Post('design')
  @HttpCode(200)
  async design(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `compose-design:${userId}`, 20, 86400);
    return this.compose.design(parseBody(ComposeDesignBody, body));
  }
}
