import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { GAME_BUILDS_PER_DAY, GameBrokenBody, GameBuildBody, NovelChapterBody, spellKey } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import { Database } from '../db/db';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { JobsService } from '../jobs/jobs.service';
import { startConfirmed } from '../wallet/confirmed';
import { LedgerService } from '../wallet/ledger.service';
import { GameService } from './game.service';
import { NovelService } from './novel.service';

/**
 * Client 2026-11-25: 本 and ゲーム from the Moon atelier. A book's chapter is written at once and free (a few a minute,
 * NOVEL_CHAPTERS_PER_DAY a day); a game is a background job paid with the member's yes (MAKE_COST.game, then
 * MAKE_COST.gameTweak), charged once per yes, its mana back when it cannot be made or does not run.
 */
@Controller('moon')
@UseGuards(AuthGuard)
export class CraftController {
  constructor(
    private readonly novels: NovelService,
    private readonly games: GameService,
    private readonly jobs: JobsService,
    private readonly ledger: LedgerService,
    private readonly db: Database,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('novel/chapter')
  @HttpCode(200)
  async chapter(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `novel-ch:${userId}`, 6, 60);
    return this.novels.chapter(userId, parseBody(NovelChapterBody, body));
  }

  @Get('books')
  books(@UserId() userId: string) {
    return this.novels.list(userId);
  }

  /** the maker's own book, or one a ダチ sent */
  @Get('books/:id')
  book(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.novels.read(userId, id);
  }

  @Post('game')
  @HttpCode(202)
  async build(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `game-build:${userId}`, GAME_BUILDS_PER_DAY, 86_400);
    const b = parseBody(GameBuildBody, body);
    await this.games.precheck(userId, b);
    const kind = b.gameId ? ('gameTweak' as const) : ('game' as const);
    return startConfirmed({
      ledger: this.ledger,
      db: this.db,
      kv: this.kv,
      jobs: this.jobs,
      userId,
      kind,
      refId: b.gameId,
      confirm: b.confirm,
      // made from exactly the spell said yes to
      spell: spellKey('game', b.tags),
      required: true,
      create: () => this.jobs.create(userId, 'game', { gameId: b.gameId, tags: b.tags, said: b.said, confirm: b.confirm, kind, from: 'atelier' }),
    });
  }

  @Get('games')
  list(@UserId() userId: string) {
    return this.games.list(userId);
  }

  /** the maker's own game, or one a ダチ sent (played in the same sandbox) */
  @Get('games/:id')
  game(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.games.play(userId, id);
  }

  /** the sandbox said the version does not run: its mana back (see GameService.broken) */
  @Post('games/:id/broken')
  @HttpCode(200)
  broken(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.games.broken(userId, id, parseBody(GameBrokenBody, body));
  }
}
