import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AddMvMaterialBody, CreateMvBody } from '@obolo/shared';
import { z } from 'zod';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { MvService } from './mv.service';

const MaterialBody = AddMvMaterialBody.extend({ posterUrl: z.string().url().max(500).nullish(), seconds: z.number().min(0).max(3600).nullish() });
const origin = (req: Request) => `${req.protocol}://${req.get('host')}`;

/** Mars MV studio: a Mercury song + videos / photos → Bati's MV (docs/placeholders.md P-MV). */
@Controller('mars/mv')
@UseGuards(AuthGuard)
export class MvController {
  constructor(
    private readonly mv: MvService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get()
  async list(@UserId() userId: string) {
    return { projects: await this.mv.latest(userId) };
  }

  @Post()
  async create(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `mv-new:${userId}`, 20, 3600);
    return this.mv.create(userId, parseBody(CreateMvBody, body).songId);
  }

  @Get(':id')
  get(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.mv.get(userId, id);
  }

  @Post(':id/materials')
  async add(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await rateLimit(this.kv, `mv-mat:${userId}`, 60, 600);
    return this.mv.addMaterial(userId, id, parseBody(MaterialBody, body));
  }

  @Delete(':id/materials/:mediaId')
  removeMaterial(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Param('mediaId', new ParseUUIDPipe()) mediaId: string) {
    return this.mv.removeMaterial(userId, id, mediaId);
  }

  /** Waits until the MV is made (a minute or two). */
  @Post(':id/render')
  @HttpCode(200)
  async render(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    await rateLimit(this.kv, `mv-render:${userId}`, 6, 3600);
    return this.mv.render(userId, id, origin(req));
  }

  @Post(':id/lyrics')
  @HttpCode(200)
  async lyrics(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    await rateLimit(this.kv, `mv-lyrics:${userId}`, 6, 3600);
    return this.mv.withLyrics(userId, id, origin(req));
  }
}
