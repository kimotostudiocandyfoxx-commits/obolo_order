import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { SpellBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { SpellService } from './spell.service';

/** R11: the スペル (spell) {bati} lays out before a paid making — free (no mana); 30 a minute per member */
@Controller('moon')
@UseGuards(AuthGuard)
export class SpellController {
  constructor(
    private readonly spells: SpellService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('spell')
  @HttpCode(200)
  async spell(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `moon-spell:${userId}`, 30, 60);
    return this.spells.spell(parseBody(SpellBody, body));
  }
}
