import { Body, Controller, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { AppConfig, CONFIG } from '../config';
import type { JobName, JobQueue } from '../infra/queue';
import { QUEUE } from '../infra/tokens';
import { JobsService } from './jobs.service';

/** The member's background work (a song, an MV): the app polls it while waiting. */
@Controller('jobs')
@UseGuards(AuthGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  async active(@UserId() userId: string) {
    return { jobs: await this.jobs.active(userId) };
  }

  @Get(':id')
  get(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.jobs.get(userId, id);
  }
}

/**
 * Where Cloud Tasks delivers queued jobs (QUEUE_DRIVER=cloudtasks): only calls signed by the
 * runtime service account (OIDC token for this API's URL) are run. The work happens inside this
 * request, so Cloud Run keeps the CPU on for it (up to the request timeout).
 */
@Controller('internal/jobs')
export class InternalJobsController {
  private readonly oauth = new OAuth2Client();
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(QUEUE) private readonly queue: JobQueue,
  ) {}

  @Post(':name')
  @HttpCode(200)
  async run(@Param('name') name: string, @Body() body: unknown, @Req() req: Request) {
    if (this.cfg.QUEUE_DRIVER !== 'cloudtasks') throw new NotFoundException();
    const token = (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    try {
      const ticket = await this.oauth.verifyIdToken({ idToken: token, audience: this.cfg.JOBS_TARGET_URL });
      const p = ticket.getPayload();
      if (!p?.email_verified || p.email !== this.cfg.JOBS_INVOKER_SA) throw new Error('wrong caller');
    } catch {
      throw new ForbiddenException();
    }
    const handler = this.queue.getHandler(name as JobName);
    if (!handler) throw new NotFoundException();
    await handler(body as never);
    return { ok: true };
  }
}
