import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyArtist } from './keyart';
import { Stylizer } from './stylize';

const png = () =>
  sharp({ create: { width: 64, height: 64, channels: 3, background: '#88aaff' } })
    .png()
    .toBuffer();
const artist = (o: Partial<ConstructorParameters<typeof KeyArtist>[0]> = {}) =>
  new KeyArtist({ novitaKey: 'k', novitaModel: 'anime.safetensors', novitaStrength: 0.5, novitaSide: 512, geminiKey: 'g', geminiModel: 'gemini-x', stylizer: new Stylizer(undefined), ...o });

describe('KeyArtist (Novita)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('submits img2img, polls until done and downloads the picture; Gemini is not used', async () => {
    const out = await png();
    const calls: string[] = [];
    let polls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(url);
        if (url.endsWith('/v3/async/img2img')) {
          const body = JSON.parse(String(init?.body));
          expect(body.request.model_name).toBe('anime.safetensors');
          expect(body.request.strength).toBe(0.5);
          expect(body.request.image_base64.length).toBeGreaterThan(100);
          expect((init?.headers as Record<string, string>).authorization).toBe('Bearer k');
          return Response.json({ task_id: 't1' });
        }
        if (url.includes('task-result')) {
          polls++;
          return Response.json(polls < 2 ? { task: { status: 'TASK_STATUS_PROCESSING' } } : { task: { status: 'TASK_STATUS_SUCCEED' }, images: [{ image_url: 'https://cdn.example/x.png' }] });
        }
        if (url === 'https://cdn.example/x.png') return new Response(out);
        throw new Error(`unexpected ${url}`);
      }),
    );
    const got = await artist().draw(await png());
    expect(got?.equals(out)).toBe(true);
    expect(calls.some((c) => c.includes('generativelanguage'))).toBe(false);
  }, 20_000);

  it('drops a picture the NSFW check does not pass', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/img2img')) return Response.json({ task_id: 't2' });
        if (url.includes('task-result'))
          return Response.json({ task: { status: 'TASK_STATUS_SUCCEED' }, images: [{ image_url: 'https://cdn.example/y.png', nsfw_detection_result: { valid: false } }] });
        throw new Error(`unexpected ${url}`);
      }),
    );
    expect(await artist().draw(await png())).toBeNull();
  }, 20_000);

  it('a failed task falls back to the cel effect (null), not to Gemini', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.endsWith('/img2img')) return Response.json({ task_id: 't3' });
        return Response.json({ task: { status: 'TASK_STATUS_FAILED', reason: 'x' } });
      }),
    );
    expect(await artist().draw(await png())).toBeNull();
    expect(calls.some((c) => c.includes('generativelanguage'))).toBe(false);
  }, 20_000);
});
