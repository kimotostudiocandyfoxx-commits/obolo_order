import { HttpStatus } from '@nestjs/common';
import type { KvStore } from '../infra/kv';
import { apiError } from './errors';

/** Fixed-window limiter in Redis — shared across all Cloud Run instances. */
export async function rateLimit(kv: KvStore, key: string, limit: number, windowSec: number): Promise<void> {
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const n = await kv.incr(`rl:${key}:${bucket}`, windowSec);
  if (n > limit) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many requests, slow down');
}
