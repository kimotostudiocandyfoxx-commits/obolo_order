import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CreatePlazaBody, CreateSaturnPostBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { PlazaService } from './plaza.service';
import { SaturnService } from './saturn.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('saturn/posts')
@UseGuards(AuthGuard)
export class SaturnController {
  constructor(
    private readonly saturn: SaturnService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get()
  feed(@UserId() userId: string, @Query('cursor') cursor?: string, @Query('fresh') fresh?: string, @Query('tab') tab?: string, @Query('limit') limit?: string, @Query('plaza') plaza?: string) {
    // a tab keeps up to 22 voices on screen and refills from this list (client decision 2026-10-07)
    const n = Math.max(1, Math.min(50, Number(limit) || 20));
    const plazaId = plaza && UUID_RE.test(plaza) ? plaza : undefined;
    return this.saturn.feed(userId, cursor, n, fresh === '1', tab === 'following' || tab === 'friends' ? tab : 'all', plazaId);
  }

  /** The voice replies under a post (little balls lined up under it). */
  @Get(':id/replies')
  replies(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.saturn.replies(userId, id);
  }

  @Post()
  async create(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    const input = parseBody(CreateSaturnPostBody, body);
    await rateLimit(this.kv, `saturn-post:${userId}`, 10, 600);
    // own-voice posts are paid read-alouds: they share the read-aloud allowance (P-VOICE-3)
    if (input.ownVoice || input.readBy) await rateLimit(this.kv, `voice-speak:${userId}`, 100, 86400);
    return this.saturn.create(userId, input, `${req.protocol}://${req.get('host')}`);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.saturn.remove(userId, id);
  }

  @Post(':id/star')
  @HttpCode(200)
  star(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.saturn.setStar(userId, id, true);
  }

  @Delete(':id/star')
  @HttpCode(200)
  unstar(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.saturn.setStar(userId, id, false);
  }
}

/** Saturn pages (profile) and follows. */
@Controller('saturn/users')
@UseGuards(AuthGuard)
export class SaturnUsersController {
  constructor(
    private readonly saturn: SaturnService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get(':id')
  profile(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.saturn.profile(userId, id);
  }

  @Get(':id/posts')
  posts(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Query('cursor') cursor?: string) {
    return this.saturn.userPosts(userId, id, cursor);
  }

  @Post(':id/follow')
  @HttpCode(200)
  async follow(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await rateLimit(this.kv, `saturn-follow:${userId}`, 60, 600);
    return this.saturn.follow(userId, id, true);
  }

  @Delete(':id/follow')
  @HttpCode(200)
  async unfollow(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await rateLimit(this.kv, `saturn-follow:${userId}`, 60, 600);
    return this.saturn.follow(userId, id, false);
  }
}

/** ひろば: the みんな map (list / search), make one, join or leave. */
@Controller('saturn/plazas')
@UseGuards(AuthGuard)
export class SaturnPlazasController {
  constructor(
    private readonly plazas: PlazaService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get()
  list(@UserId() userId: string, @Query('q') q?: string, @Query('limit') limit?: string) {
    return this.plazas.list(userId, q, Math.max(1, Math.min(60, Number(limit) || 30)));
  }

  @Get(':id')
  get(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.plazas.get(userId, id);
  }

  @Post()
  async create(@UserId() userId: string, @Body() body: unknown) {
    const input = parseBody(CreatePlazaBody, body);
    await rateLimit(this.kv, `saturn-plaza-new:${userId}`, 5, 86400);
    return this.plazas.create(userId, input);
  }

  @Post(':id/join')
  @HttpCode(200)
  async join(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await rateLimit(this.kv, `saturn-plaza-join:${userId}`, 60, 600);
    return this.plazas.join(userId, id, true);
  }

  @Delete(':id/join')
  @HttpCode(200)
  async leave(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await rateLimit(this.kv, `saturn-plaza-join:${userId}`, 60, 600);
    return this.plazas.join(userId, id, false);
  }
}
