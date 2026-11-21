import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Ip, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { CreateRadioShowBody, RadioMessageBody, RadioNowBody, RadioReportBody, RadioSongPermissionBody, StartRadioLiveBody } from '@obolo/shared';
import { z } from 'zod';
import { assertAdmin } from '../admin/admin.guard';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import { AppConfig, CONFIG } from '../config';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { RadioService } from './radio.service';

const OnBody = z.object({ on: z.boolean() });
const StopBody = z.object({ reason: z.string().trim().max(200).default('') });

/** Venus — the radio planet (docs/工房とブルーナ_設計.md §9–10). */
@Controller('venus')
@UseGuards(AuthGuard)
export class RadioController {
  constructor(
    private readonly radio: RadioService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get()
  home(@UserId() userId: string) {
    return this.radio.home(userId);
  }

  /** the booth: Bluena's songs that may go on air */
  @Get('deck')
  deck(@UserId() userId: string) {
    return this.radio.deck(userId);
  }

  @Put('songs/:id/radio')
  songPermission(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.radio.setSongPermission(userId, id, parseBody(RadioSongPermissionBody, body).allow);
  }

  @Get('shows/mine')
  myShows(@UserId() userId: string) {
    return this.radio.myShows(userId);
  }

  @Post('shows')
  async createShow(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `radio-show:${userId}`, 20, 3600);
    return this.radio.createShow(userId, parseBody(CreateRadioShowBody, body));
  }

  @Get('shows/:id')
  show(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.radio.show(userId, id);
  }

  @Post('shows/:id/publish')
  publish(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.radio.publishShow(userId, id, parseBody(OnBody, body).on);
  }

  @Delete('shows/:id')
  @HttpCode(204)
  async removeShow(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.radio.removeShow(userId, id);
  }

  @Post('lives')
  async startLive(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `radio-live:${userId}`, 10, 3600);
    return this.radio.startLive(userId, parseBody(StartRadioLiveBody, body));
  }

  @Get('lives/:id')
  live(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.radio.live(userId, id);
  }

  @Post('lives/:id/now')
  async now(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await rateLimit(this.kv, `radio-now:${userId}`, 120, 600);
    return this.radio.setNow(userId, id, parseBody(RadioNowBody, body));
  }

  @Post('lives/:id/end')
  end(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.radio.endLive(userId, id);
  }

  @Post('lives/:id/messages')
  async message(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await rateLimit(this.kv, `radio-msg:${userId}`, 12, 60);
    return this.radio.message(userId, id, parseBody(RadioMessageBody, body));
  }

  @Post('lives/:id/messages/:mid/hide')
  @HttpCode(204)
  async hide(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Param('mid', new ParseUUIDPipe()) mid: string) {
    await this.radio.hideMessage(userId, id, mid);
  }

  @Post('report')
  @HttpCode(204)
  async report(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `radio-report:${userId}`, 20, 3600);
    await this.radio.report(userId, parseBody(RadioReportBody, body));
  }
}

/** Bluena 〔ブルーナにしまう〕: keep someone else's song (a link, not a copy). */
@Controller('bluena')
@UseGuards(AuthGuard)
export class BluenaController {
  constructor(private readonly radio: RadioService) {}

  @Post('keep/:postId')
  keep(@UserId() userId: string, @Param('postId', new ParseUUIDPipe()) postId: string, @Body() body: unknown) {
    return this.radio.keep(userId, postId, parseBody(OnBody, body).on);
  }
}

/** The team: stop a live show, take a recording down, hide a comment (admin token only). */
@Controller('admin/venus')
export class AdminRadioController {
  constructor(
    private readonly radio: RadioService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  private async guard(token: string | undefined, ip: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
  }

  @Get('lives')
  async lives(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string) {
    await this.guard(token, ip);
    return this.radio.adminLives();
  }

  @Post('lives/:id/stop')
  @HttpCode(204)
  async stop(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await this.guard(token, ip);
    await this.radio.adminStop(id, parseBody(StopBody, body ?? {}).reason);
  }

  @Post('shows/:id/remove')
  @HttpCode(204)
  async removeShow(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await this.guard(token, ip);
    await this.radio.adminRemoveShow(id, parseBody(OnBody, body).on);
  }

  @Post('messages/:id/hide')
  @HttpCode(204)
  async hideMessage(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.guard(token, ip);
    await this.radio.adminHideMessage(id);
  }
}
