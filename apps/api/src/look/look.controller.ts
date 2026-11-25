import { Body, Controller, Delete, Headers, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { BatiForgetBody, BatiMemoryBody, BatiRoleBody, BatiEggBody, BatiIdBody, BatiNameBody, BatiNewHatchBody, BatiSpeechBody, BatiRestyleBody, BatiRestyleChooseBody, ChooseLookBody, LookRestoreBody, ChoosePuniPicBody, NeoLookBody, PuniPicBody, RefineLookBody, StickerArtBody } from '@obolo/shared';
import type { Request } from 'express';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import { AppConfig, CONFIG } from '../config';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { LookService } from './look.service';
import { BatiMemoryService } from './memory.service';

const origin = (req: Request) => `${req.protocol}://${req.get('host')}`;

@Controller('me')
@UseGuards(AuthGuard)
export class LookController {
  constructor(
    private readonly look: LookService,
    private readonly memory: BatiMemoryService,
    @Inject(KV) private readonly kv: KvStore,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  /** The operator's admin token lifts the try limits (for testing the generation). */
  private admin(token?: string) {
    const expected = this.cfg.ADMIN_TOKEN;
    return !!expected && !!token && token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  }

  @Post('look/candidates')
  @HttpCode(200)
  async candidates(@UserId() userId: string, @Body() body: unknown, @Req() req: Request, @Headers('x-admin-token') token?: string) {
    await rateLimit(this.kv, `look:${userId}`, 4, 60);
    return this.look.candidates(userId, parseBody(NeoLookBody, body), origin(req), this.admin(token));
  }

  @Post('look/refine')
  @HttpCode(200)
  async refine(@UserId() userId: string, @Body() body: unknown, @Req() req: Request, @Headers('x-admin-token') token?: string) {
    await rateLimit(this.kv, `look:${userId}`, 6, 60);
    return this.look.refine(userId, parseBody(RefineLookBody, body), origin(req), this.admin(token));
  }

  @Post('look')
  @HttpCode(200)
  choose(@UserId() userId: string, @Body() body: unknown, @Req() req: Request, @Headers('x-admin-token') token?: string) {
    return this.look.choose(userId, parseBody(ChooseLookBody, body).mediaId, origin(req), this.admin(token));
  }

  /** Saturn picture character: 2 painted candidates (3 tries a day, P-PUNI-4). */
  @Post('puni/pic/candidates')
  @HttpCode(200)
  async puniPic(@UserId() userId: string, @Body() body: unknown, @Req() req: Request, @Headers('x-admin-token') token?: string) {
    await rateLimit(this.kv, `puni-pic:${userId}`, 4, 60);
    return this.look.puniPicCandidates(userId, parseBody(PuniPicBody, body), origin(req), this.admin(token));
  }

  @Post('puni/pic')
  @HttpCode(200)
  choosePuniPic(@UserId() userId: string, @Body() body: unknown) {
    return this.look.choosePuniPic(userId, parseBody(ChoosePuniPicBody, body).mediaId);
  }

  /** Jupiter butterfly: 2 painted candidates (3 tries a day, P-JUP-5). */
  @Post('butterfly/candidates')
  @HttpCode(200)
  async butterfly(@UserId() userId: string, @Body() body: unknown, @Req() req: Request, @Headers('x-admin-token') token?: string) {
    await rateLimit(this.kv, `puni-pic:${userId}`, 4, 60);
    return this.look.puniPicCandidates(userId, parseBody(PuniPicBody, body), origin(req), this.admin(token), 'butterfly');
  }

  /** Jupiter (first journey): Bati draws a sticker's picture from its words. */
  @Post('sticker/art')
  @HttpCode(200)
  async stickerArt(@UserId() userId: string, @Body() body: unknown, @Req() req: Request, @Headers('x-admin-token') token?: string) {
    await rateLimit(this.kv, `sticker-art:${userId}`, 4, 60);
    return this.look.stickerArt(userId, parseBody(StickerArtBody, body), origin(req), this.admin(token));
  }

  @Post('butterfly')
  @HttpCode(200)
  chooseButterfly(@UserId() userId: string, @Body() body: unknown) {
    return this.look.chooseButterfly(userId, parseBody(ChoosePuniPicBody, body).mediaId);
  }

  @Post('bati/egg')
  @HttpCode(200)
  egg(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    return this.look.egg(userId, parseBody(BatiEggBody, body), origin(req));
  }

  @Post('bati/hatch')
  @HttpCode(200)
  async hatch(@UserId() userId: string, @Req() req: Request) {
    await rateLimit(this.kv, `hatch:${userId}`, 4, 60);
    return this.look.hatch(userId, origin(req));
  }

  /** the NEO look standing without a background (M-R149), drawn once per look */
  @Post('look/standee')
  @HttpCode(200)
  async standee(@UserId() userId: string, @Req() req: Request) {
    await rateLimit(this.kv, `standee:${userId}`, 4, 600);
    return this.look.standee(userId, origin(req));
  }

  /** the small chibi NEO (the butterfly, the owl, the captain…; M-R155/M-R161), drawn once per look */
  @Post('look/chibi')
  @HttpCode(200)
  async chibi(@UserId() userId: string, @Req() req: Request) {
    await rateLimit(this.kv, `chibi:${userId}`, 4, 600);
    return this.look.standee(userId, origin(req), 'chibi');
  }

  /** Bati's expressions, drawn once after the hatching (M-R139) */
  @Post('bati/faces')
  @HttpCode(200)
  async faces(@UserId() userId: string, @Req() req: Request) {
    await rateLimit(this.kv, `bati-faces:${userId}`, 3, 600);
    return this.look.batiFaces(userId, origin(req));
  }

  /** Bati's room (P-BATI-ROOM): the Bati dressed up / changed a little by the wish — 3 pictures, 8 rounds a day */
  @Post('bati/restyle')
  @HttpCode(200)
  async restyle(@UserId() userId: string, @Body() body: unknown, @Req() req: Request, @Headers('x-admin-token') token?: string) {
    await rateLimit(this.kv, `bati-restyle:${userId}`, 4, 60);
    return this.look.restyle(userId, parseBody(BatiRestyleBody, body), origin(req), this.admin(token));
  }

  /** M-R223 〔前に戻す〕: the {bati} look decided before the one worn now */
  @Post('bati/restyle/back')
  @HttpCode(200)
  restyleBack(@UserId() userId: string, @Req() req: Request) {
    return this.look.restyleBack(userId, origin(req));
  }

  /** M-R247 〔写真を消す〕: every look made from the photo goes (the photo itself was never kept); the placeholder look again */
  @Delete('look')
  removeLook(@UserId() userId: string) {
    return this.look.removeLook(userId);
  }

  /** M-R223: Bluena's first shelf — a {bati} look kept before, worn again */
  @Post('bati/look/restore')
  @HttpCode(200)
  restoreBati(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    return this.look.restoreBati(userId, parseBody(LookRestoreBody, body).url, origin(req));
  }

  /** M-R223: Bluena's first shelf — a look of one's own worn before, worn again */
  @Post('look/restore')
  @HttpCode(200)
  restoreLook(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    return this.look.restoreLook(userId, parseBody(LookRestoreBody, body).url, origin(req));
  }

  @Post('bati/restyle/choose')
  @HttpCode(200)
  chooseRestyle(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    return this.look.chooseRestyle(userId, parseBody(BatiRestyleChooseBody, body).id, origin(req));
  }

  /** M-R215: another of the member's {bati} comes into the chat */
  @Post('bati/switch')
  @HttpCode(200)
  switchBati(@UserId() userId: string, @Body() body: unknown) {
    return this.look.switchBati(userId, parseBody(BatiIdBody, body).id);
  }

  /** M-R215: how {bati} calls the member (呼び方) and its 一人称 */
  @Post('bati/speech')
  @HttpCode(200)
  speech(@UserId() userId: string, @Body() body: unknown) {
    return this.look.batiSpeech(userId, parseBody(BatiSpeechBody, body));
  }

  /** M-R218: the grown egg hatches in the Moon temple (refused before it is ready / once three are born) */
  @Post('bati/new')
  @HttpCode(200)
  async hatchNew(@UserId() userId: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.kv, `hatch:${userId}`, 4, 60);
    return this.look.hatchNew(userId, parseBody(BatiNewHatchBody, body), origin(req));
  }

  /** M-R222: the card's 〔覚えさせる〕 (the chat's 「覚えといて」 is found by the chat itself) */
  @Post('bati/memory')
  @HttpCode(200)
  async remember(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `bati-memory:${userId}`, 20, 60);
    const b = parseBody(BatiMemoryBody, body);
    return this.memory.add(userId, b.text, b.id);
  }

  /** M-R222: forget one of 「覚えてること」, or all */
  @Post('bati/memory/forget')
  @HttpCode(200)
  forget(@UserId() userId: string, @Body() body: unknown) {
    return this.memory.forget(userId, parseBody(BatiForgetBody, body));
  }

  /** the role of the 2nd / 3rd {bati} (なんでも / 遊び / 仕事・勉強 / 作ること); the 1st starts as なんでも */
  @Post('bati/role')
  @HttpCode(200)
  role(@UserId() userId: string, @Body() body: unknown) {
    return this.memory.role(userId, parseBody(BatiRoleBody, body));
  }

  @Post('bati/name')
  @HttpCode(200)
  name(@UserId() userId: string, @Body() body: unknown) {
    return this.look.name(userId, parseBody(BatiNameBody, body).name);
  }
}
