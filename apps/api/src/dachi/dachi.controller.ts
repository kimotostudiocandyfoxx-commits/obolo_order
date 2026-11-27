import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DACHI_SEND_PER_DAY, DACHI_SEND_PER_HOUR, KIMORIN_REPLIES_PER_DAY, DELIVERY_KINDS, DeliverBody, isCharacterThread, isVoiceVersion, SendDachiMessageBody, VoiceTuneBody, VoiceVersionBody, type DachiVoiceDraft, type VoiceVersionView } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { apiError } from '../common/errors';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { DachiLinkService } from './dachi-link.service';
import { DachiService } from './dachi.service';
import { DachiVoiceService } from './dachi-voice.service';
import { DachiVoiceDraftService } from './voice-draft.service';
import { CuteVoiceService } from './cute-voice.service';
import { AccessService } from '../wallet/access.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** a thread: a dachi's user id, or a character's ('kimorin' | 'mikie') */
function checkThread(id: string) {
  if (!isCharacterThread(id) && !UUID_RE.test(id)) throw new NotFoundException();
  return id.toLowerCase();
}

@Controller('dachi')
@UseGuards(AuthGuard)
export class DachiController {
  constructor(
    private readonly dachi: DachiService,
    private readonly links: DachiLinkService,
    private readonly voice: DachiVoiceService,
    @Inject(KV) private readonly kv: KvStore,
    private readonly access: AccessService,
    private readonly drafts: DachiVoiceDraftService,
    private readonly cute: CuteVoiceService,
  ) {}

  @Get()
  list(@UserId() userId: string) {
    return this.dachi.list(userId);
  }

  /** D04-S005c: become dachi with the one who invited you */
  @Post('inviter')
  @HttpCode(200)
  async befriendInviter(@UserId() userId: string) {
    const d = await this.dachi.befriendInviter(userId);
    // the ダチ threads appear from now (M-R212): {inviter}'s voice (or MIKIE⭐︎DRILL's welcome) is waiting
    await this.voice.markDachi(userId);
    return d;
  }

  // ── ダチの声のメッセージ (M-R212) ──

  /** the drawer's conversations (empty until D04-S005c) */
  @Get('threads')
  threads(@UserId() userId: string) {
    return this.voice.threads(userId);
  }

  /** R10: every ダチ talk, newest first, with its last message — ?cursor= for the next page */
  @Get('history')
  history(@UserId() userId: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.voice.history(userId, cursor?.slice(0, 120) || null, Number(limit) || undefined);
  }

  /** R10: ?before=<createdAt>&limit= for the older ones (oldest first, as always) */
  @Get('threads/:id/messages')
  messages(@UserId() userId: string, @Param('id') id: string, @Query('before') before?: string, @Query('limit') limit?: string) {
    return this.voice.messages(userId, checkThread(id), { before: before?.slice(0, 40) || undefined, limit: Number(limit) || undefined });
  }

  /** a voice message (from POST /media/voice, ≤ 60 s) or a Bluena work card — only to a dachi */
  @Post('threads/:id/messages')
  async send(@UserId() userId: string, @Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const thread = checkThread(id);
    const b = parseBody(SendDachiMessageBody, body);
    await rateLimit(this.kv, `dachi-voice:${userId}`, DACHI_SEND_PER_HOUR, 3600);
    await rateLimit(this.kv, `dachi-voice-day:${userId}`, DACHI_SEND_PER_DAY, 86400);
    // R18: free for everyone, even at 0 mana (its costs are absorbed as marketing); a non-member's soft daily cap
    await this.access.dachiSend(userId);
    // R9: KIMORIN⭐︎ answers, up to KIMORIN_REPLIES_PER_DAY a day (past it the message stands, unanswered)
    const reply = thread === 'kimorin' && (await this.kv.incr(`kimorin-day:${userId}:${Math.floor(Date.now() / 86_400_000)}`, 86_400)) <= KIMORIN_REPLIES_PER_DAY;
    // R18: KIMORIN⭐︎'s read-aloud falls back to text for a non-member at 0 mana (the words stay free)
    const voiced = !(reply && (await this.access.outOfMana(userId)));
    return this.voice.send(userId, thread, b, { reply, voiced, origin: `${req.protocol}://${req.get('host')}` });
  }

  // ── client 2026-11-27: a voice message made ready (clean-up, the member's voice settings, its words, a quiet sound) ──

  /**
   * the recording as the raw body (audio/*, main.ts) → made ready in the version the member sends (remembered;
   * `?as=asis|clean` asks for the other one — the button on the draft card). 「そのまま」: the made-ready voice kept,
   * its words, the sound picked from them. 「きれい」: its words and the sound only — nothing of the take is kept.
   */
  @Post('voice')
  @HttpCode(200)
  async voiceDraft(@UserId() userId: string, @Headers('content-type') type: string | undefined, @Req() req: Request, @Query('as') as?: string): Promise<DachiVoiceDraft> {
    await rateLimit(this.kv, `dachi-voice-draft:${userId}`, 40, 3600);
    const clean = await this.cute.cleanInfo(userId);
    const draft = await this.drafts.draft(userId, type, req.body, `${req.protocol}://${req.get('host')}`, { as: isVoiceVersion(as) ? as : undefined, cleanOn: clean.on });
    return { ...draft, clean };
  }

  /** the one button on the draft card: 「そのまま」 or 「きれい」, remembered for the next takes (shared voiceVersion.ts) */
  @Put('voice/version')
  async setVoiceVersion(@UserId() userId: string, @Body() body: unknown): Promise<VoiceVersionView> {
    await rateLimit(this.kv, `dachi-voice-version:${userId}`, 120, 3600);
    const version = await this.drafts.setVersion(userId, parseBody(VoiceVersionBody, body).version);
    return { version, clean: await this.cute.cleanInfo(userId) };
  }

  /**
   * client 2026-11-27 (shared/cuteVoice.ts): is this member's ダチ talk read by the default cute voice (a member who is
   * not recorded, the voice service on), and the live price's two numbers — the talk shows 「−0.3」 before the send
   */
  @Get('voice/cute')
  cuteVoice(@UserId() userId: string) {
    return this.cute.info(userId);
  }

  /**
   * client 2026-11-27 (after trying it): the SENDER does not hear their own voice. The two endpoints that played it back
   * — the draft's mix (〔▶ きいてみる〕) and the settings' trial on the last take — refuse for everyone (410), whatever an
   * older page asks: it is not only the buttons that are gone.
   */
  @Post('voice/preview')
  voicePreview(): never {
    throw apiError(HttpStatus.GONE, 'VOICE_NOT_PLAYED', 'Your own voice message is not played back');
  }
  @Post('voice/tune/preview')
  voiceTunePreview(): never {
    throw apiError(HttpStatus.GONE, 'VOICE_NOT_PLAYED', 'Your own voice message is not played back');
  }

  // ── client 2026-11-27: the member's own voice settings (shared voiceTune.ts), changed by talking to {bati} ──

  @Get('voice/tune')
  voiceTune(@UserId() userId: string) {
    return this.drafts.tune(userId);
  }

  /** the parts to change (clamped here whatever is sent), or `reset` */
  @Put('voice/tune')
  async setVoiceTune(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `dachi-voice-tune:${userId}`, 120, 3600);
    return this.drafts.setTune(userId, parseBody(VoiceTuneBody, body));
  }

  /** 〔とりなおす〕 / the other version chosen: the draft's file goes */
  @Delete('voice/:mediaId')
  @HttpCode(200)
  discardVoice(@UserId() userId: string, @Param('mediaId') mediaId: string) {
    if (!UUID_RE.test(mediaId)) throw new NotFoundException();
    return this.drafts.discard(userId, mediaId);
  }

  @Post('threads/:id/read')
  @HttpCode(200)
  read(@UserId() userId: string, @Param('id') id: string) {
    return this.voice.markRead(userId, checkThread(id));
  }

  /** 〔ダチへ〕 — a work goes to every dachi's 〔推し〕 for 88 hours */
  @Post('deliver')
  @HttpCode(200)
  async deliver(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `deliver:${userId}`, 30, 3600);
    return this.dachi.deliver(userId, parseBody(DeliverBody, body));
  }

  /** 〔推し〕 — what the dachi delivered in the last 88 hours (optionally one kind) */
  @Get('oshi')
  oshi(@UserId() userId: string, @Query('kind') kind?: string) {
    return this.dachi.oshi(userId, kind && (DELIVERY_KINDS as readonly string[]).includes(kind) ? kind : undefined);
  }

  /** 〔🤝 ダチの招待状〕 (M-R175): a link of one's own, once, 48 hours */
  @Post('link')
  @HttpCode(200)
  async createLink(@UserId() userId: string) {
    await rateLimit(this.kv, `dachilink:${userId}`, 10, 3600);
    return this.links.create(userId);
  }

  /** the giver's side: who opened a link and is waiting for 〔ダチになる〕 */
  @Get('link/asks')
  asks(@UserId() userId: string) {
    return this.links.asks(userId);
  }

  @Get('link/:token')
  peekLink(@UserId() userId: string, @Param('token') token: string) {
    return this.links.peek(userId, token);
  }

  /** the one who opened it presses 〔ダチになる〕 */
  @Post('link/:token/open')
  @HttpCode(200)
  async openLink(@UserId() userId: string, @Param('token') token: string) {
    await rateLimit(this.kv, `dachilink-open:${userId}`, 30, 3600);
    return this.links.open(userId, token);
  }

  /** the giver presses 〔ダチになる〕 too */
  @Post('link/:token/confirm')
  @HttpCode(200)
  confirmLink(@UserId() userId: string, @Param('token') token: string) {
    return this.links.confirm(userId, token);
  }

  /** 〔やめる〕 */
  @Delete('link/:token')
  @HttpCode(200)
  async endLink(@UserId() userId: string, @Param('token') token: string) {
    await this.links.end(userId, token);
    return { ok: true };
  }
}
