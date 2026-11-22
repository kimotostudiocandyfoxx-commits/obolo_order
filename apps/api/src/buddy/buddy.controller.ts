import { Body, Controller, Delete, Get, HttpCode, Inject, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BuddyChatBody, BuddyPictureBody, CompassBody, StoryBody, UpdateBuddyProfileBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { BuddyService } from './buddy.service';
import { CompassService } from './compass.service';
import { StoryService } from './story.service';
import { PictureService } from './picture.service';

/** where a picture kept in Postgres (dev, no Bunny) is served from */
const origin = (req: Request) => `${req.protocol}://${req.get('host')}`;

@Controller('buddy')
@UseGuards(AuthGuard)
export class BuddyController {
  constructor(
    private readonly buddy: BuddyService,
    private readonly pictures: PictureService,
    private readonly compass: CompassService,
    private readonly story: StoryService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get('profile')
  profile(@UserId() userId: string) {
    return this.buddy.getProfile(userId);
  }

  @Patch('profile')
  updateProfile(@UserId() userId: string, @Body() body: unknown) {
    return this.buddy.updateProfile(userId, parseBody(UpdateBuddyProfileBody, body));
  }

  @Get('messages')
  messages(@UserId() userId: string, @Query('cursor') cursor?: string) {
    return this.buddy.listMessages(userId, cursor);
  }

  @Get('quota')
  quota(@UserId() userId: string) {
    return this.buddy.getQuota(userId);
  }

  @Post('chat')
  @HttpCode(200)
  async chat(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    const { text, locale } = parseBody(BuddyChatBody, body);
    await rateLimit(this.kv, `buddy:${userId}`, 12, 60);
    return this.buddy.chat(userId, text, locale, undefined, origin(req));
  }

  /**
   * The same as POST /buddy/chat, written as it comes (Server-Sent Events): `event: text` pieces of an ordinary
   * answer, then `event: done` with the saved reply (BuddyChatResponse; M-R208: with `sources` / `image` when it was
   * looked up or drawn) or `event: error` with { code }.
   */
  @Post('chat/stream')
  async chatStream(@UserId() userId: string, @Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const { text, locale } = parseBody(BuddyChatBody, body);
    await rateLimit(this.kv, `buddy:${userId}`, 12, 60);
    res.status(200);
    res.setHeader('content-type', 'text/event-stream; charset=utf-8');
    res.setHeader('cache-control', 'no-cache, no-transform');
    res.setHeader('x-accel-buffering', 'no');
    res.flushHeaders();
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      const out = await this.buddy.chat(userId, text, locale, (piece) => send('text', { text: piece }), origin(req));
      send('done', out);
    } catch (err) {
      const e = err as { getResponse?: () => { error?: { code?: string } } };
      send('error', { code: e.getResponse?.()?.error?.code ?? 'BUDDY_UNAVAILABLE' });
    } finally {
      res.end();
    }
  }

  /** 〔🖼 絵で見る〕: a picture for an answer (null = none found; nothing is charged then) */
  @Post('picture')
  @HttpCode(200)
  async picture(@UserId() userId: string, @Body() body: unknown) {
    const { question, answer } = parseBody(BuddyPictureBody, body);
    await rateLimit(this.kv, `buddy-pic:${userId}`, 10, 60);
    return { picture: await this.pictures.find(userId, question, answer) };
  }

  /** 〔🧭 スペルコンパス〕: a picture / a song clip / a YouTube link → spell cards (nothing kept, no mana) */
  @Post('compass')
  @HttpCode(200)
  async readCompass(@UserId() userId: string, @Body() body: unknown) {
    const b = parseBody(CompassBody, body);
    await rateLimit(this.kv, `compass:${userId}`, 30, 3600);
    return { cards: await this.compass.read(b) };
  }

  /** 天王星 〔✒️ 書く〕: what was said → spell cards (free); the cards → a short story (mana, asked before) */
  @Post('story')
  @HttpCode(200)
  async writeStory(@UserId() userId: string, @Body() body: unknown) {
    const b = parseBody(StoryBody, body);
    await rateLimit(this.kv, `story:${userId}`, 30, 3600);
    return b.step === 'cards' ? this.story.cards(b.said) : this.story.write(userId, b.cards);
  }

  @Delete('memory')
  @HttpCode(204)
  async forget(@UserId() userId: string) {
    await this.buddy.forget(userId);
  }
}
