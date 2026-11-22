import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AddVersionBody, CreateMoonWorkBody, SetFaceBody } from '@obolo/shared';
import { z } from 'zod';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseBody } from '../common/validate';
import { MoonWorksService } from './moon-works.service';

const Ids = z.object({ ids: z.string().max(4000).optional() });
const Told = z.object({ keys: z.array(z.string().min(3).max(140)).max(50) });

/** M-R253: the Moon atelier's works (tries, face, material, where they were made) and the homecoming reports */
@Controller('moon')
@UseGuards(AuthGuard)
export class MoonWorksController {
  constructor(private readonly works: MoonWorksService) {}

  /** ?ids=a,b (none: all, newest first) */
  @Get('works')
  list(@UserId() userId: string, @Query() q: unknown) {
    const ids = parseBody(Ids, q).ids?.split(',').filter((x) => /^[0-9a-f-]{36}$/i.test(x));
    return this.works.list(userId, ids);
  }

  @Post('works')
  create(@UserId() userId: string, @Body() body: unknown) {
    return this.works.create(userId, parseBody(CreateMoonWorkBody, body));
  }

  /** §1: a redo, inside the same work (it becomes the face) */
  @Post('works/:id/versions')
  addVersion(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.works.addVersion(userId, id, parseBody(AddVersionBody, body));
  }

  /** §1: the try looked at last */
  @Put('works/:id/face')
  setFace(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.works.setFace(userId, id, parseBody(SetFaceBody, body).index);
  }

  @Delete('works/:id/versions/:index')
  dropVersion(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Param('index', ParseIntPipe) index: number) {
    return this.works.dropVersion(userId, id, index);
  }

  @Delete('works/:id')
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.works.remove(userId, id);
  }

  /** §5: flown works back home, not told yet (with the ★ — under 15 only the dachi's) */
  @Get('homecomings')
  homecomings(@UserId() userId: string) {
    return this.works.homecomings(userId);
  }

  @Post('homecomings/told')
  @HttpCode(204)
  async told(@UserId() userId: string, @Body() body: unknown) {
    await this.works.markTold(userId, parseBody(Told, body).keys);
  }
}
