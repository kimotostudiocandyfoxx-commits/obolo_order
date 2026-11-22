import { MockImageProvider, MockProvider, type ImageProvider } from '@obolo/ai';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../config';
import { MemoryKv } from '../infra/kv';
import { BuddyExtrasCaps, BuddyService } from './buddy.service';

const cfg = { BUDDY_SEARCH_DAILY: 2, BUDDY_SEARCH_GLOBAL_DAILY: 3, BUDDY_DRAW_DAILY: 1 } as AppConfig;

describe('M-R208 caps (Redis, per day)', () => {
  it('a member’s searches, everyone’s searches and a member’s pictures each turn off at their cap', async () => {
    const caps = new BuddyExtrasCaps(new MemoryKv(), cfg);
    expect(await caps.abilities('a')).toEqual({ search: true, draw: true });
    await caps.searched('a');
    await caps.searched('a');
    expect((await caps.abilities('a')).search).toBe(false);
    await caps.searched('b');
    // the third search of the day for everyone: nobody searches any more
    expect((await caps.abilities('c')).search).toBe(false);
    expect(await caps.takeDraw('a')).toBe(true);
    expect(await caps.takeDraw('a')).toBe(false);
    expect((await caps.abilities('a')).draw).toBe(false);
    expect((await caps.abilities('b')).draw).toBe(true);
  });
});

/** the service with stand-ins: only what drawing touches */
function service(images: ImageProvider, flagged = false) {
  const stored: { kind: string; mime: string }[] = [];
  const media = { storeImage: async (_u: string, kind: string, mime: string) => (stored.push({ kind, mime }), { id: 'm1', url: 'https://cdn/x.png', mime, sizeBytes: 1 }) };
  const mod = flagged ? { name: 'x', chat: async () => 'FLAG:violence' } : new MockProvider();
  const svc = new BuddyService(cfg, new MemoryKv(), new MockProvider(), { register: () => undefined } as never, {} as never, {} as never, mod as never, images, media as never);
  const draw = (svc as unknown as { draw: (u: string, asked: string, what: string, l: 'ja', o: string) => Promise<{ image?: { url: string }; text?: string }> }).draw.bind(svc);
  return { draw, stored };
}

describe('Bati draws in the chat (M-R208)', () => {
  it('paints it and keeps it as an image', async () => {
    const { draw, stored } = service(new MockImageProvider());
    expect(await draw('u', 'パンダの絵を見せて', 'a panda', 'ja', '')).toEqual({ image: { url: 'https://cdn/x.png', mediaId: 'm1' } });
    expect(stored).toEqual([{ kind: 'image', mime: 'image/svg+xml' }]);
    // the day's one picture is used
    expect((await draw('u', 'もう一枚', 'a cat', 'ja', '')).text).toContain('もう絵を描けない');
  });
  it('a flagged prompt is not painted', async () => {
    let painted = 0;
    const { draw } = service({ name: 'x', generate: async () => (painted++, { data: Buffer.from(''), mime: 'image/png' }) }, true);
    expect((await draw('u', 'x', 'something bad', 'ja', '')).text).toContain('描けない');
    expect(painted).toBe(0);
  });
  it('a failed picture gives Bati’s own line', async () => {
    const { draw } = service({ name: 'x', generate: async () => Promise.reject(new Error('down')) });
    expect((await draw('u', 'x', 'a dog', 'ja', '')).text).toContain('うまく描けなかった');
  });
});
