import { Body, Controller, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DemoJobBody } from '@obolo/shared';
import { parseBody } from '../common/validate';
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

  /**
   * M-R253 §4: a stand-in job for review (no AI, no mana): it only waits `seconds` (a 20 s and a 2-minute one show the
   * two ways — wait in place / 「〇分後に戻ってきてね」); `failTimes` first tries fail to show the automatic re-try.
   */
  @Post('demo')
  @HttpCode(202)
  demo(@UserId() userId: string, @Body() body: unknown) {
    return this.jobs.create(userId, 'demo', parseBody(DemoJobBody, body));
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
