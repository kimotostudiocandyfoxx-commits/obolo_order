import { Body, Controller, Get, Headers, HttpCode, Inject, Ip, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { FavouriteBody, FavouritesBody, isHomePlanet, PLANET_WORK_KINDS, PlanetWorkHideBody, WorkVisibilityBody, type HomePlanet, type PlanetWorkKind } from '@obolo/shared';
import { assertAdmin } from '../admin/admin.guard';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { apiError } from '../common/errors';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import { AppConfig, CONFIG } from '../config';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { ContinentsService } from './continents.service';
import { PlanetSongsService } from './planet-songs.service';
import { PlanetWorksService } from './planet-works.service';

const planetOf = (p: string): HomePlanet => {
  if (isHomePlanet(p)) return p;
  throw apiError(404, 'NOT_FOUND', 'Unknown planet');
};
const kindOf = (k: string): PlanetWorkKind => {
  if ((PLANET_WORK_KINDS as readonly string[]).includes(k)) return k as PlanetWorkKind;
  throw apiError(404, 'NOT_FOUND', 'Unknown kind');
};

/**
 * 2-4 / 2-5 (docs/planets.md): じぶんの空 (the continents and your five), ☆ on a continent, 〔🔍 大陸をさがす〕, 〔✈ 旅〕,
 * landing on a continent (its works) and the seen record.
 */
@Controller('planet-continents/:planet')
@UseGuards(AuthGuard)
export class ContinentsController {
  constructor(
    private readonly continents: ContinentsService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get()
  sky(@UserId() userId: string, @Param('planet') planet: string) {
    return this.continents.sky(userId, planetOf(planet));
  }

  @Put('favourites')
  async setFavourites(@UserId() userId: string, @Param('planet') planet: string, @Body() body: unknown) {
    await rateLimit(this.kv, `continent-fav:${userId}`, 60, 600);
    return { favourites: await this.continents.setFavourites(userId, planetOf(planet), parseBody(FavouritesBody, body).slots) };
  }

  @Get('search')
  search(@UserId() userId: string, @Param('planet') planet: string, @Query('q') q?: string, @Query('tag') tag?: string) {
    return this.continents.search(userId, planetOf(planet), (q ?? '').slice(0, 40), tag ? tag.slice(0, 20) : null);
  }

  @Get('travel')
  async travel(@UserId() userId: string, @Param('planet') planet: string, @Query('n') n?: string) {
    await rateLimit(this.kv, `continent-travel:${userId}`, 120, 600);
    return this.continents.travel(userId, planetOf(planet), Number(n) || undefined);
  }

  @Get(':key')
  land(@UserId() userId: string, @Param('planet') planet: string, @Param('key') key: string) {
    return this.continents.land(userId, planetOf(planet), key);
  }

  @Post(':key/visit')
  @HttpCode(200)
  visit(@UserId() userId: string, @Param('planet') planet: string, @Param('key') key: string) {
    return this.continents.visit(userId, planetOf(planet), key);
  }

  @Put(':key/favourite')
  async favourite(@UserId() userId: string, @Param('planet') planet: string, @Param('key') key: string, @Body() body: unknown) {
    await rateLimit(this.kv, `continent-fav:${userId}`, 60, 600);
    const b = parseBody(FavouriteBody, body);
    return { favourites: await this.continents.favourite(userId, planetOf(planet), key, b.on, b.slot) };
  }
}

/** 2-2 / 2-5: a work's visibility (its maker only) and ☆ (kept in Bluena). 〔通報〕〔見えなくする〕: work-safety.controller.ts */
@Controller('planet-works')
@UseGuards(AuthGuard)
export class PlanetWorksController {
  constructor(
    private readonly works: PlanetWorksService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get('saved')
  saved(@UserId() userId: string) {
    return this.works.saved(userId);
  }

  @Get(':kind/:id/visibility')
  visibility(@UserId() userId: string, @Param('kind') kind: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.works.visibility(userId, kindOf(kind), id);
  }

  @Put(':kind/:id/visibility')
  async setVisibility(@UserId() userId: string, @Param('kind') kind: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await rateLimit(this.kv, `work-visibility:${userId}`, 60, 600);
    return this.works.setVisibility(userId, kindOf(kind), id, parseBody(WorkVisibilityBody, body).visibility);
  }

  @Put(':kind/:id/save')
  async save(@UserId() userId: string, @Param('kind') kind: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await rateLimit(this.kv, `work-save:${userId}`, 120, 600);
    return this.works.save(userId, kindOf(kind), id, parseBody(PlanetWorkHideBody, body).on);
  }
}

/** handoff 02 §2: a Mercury song opened — sound, jacket, title and the lyrics with their times (PlanetSongView) */
@Controller('planet-works/planet_post')
@UseGuards(AuthGuard)
export class PlanetSongsController {
  constructor(private readonly songs: PlanetSongsService) {}

  @Get(':id/song')
  song(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.songs.song(userId, id);
  }
}

/**
 * 2-1 backfill (admin token only): the works made before the tags existed get their tags and the check, `limit` of each
 * store at a time (default 200, at most 1000). Run again until every count is 0.
 *   curl -X POST -H "x-admin-token: …" "https://<api>/admin/planet-works-backfill?limit=200"
 */
@Controller('admin')
export class PlanetWorksAdminController {
  constructor(
    private readonly works: PlanetWorksService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('planet-works-backfill')
  @HttpCode(200)
  async backfill(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Query('limit') limit?: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
    return this.works.backfill(Math.max(1, Math.min(1000, Number(limit) || 200)));
  }
}
