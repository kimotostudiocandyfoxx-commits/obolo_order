import { describe, expect, it, vi } from 'vitest';
import type { NameLines } from '@obolo/shared';
import { LineVoiceService } from './line-voice.service';

const NL: NameLines = {
  model: 'tts',
  tempo: 1.3,
  lines: {
    k1: { who: 'OBOLON', text: '{neo}、待ってた。', spec: { voice: 'Gacrux' }, brief: '' },
    k2: { who: 'バティ', text: '{bati}だよ', spec: { voice: 'Leda', pitch: 3 }, brief: '' },
  },
};

function setup(rows: { hash: string; url: string }[] = []) {
  const kvData = new Map<string, string>();
  const kv = {
    get: async (k: string) => kvData.get(k) ?? null,
    set: async (k: string, v: string) => void kvData.set(k, v),
    del: async (k: string) => void kvData.delete(k),
    incr: async (k: string) => {
      const n = Number(kvData.get(k) ?? 0) + 1;
      kvData.set(k, String(n));
      return n;
    },
    close: async () => {},
  };
  const queue = { register: vi.fn(), enqueue: vi.fn(async () => {}), getHandler: vi.fn(), close: vi.fn() };
  const db = { write: { select: () => ({ from: () => ({ where: async () => rows }) }) } };
  const cfg = { GEMINI_API_KEY: 'x', NAME_LINES_URL: 'http://lines' };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(NL))));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = new LineVoiceService(cfg as any, kv, queue as any, db as any, {} as any);
  return { svc, queue };
}

describe('story lines with the member names', () => {
  it('queues each missing line once, only when its names are known', async () => {
    const { svc, queue } = setup();
    const body = { names: { neo: 'ミルク' }, keys: ['k1', 'k2', 'nope'] };
    expect(await svc.get('u1', body, 'http://api')).toEqual({ voices: {}, pending: 1 });
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    const [name, job] = queue.enqueue.mock.calls[0] as unknown as [string, object];
    expect(name).toBe('voice.line');
    expect(job).toMatchObject({ who: 'OBOLON', text: 'ミルク、待ってた。', tempo: 1.3 });
    // asking again while it is being made does not queue it twice
    await svc.get('u1', body, 'http://api');
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
  });

  it('returns the lines already voiced', async () => {
    const first = setup();
    await first.svc.get('u1', { names: { neo: 'ミルク' }, keys: ['k1'] }, 'o');
    const hash = (first.queue.enqueue.mock.calls[0] as unknown as [string, { hash: string }])[1].hash;
    const { svc, queue } = setup([{ hash, url: 'https://cdn/a.mp3' }]);
    expect(await svc.get('u1', { names: { neo: 'ミルク' }, keys: ['k1'] }, 'o')).toEqual({ voices: { k1: 'https://cdn/a.mp3' }, pending: 0 });
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
