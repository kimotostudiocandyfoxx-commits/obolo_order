import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CreatePlanetPostBody, JupiterReplyBody, type TimelinePlanet } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { apiError } from '../common/errors';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { PlanetPostsService } from './planet-posts.service';

const planetOf = (p: string): TimelinePlanet => {
  if (p === 'mercury' || p === 'mars') return p;
  throw apiError(404, 'NOT_FOUND', 'Unknown planet');
};

/** Mercury (songs) and Mars (square movies): timelines, islands / studios, ☆, replies. */
@Controller('planets/:planet')
@UseGuards(AuthGuard)
export class PlanetPostsController {
  constructor(
    private readonly posts: PlanetPostsService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get('sky')
  sky(@UserId() userId: string, @Param('planet') planet: string, @Query('tab') tab?: string) {
    return this.posts.sky(userId, planetOf(planet), tab === 'following' || tab === 'friends' ? tab : 'all');
  }

  @Get('profiles/:id')
  profile(@UserId() userId: string, @Param('planet') planet: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.posts.profile(userId, planetOf(planet), id);
  }

  @Post('posts')
  async create(@UserId() userId: string, @Param('planet') planet: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `planet-post:${userId}`, 20, 600);
    return this.posts.create(userId, planetOf(planet), parseBody(CreatePlanetPostBody, body), `${req.protocol}://${req.get('host')}`);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.posts.remove(userId, id);
  }

  @Post('posts/:id/star')
  @HttpCode(200)
  star(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.posts.setStar(userId, id, true);
  }

  @Delete('posts/:id/star')
  @HttpCode(200)
  unstar(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.posts.setStar(userId, id, false);
  }

  @Get('posts/:id/replies')
  replies(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.posts.replies(id);
  }

  @Post('posts/:id/replies')
  async reply(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await rateLimit(this.kv, `planet-reply:${userId}`, 30, 600);
    return this.posts.reply(userId, id, parseBody(JupiterReplyBody, body).text);
  }
}
