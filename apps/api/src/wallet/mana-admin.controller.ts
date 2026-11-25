import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Inject, Ip, Post, Put, Query } from '@nestjs/common';
import { fxMonth, type ManaPrices } from '@obolo/shared';
import { z } from 'zod';
import { assertAdmin } from '../admin/admin.guard';
import { rateLimit } from '../common/rate-limit';
import { AppConfig, CONFIG } from '../config';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { CostService } from './cost.service';
import { ManaCheckService } from './mana-check.service';

const FxBody = z.object({
  /** YYYY-MM (Japan time); default: next month */
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  usdJpy: z.number().min(50).max(500),
  note: z.string().max(200).optional(),
});

/** the month after `now` (Japan time) */
export function nextMonth(now = new Date()): string {
  const [y, m] = fxMonth(now).split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** The team's mana tools (admin token only; otherwise this does not exist). */
@Controller('admin/mana')
export class ManaAdminController {
  constructor(
    private readonly check: ManaCheckService,
    private readonly costs: CostService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  private async admin(token: string | undefined, ip: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
  }

  @Post('check')
  @HttpCode(200)
  async run(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string) {
    await this.admin(token, ip);
    await rateLimit(this.kv, 'admin:mana-check', 6, 3600);
    const r = await this.check.run();
    return { ...r, problems: r.problems.slice(0, 200), problemCount: r.problems.length };
  }

  /** the daily check's report: mana taken vs cost + Stripe's fee per kind, the kinds under 8% and the suggested prices */
  @Get('margins')
  async margins(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Query('days') days?: string) {
    await this.admin(token, ip);
    const d = Math.min(90, Math.max(1, Number(days) || 1));
    return this.costs.report(d);
  }

  /** refine the prices from the recorded costs now (the daily check does it too) */
  @Post('refine')
  @HttpCode(200)
  async refine(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string): Promise<{ refined: Record<string, number>; prices: ManaPrices }> {
    await this.admin(token, ip);
    const refined = await this.costs.refine();
    return { refined, prices: await this.costs.prices() };
  }

  /** this month's USD→JPY and the prices it gives */
  @Get('fx')
  async fx(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string) {
    await this.admin(token, ip);
    return { month: fxMonth(), next: nextMonth(), fx: await this.costs.fx(), prices: await this.costs.prices() };
  }

  /** set a month's USD→JPY (the monthly review: next month's rate, before it starts; a conservative = weak-yen rate) */
  @Put('fx')
  async setFx(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Body() body: unknown) {
    await this.admin(token, ip);
    const b = FxBody.safeParse(body);
    if (!b.success) throw new BadRequestException('month (YYYY-MM) and usdJpy (50–500) are needed');
    const set = await this.costs.setFx(b.data.month ?? nextMonth(), b.data.usdJpy, b.data.note ?? null);
    return { ...set, fx: await this.costs.fx(), prices: await this.costs.prices() };
  }
}
