import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { SendDmBody, StartCallBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { CommsService } from './comms.service';

/** Earth mail & phone (members, between ダチ). See docs/earth-comms.md. */
@Controller('comms')
@UseGuards(AuthGuard)
export class CommsController {
  constructor(
    private readonly comms: CommsService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get('status')
  status(@UserId() userId: string) {
    return this.comms.status(userId);
  }

  @Get('contacts')
  contacts(@UserId() userId: string) {
    return this.comms.contacts(userId);
  }

  @Get('messages/:peer')
  messages(@UserId() userId: string, @Param('peer', new ParseUUIDPipe()) peer: string, @Query('after') after?: string) {
    return this.comms.messages(userId, peer, after && !Number.isNaN(Date.parse(after)) ? after : undefined);
  }

  @Post('messages/:peer')
  async send(@UserId() userId: string, @Param('peer', new ParseUUIDPipe()) peer: string, @Body() body: unknown) {
    await rateLimit(this.kv, `dm:${userId}`, 60, 600);
    return this.comms.send(userId, peer, parseBody(SendDmBody, body));
  }

  @Post('messages/:peer/read')
  @HttpCode(200)
  read(@UserId() userId: string, @Param('peer', new ParseUUIDPipe()) peer: string) {
    return this.comms.markRead(userId, peer);
  }

  @Post('firebase-token')
  @HttpCode(200)
  firebaseToken(@UserId() userId: string) {
    return this.comms.firebaseToken(userId);
  }

  @Post('calls')
  async startCall(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `call:${userId}`, 20, 600);
    return this.comms.startCall(userId, parseBody(StartCallBody, body).to);
  }

  @Get('calls/incoming')
  incoming(@UserId() userId: string) {
    return this.comms.incoming(userId);
  }

  @Get('calls/:id')
  getCall(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.comms.getCall(userId, id);
  }

  @Post('calls/:id/answer')
  @HttpCode(200)
  answer(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.comms.answer(userId, id);
  }

  @Post('calls/:id/decline')
  @HttpCode(200)
  decline(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.comms.decline(userId, id);
  }

  @Post('calls/:id/end')
  @HttpCode(200)
  end(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.comms.end(userId, id);
  }
}
