import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
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
import { AccessService } from '../wallet/access.service';

/** Member voices (see VoiceService). */
@Controller('voice')
@UseGuards(AuthGuard)
export class VoiceController {
  constructor(
    private readonly voice: VoiceService,
    private readonly lines: LineVoiceService,
    private readonly batiVoices: BatiVoiceService,
    @Inject(KV) private readonly kv: KvStore,
    private readonly access: AccessService,
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
   * M-R246 (D03-S005 「声を聞かせる」): the day-2 recording → the member's own voice model (queued; M-R342: made from
   * the recording as it is, and used for their 「きれい」 ダチ voice messages — {bati} speaks in its egg's fixed voice).
   * Needs the start-of-app agreement (M-R247); without it nothing is kept.
   */
  @Post('bati')
  @HttpCode(200)
  async batiVoice(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `voice-bati:${userId}`, 10, 86400);
    return this.batiVoices.record(userId, parseBody(BatiVoiceBody, body), `${req.protocol}://${req.get('host')}`);
  }

  /** 〔声を消す〕 (settings): the member's recording and voice model are deleted */
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

  /**
   * The mic where the browser cannot hear by itself (iPhone Chrome, in-app browsers): one take as the raw body
   * (Content-Type: audio/*, parsed by express.raw in main.ts) → its words; the take is not stored.
   * PLACEHOLDER (P-VOICE-7): 300 a day and 40 in ten minutes per member.
   */
  @Post('dictate')
  @HttpCode(200)
  async dictate(@UserId() userId: string, @Headers('content-type') type: string | undefined, @Req() req: Request) {
    await rateLimit(this.kv, `voice-dictate:${userId}`, 300, 86400);
    await rateLimit(this.kv, `voice-dictate-burst:${userId}`, 40, 600);
    return this.voice.dictate(type, req.body);
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

  /** {bati}'s answer in the Moon chat, read aloud in {bati}'s voice (M-R179; M-R342: its egg's fixed voice); null when it cannot be made now */
  @Post('bati-says')
  @HttpCode(200)
  async batiSays(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `voice-bati-says:${userId}`, 30, 60);
    // M-R342, one rule for everyone: after the first journey, no voice (text only) at 0 mana — recorded or not, Obolo
    // Order or not; during the journey everyone hears {bati}
    if (await this.access.noVoice(userId)) return { url: null };
    return (await this.lines.batiSays(userId, parseBody(BatiSaysBody, body).text, `${req.protocol}://${req.get('host')}`)) ?? { url: null };
  }
}
