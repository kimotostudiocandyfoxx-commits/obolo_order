import { Controller, Headers, HttpCode, Inject, Ip, Post } from '@nestjs/common';
import { assertAdmin } from '../admin/admin.guard';
import { rateLimit } from '../common/rate-limit';
import { AppConfig, CONFIG } from '../config';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { ManaCheckService } from './mana-check.service';

/** The team runs the mana ledger's chain check by hand (admin token only; otherwise this does not exist). */
@Controller('admin/mana')
export class ManaAdminController {
  constructor(
    private readonly check: ManaCheckService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('check')
  @HttpCode(200)
  async run(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
    await rateLimit(this.kv, 'admin:mana-check', 6, 3600);
    const r = await this.check.run();
    return { ...r, problems: r.problems.slice(0, 200), problemCount: r.problems.length };
  }
}
