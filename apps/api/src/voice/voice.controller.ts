import { Body, Controller, Delete, Get, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { BatiSaysBody, BatiVoiceBody, LineVoicesBody, RegisterVoiceBody, SpeakBody, TranscribeBody } from '@obolo/shared';
import type { Request } from 'express';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { BatiVoiceService } from './bati-voice.service';
import { LineVoiceService } from './line-voice.service';
import { VoiceService } from './voice.service';

/** Member voices (see VoiceService). */
@Controller('voice')
@UseGuards(AuthGuard)
export class VoiceController {
  constructor(
    private readonly voice: VoiceService,
    private readonly lines: LineVoiceService,
    private readonly batiVoices: BatiVoiceService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  /** whether the voice service (Fish Audio) is connected here — the 〔バティの声ためし〕 page asks first */
  @Get('status')
  status() {
    return { fish: this.voice.connected };
  }

  @Post('register')
  @HttpCode(200)
  async register(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `voice-reg:${userId}`, 10, 86400);
    return this.voice.register(userId, parseBody(RegisterVoiceBody, body), `${req.protocol}://${req.get('host')}`);
  }

  /**
   * M-R246 (D03-S005 「たまごに声を聞かせる」): the egg recording → {bati}'s voice (a queued voice model, +2 semitones).
   * Needs the start-of-app agreement (M-R247); without it nothing is kept and {bati} keeps the default voice.
   */
  @Post('bati')
  @HttpCode(200)
  async batiVoice(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `voice-bati:${userId}`, 10, 86400);
    return this.batiVoices.record(userId, parseBody(BatiVoiceBody, body), `${req.protocol}://${req.get('host')}`);
  }

  /** 〔声を消す〕 (settings): the recording and the voice model are deleted; the default voice again */
  @Delete('bati')
  removeBatiVoice(@UserId() userId: string) {
    return this.batiVoices.remove(userId);
  }

  /** Mic first: the words of a recording (PLACEHOLDER P-VOICE-7: 200 a day). */
  @Post('transcribe')
  @HttpCode(200)
  async transcribe(@UserId() userId: string, @Body() body: unknown) {
    const b = parseBody(TranscribeBody, body);
    await rateLimit(this.kv, `voice-stt:${userId}`, 200, 86400);
    return this.voice.transcribe(userId, b.mediaId);
  }

  /** PLACEHOLDER (P-VOICE-3): 100 read-alouds a day per member until pricing is decided. */
  @Post('speak')
  @HttpCode(200)
  async speak(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `voice-speak:${userId}`, 100, 86400);
    return this.voice.speak(userId, parseBody(SpeakBody, body), `${req.protocol}://${req.get('host')}`);
  }

  /** The story lines with the member's names in them: the voiced ones, and the rest start being voiced (poll). */
  @Post('lines')
  @HttpCode(200)
  async lineVoices(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `voice-lines:${userId}`, 40, 60);
    return this.lines.get(userId, parseBody(LineVoicesBody, body), `${req.protocol}://${req.get('host')}`);
  }

  /** {bati}'s answer in the Moon chat, read aloud in {bati}'s story voice (M-R179); null when it cannot be made now */
  @Post('bati-says')
  @HttpCode(200)
  async batiSays(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `voice-bati-says:${userId}`, 30, 60);
    return (await this.lines.batiSays(userId, parseBody(BatiSaysBody, body).text, `${req.protocol}://${req.get('host')}`)) ?? { url: null };
  }
}
