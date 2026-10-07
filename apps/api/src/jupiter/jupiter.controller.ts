import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CreateJupiterPostBody, JupiterBranchBody, JupiterReplyBody, JupiterRootBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { JupiterService } from './jupiter.service';

/** Jupiter — パタパタ: roots, posts (butterflies → leaves), the sky, trees, search. */
@Controller('jupiter')
@UseGuards(AuthGuard)
export class JupiterController {
  constructor(
    private readonly jupiter: JupiterService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get('sky')
  sky(@UserId() userId: string, @Query('tab') tab?: string) {
    return this.jupiter.sky(userId, tab === 'following' || tab === 'friends' ? tab : 'all');
  }

  @Get('roots')
  roots(@UserId() userId: string) {
    return this.jupiter.roots(userId);
  }

  @Post('roots')
  async addRoot(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `jupiter-root:${userId}`, 60, 600);
    return this.jupiter.addRoot(userId, parseBody(JupiterRootBody, body));
  }

  @Delete('roots/:id')
  @HttpCode(204)
  async removeRoot(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.jupiter.removeRoot(userId, id);
  }

  @Post('posts')
  async create(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `jupiter-post:${userId}`, 20, 600);
    return this.jupiter.create(userId, parseBody(CreateJupiterPostBody, body));
  }

  @Delete('posts/:id')
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.jupiter.remove(userId, id);
  }

  @Post('posts/:id/star')
  @HttpCode(200)
  star(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.jupiter.setStar(userId, id, true);
  }

  @Delete('posts/:id/star')
  @HttpCode(200)
  unstar(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.jupiter.setStar(userId, id, false);
  }

  @Get('posts/:id/replies')
  replies(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.jupiter.replies(id);
  }

  @Post('posts/:id/replies')
  async reply(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await rateLimit(this.kv, `jupiter-reply:${userId}`, 30, 600);
    return this.jupiter.reply(userId, id, parseBody(JupiterReplyBody, body).text);
  }

  @Delete('replies/:id')
  @HttpCode(204)
  async removeReply(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.jupiter.removeReply(userId, id);
  }

  @Get('trees/:id')
  tree(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.jupiter.tree(userId, id);
  }

  /** Rename one of the four branches on your own tree. */
  @Put('branches')
  async branch(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `jupiter-branch:${userId}`, 20, 600);
    const b = parseBody(JupiterBranchBody, body);
    return { branches: await this.jupiter.renameBranch(userId, b.index, b.name) };
  }

  @Get('users')
  search(@Query('q') q?: string) {
    return this.jupiter.search(q ?? '');
  }
}
