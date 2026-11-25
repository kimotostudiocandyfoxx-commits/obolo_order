import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { MoonCompassBody, RenameSpellBody, SaveSpellBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { MoonCompassService } from './moon-compass.service';
import { SpellBookService } from './spell-book.service';

/**
 * R12: {bati}'s two tools on the Moon — POST /moon/compass (a photo / an image / a YouTube link → a spell; free, 20 an
 * hour) and the spell book: GET /moon/spellbook, POST /moon/spellbook (keep), PATCH /moon/spellbook/:id (rename),
 * POST /moon/spellbook/:id/used, DELETE /moon/spellbook/:id. Signed-in members only, each their own.
 */
@Controller('moon')
@UseGuards(AuthGuard)
export class SpellToolsController {
  constructor(
    private readonly book: SpellBookService,
    private readonly compass: MoonCompassService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('compass')
  @HttpCode(200)
  async read(@UserId() userId: string, @Body() body: unknown) {
    const b = parseBody(MoonCompassBody, body);
    await rateLimit(this.kv, `moon-compass:${userId}`, 20, 3600);
    return this.compass.read(userId, b);
  }

  @Get('spellbook')
  list(@UserId() userId: string) {
    return this.book.list(userId);
  }

  @Post('spellbook')
  @HttpCode(200)
  async save(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `spellbook:${userId}`, 60, 3600);
    return this.book.save(userId, parseBody(SaveSpellBody, body));
  }

  @Patch('spellbook/:id')
  async rename(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await rateLimit(this.kv, `spellbook:${userId}`, 60, 3600);
    return this.book.rename(userId, id, parseBody(RenameSpellBody, body));
  }

  @Post('spellbook/:id/used')
  @HttpCode(200)
  used(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.book.used(userId, id);
  }

  @Delete('spellbook/:id')
  remove(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.book.remove(userId, id);
  }
}
