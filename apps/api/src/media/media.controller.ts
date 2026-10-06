import { Controller, Get, Headers, HttpStatus, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { MEDIA_POLICY } from '@obolo/shared';
import type { Request, Response } from 'express';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { apiError } from '../common/errors';
import { rateLimit } from '../common/rate-limit';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { MediaService } from './media.service';

/** Stream the raw request body to a temp file (videos can be large), refusing more than `max` bytes. */
function receive(req: Request, file: string, max: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > max) return reject(apiError(HttpStatus.PAYLOAD_TOO_LARGE, 'TOO_LARGE', 'File too large'));
    let n = 0;
    const out = createWriteStream(file);
    req.on('data', (chunk: Buffer) => {
      n += chunk.length;
      if (n > max) {
        req.unpipe(out);
        out.destroy();
        req.resume();
        reject(apiError(HttpStatus.PAYLOAD_TOO_LARGE, 'TOO_LARGE', 'File too large'));
      }
    });
    req.on('error', reject);
    out.on('error', reject);
    out.on('finish', () => (n === 0 ? reject(apiError(HttpStatus.BAD_REQUEST, 'EMPTY_UPLOAD', 'No file received')) : resolve()));
    req.pipe(out);
  });
}

@Controller('media')
export class MediaController {
  constructor(
    private readonly media: MediaService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  /**
   * Raw photo / video body (Content-Type: image/* or video/*). Re-encoded before it is stored
   * (docs/media.md). Videos: ?max=<seconds> trims them (Jupiter asks for 8).
   */
  @Post('photo')
  @UseGuards(AuthGuard)
  async photo(@UserId() userId: string, @Headers('content-type') type: string | undefined, @Req() req: Request) {
    await rateLimit(this.kv, `upload:${userId}`, 30, 600);
    const dir = await mkdtemp(join(tmpdir(), 'obolo-up-'));
    try {
      await receive(req, join(dir, 'in'), MEDIA_POLICY.photo.maxUploadBytes);
      return await this.media.uploadPhoto(userId, type, join(dir, 'in'), `${req.protocol}://${req.get('host')}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  @Post('video')
  @UseGuards(AuthGuard)
  async video(@UserId() userId: string, @Headers('content-type') type: string | undefined, @Query('max') max: string | undefined, @Req() req: Request) {
    await rateLimit(this.kv, `upload:${userId}`, 30, 600);
    const dir = await mkdtemp(join(tmpdir(), 'obolo-up-'));
    try {
      await receive(req, join(dir, 'in'), MEDIA_POLICY.video.maxUploadBytes);
      return await this.media.uploadVideo(userId, type, join(dir, 'in'), Number(max ?? MEDIA_POLICY.video.maxSeconds), `${req.protocol}://${req.get('host')}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /** Raw audio body (Content-Type: audio/*). Parsed by express.raw in main.ts. */
  @Post('voice')
  @UseGuards(AuthGuard)
  upload(@UserId() userId: string, @Headers('content-type') type: string | undefined, @Req() req: Request) {
    return this.media.uploadVoice(userId, type, req.body, `${req.protocol}://${req.get('host')}`);
  }

  /** Dev/preview fallback delivery for media stored in Postgres (P-MEDIA-1). */
  @Get(':id')
  async serve(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request, @Res() res: Response) {
    const m = await this.media.readDbBlob(id);
    if (!m?.data) throw new NotFoundException();
    const total = m.data.length;
    res.setHeader('content-type', m.mime);
    res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    res.setHeader('accept-ranges', 'bytes');
    // Safari (iPad) only plays <audio> when byte-range requests are honoured.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : total - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : total - 1;
      start = Math.max(0, start);
      end = Math.min(end, total - 1);
      if (start > end) {
        res.status(416).setHeader('content-range', `bytes */${total}`);
        return res.end();
      }
      res.status(206).setHeader('content-range', `bytes ${start}-${end}/${total}`);
      res.setHeader('content-length', String(end - start + 1));
      return res.end(m.data.subarray(start, end + 1));
    }
    res.setHeader('content-length', String(total));
    res.end(m.data);
  }
}
