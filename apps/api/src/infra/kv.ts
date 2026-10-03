import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Key-value store used for sessions, login codes, rate limits and quotas.
 * Redis (Upstash at first) in every deployed environment so the API stays stateless and
 * Cloud Run can scale horizontally. The in-memory variant exists only for local dev/tests.
 */
export interface KvStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Atomically increments and (on first increment) sets the TTL. Returns the new value. */
  incr(key: string, ttlSec: number): Promise<number>;
  close(): Promise<void>;
}

export class RedisKv implements KvStore {
  constructor(readonly client: Redis) {}
  get(key: string) {
    return this.client.get(key);
  }
  async set(key: string, value: string, ttlSec: number) {
    await this.client.set(key, value, 'EX', ttlSec);
  }
  async del(key: string) {
    await this.client.del(key);
  }
  async incr(key: string, ttlSec: number) {
    const [[, n]] = (await this.client.multi().incr(key).expire(key, ttlSec, 'NX').exec()) as [[null, number]];
    return n;
  }
  async close() {
    await this.client.quit();
  }
}

export class MemoryKv implements KvStore {
  private readonly m = new Map<string, { v: string; exp: number }>();
  private live(key: string) {
    const e = this.m.get(key);
    if (e && e.exp < Date.now()) {
      this.m.delete(key);
      return undefined;
    }
    return e;
  }
  async get(key: string) {
    return this.live(key)?.v ?? null;
  }
  async set(key: string, value: string, ttlSec: number) {
    this.m.set(key, { v: value, exp: Date.now() + ttlSec * 1000 });
  }
  async del(key: string) {
    this.m.delete(key);
  }
  async incr(key: string, ttlSec: number) {
    const e = this.live(key);
    const n = (e ? Number(e.v) : 0) + 1;
    this.m.set(key, { v: String(n), exp: e?.exp ?? Date.now() + ttlSec * 1000 });
    return n;
  }
  async close() {}
}

export function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: true, lazyConnect: false });
}

export function createKv(url: string | undefined): KvStore {
  if (!url) {
    new Logger('KV').warn('REDIS_URL not set — using in-memory KV (single instance, dev only)');
    return new MemoryKv();
  }
  return new RedisKv(createRedis(url));
}
