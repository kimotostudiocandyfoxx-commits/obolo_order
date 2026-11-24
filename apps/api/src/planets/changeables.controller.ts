import { Body, Controller, Get, Inject, Param, Put, UseGuards } from '@nestjs/common';
import { applyChange, changeableById, CHANGEABLES, type ChangeStore } from '@obolo/shared';
import { z } from 'zod';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { apiError } from '../common/errors';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { PlanetHomeService } from './planet-home.service';

const SetBody = z.object({ value: z.string().min(1).max(40) });

/**
 * M-R263: what {bati} changes when asked in the Moon chat (the registry in @obolo/shared changeables.ts) — read them
 * all, set one (the answer keeps what it was, for the chat card's 〔元に戻す〕, which is the same call back).
 */
@Controller('changeables')
@UseGuards(AuthGuard)
export class ChangeablesController {
  constructor(
    private readonly homes: PlanetHomeService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  private store(userId: string): ChangeStore {
    return {
      home: async (planet) => this.homes.home(userId, planet),
      setHome: async (planet, patch) => {
        if (patch.recordColour) await this.homes.setColour(userId, planet, patch.recordColour);
      },
    };
  }

  @Get()
  async all(@UserId() userId: string) {
    const st = this.store(userId);
    return Object.fromEntries(await Promise.all(CHANGEABLES.map(async (c) => [c.id, await c.get(st)] as const)));
  }

  @Put(':id')
  async set(@UserId() userId: string, @Param('id') id: string, @Body() body: unknown) {
    await rateLimit(this.kv, `changeable:${userId}`, 60, 600);
    const item = changeableById(id);
    const { value } = parseBody(SetBody, body);
    if (!item || !item.choices.some((c) => c.id === value)) throw apiError(404, 'NOT_FOUND', 'Unknown choice');
    return applyChange(this.store(userId), id, value);
  }
}
