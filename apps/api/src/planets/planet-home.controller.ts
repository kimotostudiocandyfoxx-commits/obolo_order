import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { isHomePlanet, PlanetHomeColourBody, PlanetHomeOrderBody, type HomePlanet } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { apiError } from '../common/errors';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { PlanetHomeService } from './planet-home.service';

const planetOf = (p: string): HomePlanet => {
  if (isHomePlanet(p)) return p;
  throw apiError(404, 'NOT_FOUND', 'Unknown planet');
};

/**
 * 星のホーム (M-R258): the feed (own forever / dachi and 推し 88 hours / a few strangers far away), the visit mark, your
 * own works' order and 外す. 〔通報〕〔見えなくする〕 stay on /planet-works/:kind/:id (work-safety.controller.ts).
 */
@Controller('planet-home/:planet')
@UseGuards(AuthGuard)
export class PlanetHomeController {
  constructor(
    private readonly homes: PlanetHomeService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get()
  feed(@UserId() userId: string, @Param('planet') planet: string) {
    return this.homes.feed(userId, planetOf(planet));
  }

  /** 04 §3: a person's past works on this planet, for their profile (yourself, a dachi, or a 推し you may see) */
  @Get('person/:id')
  person(@UserId() userId: string, @Param('planet') planet: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.homes.person(userId, planetOf(planet), id);
  }

  @Post('visit')
  @HttpCode(200)
  visit(@UserId() userId: string, @Param('planet') planet: string) {
    return this.homes.visit(userId, planetOf(planet));
  }

  @Put('order')
  async reorder(@UserId() userId: string, @Param('planet') planet: string, @Body() body: unknown) {
    await rateLimit(this.kv, `home-order:${userId}`, 60, 600);
    return this.homes.reorder(userId, planetOf(planet), parseBody(PlanetHomeOrderBody, body).ids);
  }

  /** M-R262: the record's colour */
  @Put('colour')
  async colour(@UserId() userId: string, @Param('planet') planet: string, @Body() body: unknown) {
    await rateLimit(this.kv, `home-colour:${userId}`, 60, 600);
    return this.homes.setColour(userId, planetOf(planet), parseBody(PlanetHomeColourBody, body).colour);
  }

  @Delete('own/:id')
  @HttpCode(204)
  async takeOut(@UserId() userId: string, @Param('planet') planet: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.homes.takeOut(userId, planetOf(planet), id);
  }
}

/** 推し: who you follow (dachi in by themselves), 〔推す〕 and 外す. */
@Controller('oshi')
@UseGuards(AuthGuard)
export class OshiController {
  constructor(
    private readonly homes: PlanetHomeService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get()
  list(@UserId() userId: string) {
    return this.homes.oshiList(userId);
  }

  @Post(':id')
  @HttpCode(200)
  async push(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await rateLimit(this.kv, `oshi:${userId}`, 60, 600);
    return this.homes.push(userId, id);
  }

  @Delete(':id')
  @HttpCode(200)
  async unpush(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await rateLimit(this.kv, `oshi:${userId}`, 60, 600);
    return this.homes.unpush(userId, id);
  }
}
