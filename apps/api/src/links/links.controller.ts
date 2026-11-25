import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { barePreview, UnfurlBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { checkUrl, FetchRefused } from './guard';
import { LinksService } from './links.service';

/**
 * R12: POST /links/unfurl {url} — a pasted link's preview (LinksService). Signed-in members only; a cached link is free,
 * a new one counts: 20 in 10 minutes and 200 a day per member. A URL the guard refuses outright (scheme, port,
 * credentials) is answered with its bare preview (the portal then shows just the domain), never fetched.
 */
@Controller('links')
@UseGuards(AuthGuard)
export class LinksController {
  constructor(
    private readonly links: LinksService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('unfurl')
  @HttpCode(200)
  async unfurl(@UserId() userId: string, @Body() body: unknown) {
    const { url } = parseBody(UnfurlBody, body);
    try {
      checkUrl(url);
    } catch (e) {
      if (e instanceof FetchRefused) return barePreview(url);
      throw e;
    }
    const hit = await this.links.cached(url);
    if (hit) return hit;
    await rateLimit(this.kv, `unfurl:${userId}`, 20, 600);
    await rateLimit(this.kv, `unfurl-day:${userId}`, 200, 86400);
    return this.links.read(url);
  }
}
