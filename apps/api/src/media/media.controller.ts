import { Controller, Get, Headers, NotFoundException, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

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
