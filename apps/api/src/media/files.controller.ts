import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, ParseIntPipe, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { CLIP_CHUNK_BYTES, ClipStartBody } from '@obolo/shared';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { apiError } from '../common/errors';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { disposition, metaOf } from './clip-view';
import { FilesService } from './files.service';

/** one piece of an upload into memory (≤ CLIP_CHUNK_BYTES; more is refused as it arrives) */
export function readPiece(req: Request, max: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (Number(req.headers['content-length'] ?? 0) > max) return reject(apiError(HttpStatus.PAYLOAD_TOO_LARGE, 'TOO_LARGE', 'Piece too large'));
    const chunks: Buffer[] = [];
    let n = 0;
    req.on('data', (c: Buffer) => {
      n += c.length;
      if (n > max) {
        req.removeAllListeners('data');
        req.resume();
        return reject(apiError(HttpStatus.PAYLOAD_TOO_LARGE, 'TOO_LARGE', 'Piece too large'));
      }
      chunks.push(c);
    });
    req.on('error', reject);
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Bluena's 📎 (FilesService): GET / list, POST / start, POST /:id/parts/:n (raw bytes), POST /:id/done, GET /:id (owner or the
 * ダチ it was sent to), DELETE /:id, POST /:id/look ({bati} looks at a picture). Registered before MediaController so
 * GET /media/files is not read as GET /media/:id.
 */
@Controller('media/files')
@UseGuards(AuthGuard)
export class FilesController {
  constructor(
    private readonly files: FilesService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Get()
  list(@UserId() userId: string) {
    return this.files.list(userId);
  }

  @Post()
  @HttpCode(200)
  async start(@UserId() userId: string, @Body() body: unknown) {
    await rateLimit(this.kv, `upload-file:${userId}`, 60, 3600);
    return this.files.start(userId, parseBody(ClipStartBody, body));
  }

  // POST, not PUT: the CORS setup (main.ts) allows GET / POST / PATCH / DELETE
  @Post(':id/parts/:n')
  @HttpCode(200)
  async part(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Param('n', ParseIntPipe) n: number, @Req() req: Request) {
    await rateLimit(this.kv, `upload-part:${userId}`, 600, 3600);
    return this.files.part(userId, id, n, await readPiece(req, CLIP_CHUNK_BYTES));
  }

  @Post(':id/done')
  @HttpCode(200)
  done(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.files.done(userId, id, `${req.protocol}://${req.get('host')}`);
  }

  @Post(':id/look')
  @HttpCode(200)
  async look(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    await rateLimit(this.kv, `file-look:${userId}`, 20, 3600);
    return this.files.look(userId, id);
  }

  @Delete(':id')
  remove(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.files.remove(userId, id);
  }

  @Get(':id')
  async serve(@UserId() userId: string, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request, @Res() res: Response) {
    await rateLimit(this.kv, `file-read:${userId}`, 1200, 600);
    const r = await this.files.open(userId, id);
    const m = metaOf(r.meta);
    res.setHeader('content-type', r.mime);
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('content-security-policy', "default-src 'none'; sandbox");
    res.setHeader('cache-control', 'private, max-age=3600');
    res.setHeader('accept-ranges', 'bytes');
    if (m && m.sub !== 'poster') res.setHeader('content-disposition', disposition(m.sub, m.name));
    const range = /^bytes=\d*-\d*$/.test(req.headers.range ?? '') ? req.headers.range : undefined;
    if (r.data) {
      const total = r.data.length;
      const g = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
      if (g && (g[1] || g[2])) {
        const start = Math.max(0, g[1] ? Number(g[1]) : total - Number(g[2]));
        const end = Math.min(g[1] && g[2] ? Number(g[2]) : total - 1, total - 1);
        if (start > end) return res.status(416).setHeader('content-range', `bytes */${total}`).end();
        res.status(206).setHeader('content-range', `bytes ${start}-${end}/${total}`);
        res.setHeader('content-length', String(end - start + 1));
        return res.end(r.data.subarray(start, end + 1));
      }
      res.setHeader('content-length', String(total));
      return res.end(r.data);
    }
    const got = await this.files.bytes(r, range);
    if (!got.body) return res.status(got.status === 416 ? 416 : 502).end();
    res.status(got.status);
    if (got.length) res.setHeader('content-length', String(got.length));
    if (got.range) res.setHeader('content-range', got.range);
    if (Buffer.isBuffer(got.body)) return res.end(got.body);
    Readable.fromWeb(got.body as import('node:stream/web').ReadableStream).pipe(res);
  }
}
