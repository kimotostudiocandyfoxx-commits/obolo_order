import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ComposeChatBody, ComposeDesignBody, InstrumentalBody, SingBody, SongEditBody, FullSongBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { ComposeService } from './compose.service';
import { JobsService } from '../jobs/jobs.service';
import { SongService } from './song.service';

/** Mercury 作曲 (see ComposeService). */
@Controller('compose')
@UseGuards(AuthGuard)
export class ComposeController {
  constructor(
    private readonly compose: ComposeService,
    private readonly songs: SongService,
    private readonly jobs: JobsService,
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
    return this.jobs.create(userId, 'song', { body: b, origin: `${req.protocol}://${req.get('host')}` });
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
    if (b.command?.action === 'GENRE_EDIT') await rateLimit(this.kv, `compose-inst:${userId}`, 30, 86400);
    return this.songs.edit(userId, id, b, `${req.protocol}://${req.get('host')}`);
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
