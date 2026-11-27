import { Body, Controller, Get, Headers, HttpCode, Inject, Ip, Logger, Post } from '@nestjs/common';
import { MicDiagBody } from '@obolo/shared';
import { assertAdmin } from '../admin/admin.guard';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import { AppConfig, CONFIG } from '../config';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { readMicDiag, recordMicDiag } from './mic-diag';

/**
 * Client 2026-11-27 (phones: 「マイクが反応しないことが多い」): the web app tells here when a microphone could not be used
 * — which place, which fault, which browser family — so the operator can see what fails in production (docs/mic.md).
 * No sign-in (the story's mic is used before there is an account), so: a small fixed body (MicDiagBody: enums and
 * short words, no free text), 30 an hour per address, and nothing about the member is kept (no id, no address, no
 * user agent). Each report is also one log line (`mic-diag {…}`) for Cloud Logging.
 */
@Controller()
export class MicDiagController {
  private readonly log = new Logger('MicDiag');
  constructor(
    @Inject(KV) private readonly kv: KvStore,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  @Post('diag/mic')
  @HttpCode(204)
  async report(@Body() body: unknown, @Ip() ip: string): Promise<void> {
    await rateLimit(this.kv, `diag-mic:${ip}`, 30, 3600);
    const b = parseBody(MicDiagBody, body);
    this.log.warn(`mic-diag ${JSON.stringify(b)}`);
    await recordMicDiag(this.kv, b).catch((e) => this.log.warn(`mic-diag not kept: ${String(e)}`));
  }

  /** the operator's view: the last reports and the counts per day (x-admin-token) */
  @Get('admin/diag/mic')
  async read(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
    return readMicDiag(this.kv);
  }
}
