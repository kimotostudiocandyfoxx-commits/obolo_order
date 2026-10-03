import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Database } from './db/db';
import type { KvStore } from './infra/kv';
import { KV } from './infra/tokens';

@Controller()
export class HealthController {
  constructor(
    private readonly db: Database,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  /** Liveness — no dependencies, used by Cloud Run startup probe. */
  @Get('healthz')
  healthz() {
    return { ok: true };
  }

  /** Readiness — checks Postgres + Redis. */
  @Get('readyz')
  async readyz() {
    await this.db.write.execute(sql`select 1`);
    await this.kv.get('readyz');
    return { ok: true };
  }
}
