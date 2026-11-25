import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AddMvMaterialBody, CreateMvBody, jstDay, MakeConfirm, MvEditBody, MvPicturesBody, MvRedrawBody, SpellTags, spellKey, spellPrompt, VIDEO_EDITS_PER_DAY, videoParams } from '@obolo/shared';
import { apiError } from '../common/errors';
import { HttpStatus } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { JobsService } from '../jobs/jobs.service';
import { MvService } from './mv.service';
import { Database } from '../db/db';
import { LedgerService } from '../wallet/ledger.service';
import { startConfirmed } from '../wallet/confirmed';

const MaterialBody = AddMvMaterialBody.extend({ posterUrl: z.string().url().max(500).nullish(), seconds: z.number().min(0).max(3600).nullish() });
const StoryBody = z.object({ mood: z.string().trim().max(200).default(''), from: z.literal('atelier').optional(), confirm: MakeConfirm.optional(), spell: SpellTags.optional() });
const origin = (req: Request) => `${req.protocol}://${req.get('host')}`;

/** Mars MV studio: a Mercury song + videos / photos → Bati's MV (docs/placeholders.md P-MV). */
@Controller('mars/mv')
@UseGuards(AuthGuard)
export class MvController {
  constructor(
    private readonly mv: MvService,
    private readonly jobs: JobsService,
    private readonly ledger: LedgerService,
    private readonly db: Database,
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

  /** Story MV: Bati paints the MV from the song and the profile picture — a background job (GET /jobs/:id, push when done). */
  @Post(':id/story')
  @HttpCode(202)
  async story(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `mv-render:${userId}`, 6, 3600);
    await this.mv.get(userId, id); // yours? (fails before queueing)
    // an MV costs mana (8): taken before the shoot; given back if the job cannot be queued. R11: from the Moon atelier
    // only with the member's yes to the plan and its price (once per yes)
    const b = parseBody(StoryBody, body);
    return startConfirmed({
      ledger: this.ledger,
      db: this.db,
      kv: this.kv,
      jobs: this.jobs,
      userId,
      kind: 'mv',
      refId: id,
      confirm: b.confirm,
      spell: b.spell ? spellKey('video', b.spell) : null,
      required: b.from === 'atelier',
      // R11: made from exactly the spell said yes to; R13: its talismans are the pipeline's settings (videoParams)
      create: () =>
        this.jobs.create(userId, 'mv-story', {
          mvId: id,
          mood: b.spell ? spellPrompt('video', b.spell).slice(0, 200) : b.mood,
          origin: origin(req),
          from: b.from,
          ...(b.spell ? { tags: b.spell } : {}),
          ...(b.confirm ? { confirm: b.confirm, pay: 'mv' as const } : {}),
        }),
    });
  }

  /**
   * R13: a video of the member's own pictures (the project's photos, else the newest in Bluena): nothing painted, the
   * pictures only move — MAKE_COST.mvPictures with the yes. Refused before the charge when there is nothing to move.
   */
  @Post(':id/pictures')
  @HttpCode(202)
  async pictures(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `mv-render:${userId}`, 6, 3600);
    const b = parseBody(MvPicturesBody, body);
    if (videoParams(b.spell).purpose !== 'pictures') throw apiError(HttpStatus.BAD_REQUEST, 'NOT_PICTURES', 'This spell paints new pictures');
    if (!(await this.mv.ownPictures(userId, id, 8)).length) throw apiError(HttpStatus.BAD_REQUEST, 'NO_PICTURES', 'No pictures to move yet');
    return startConfirmed({
      ledger: this.ledger,
      db: this.db,
      kv: this.kv,
      jobs: this.jobs,
      userId,
      kind: 'mvPictures',
      refId: id,
      confirm: b.confirm,
      spell: spellKey('video', b.spell),
      required: true,
      create: () => this.jobs.create(userId, 'mv-edit', { mvId: id, origin: origin(req), from: b.from, mode: 'pictures', tags: b.spell, confirm: b.confirm, pay: 'mvPictures' }),
    });
  }

  /**
   * R13: a free change of how it moves (camera, pace, fades, lyrics, order, a scene cut, length, part of the song,
   * colours) — re-rendered on the CPU from the kept pictures; no mana, VIDEO_EDITS_PER_DAY a day.
   */
  @Post(':id/edit')
  @HttpCode(202)
  async edit(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    const b = parseBody(MvEditBody, body);
    const p = await this.mv.get(userId, id);
    if (!p.cut) throw apiError(HttpStatus.BAD_REQUEST, 'NO_CUT', 'This video cannot be changed by words');
    const n = await this.kv.incr(`mv-edit:${userId}:${jstDay(new Date().toISOString())}`, 30 * 3600);
    if (n > VIDEO_EDITS_PER_DAY) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'EDIT_LIMIT', 'No more changes today');
    return this.jobs.create(userId, 'mv-edit', { mvId: id, origin: origin(req), from: b.from, mode: 'edit', edit: b });
  }

  /** R13: scenes painted again from a small spell (MAKE_COST.mvRedraw with the yes), then re-rendered */
  @Post(':id/redraw')
  @HttpCode(202)
  async redraw(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `mv-render:${userId}`, 6, 3600);
    const b = parseBody(MvRedrawBody, body);
    const p = await this.mv.get(userId, id);
    if (!p.cut || b.scenes.some((k) => k >= p.cut!.scenes.length)) throw apiError(HttpStatus.BAD_REQUEST, 'NO_CUT', 'No such scene');
    return startConfirmed({
      ledger: this.ledger,
      db: this.db,
      kv: this.kv,
      jobs: this.jobs,
      userId,
      kind: 'mvRedraw',
      refId: id,
      confirm: b.confirm,
      spell: spellKey('video', b.spell),
      required: true,
      create: () => this.jobs.create(userId, 'mv-edit', { mvId: id, origin: origin(req), from: b.from, mode: 'redraw', tags: b.spell, scenes: b.scenes, confirm: b.confirm, pay: 'mvRedraw' }),
    });
  }

  /** The same MV with the lyrics on it — a background job too. */
  @Post(':id/lyrics')
  @HttpCode(202)
  async lyrics(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    await rateLimit(this.kv, `mv-lyrics:${userId}`, 6, 3600);
    await this.mv.get(userId, id);
    return this.jobs.create(userId, 'mv-lyrics', { mvId: id, origin: origin(req) });
  }
}
