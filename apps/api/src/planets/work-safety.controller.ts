import { Body, Controller, HttpCode, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { PLANET_WORK_KINDS, PlanetWorkHideBody, PlanetWorkReportBody, type PlanetWorkKind } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { apiError } from '../common/errors';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { WorkSafetyService } from './work-safety.service';

const kindOf = (k: string): PlanetWorkKind => {
  if ((PLANET_WORK_KINDS as readonly string[]).includes(k)) return k as PlanetWorkKind;
  throw apiError(404, 'NOT_FOUND', 'Unknown kind');
};

/** M-R213: 〔見えなくする〕 and 〔通報〕 on any planet work (Saturn, Jupiter, Mercury, Mars, Venus). */
@Controller('planet-works/:kind/:id')
@UseGuards(AuthGuard)
export class WorkSafetyController {
  constructor(
    private readonly safety: WorkSafetyService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('hide')
  @HttpCode(200)
  hide(@UserId() userId: string, @Param('kind') kind: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.safety.hide(userId, kindOf(kind), id, parseBody(PlanetWorkHideBody, body).on);
  }

  @Post('report')
  @HttpCode(204)
  async report(@UserId() userId: string, @Param('kind') kind: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await rateLimit(this.kv, `work-report:${userId}`, 20, 3600);
    await this.safety.report(userId, kindOf(kind), id, parseBody(PlanetWorkReportBody, body));
  }
}
