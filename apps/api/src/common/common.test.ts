import { describe, expect, it } from 'vitest';
import { quotaDay } from '../buddy/buddy.service';
import { MemoryKv } from '../infra/kv';
import { parseOrigins } from '../main';
import { decodeCursor, encodeCursor } from './cursor';

describe('cursor', () => {
  it('round-trips and rejects garbage', () => {
    const c = { t: '2026-10-10T00:00:00.000Z', id: 'abc' };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor('nope')).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });
});

describe('CORS origins', () => {
  it('parses exact origins and /regex/ entries', () => {
    const [a, b] = parseOrigins('http://localhost:3000, /^https:\\/\\/obolo-.*\\.vercel\\.app$/');
    expect(a).toBe('http://localhost:3000');
    expect(b).toBeInstanceOf(RegExp);
    expect((b as RegExp).test('https://obolo-git-x.vercel.app')).toBe(true);
    expect((b as RegExp).test('https://evil.example.com')).toBe(false);
  });
});

describe('quota day (JST)', () => {
  it('rolls over at midnight Tokyo time', () => {
    expect(quotaDay(new Date('2026-10-09T14:59:59Z'))).toBe('2026-10-09');
    expect(quotaDay(new Date('2026-10-09T15:00:00Z'))).toBe('2026-10-10');
  });
});

describe('MemoryKv', () => {
  it('increments with TTL', async () => {
    const kv = new MemoryKv();
    expect(await kv.incr('k', 60)).toBe(1);
    expect(await kv.incr('k', 60)).toBe(2);
    await kv.del('k');
    expect(await kv.get('k')).toBeNull();
  });
});
