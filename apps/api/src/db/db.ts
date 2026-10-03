import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { AppConfig } from '../config';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

/**
 * Read/write split (scale decision 2026-10-03):
 *  - `write`: primary. Use for all writes and for reads that must see the caller's own write.
 *  - `read`:  replica when DATABASE_READ_URL is set, otherwise the same primary pool.
 * Keep pools small: Cloud Run scales by instances, Cloud SQL connections are the bottleneck
 * (add PgBouncer / Cloud SQL Managed Connection Pooling before large scale-out).
 */
export class Database {
  readonly write: Db;
  readonly read: Db;
  private readonly pools: Pool[] = [];

  constructor(cfg: AppConfig) {
    const primary = new Pool({ connectionString: cfg.DATABASE_URL, max: cfg.DB_POOL_MAX });
    this.pools.push(primary);
    this.write = drizzle(primary, { schema });
    if (cfg.DATABASE_READ_URL) {
      const replica = new Pool({ connectionString: cfg.DATABASE_READ_URL, max: cfg.DB_POOL_MAX });
      this.pools.push(replica);
      this.read = drizzle(replica, { schema });
    } else {
      this.read = this.write;
    }
  }

  get primaryPool(): Pool {
    return this.pools[0];
  }

  async close(): Promise<void> {
    await Promise.all(this.pools.map((p) => p.end()));
  }
}
