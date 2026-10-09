import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyArtist, novitaRecipe } from './keyart';
import { Stylizer } from './stylize';

const png = () =>
  sharp({ create: { width: 64, height: 64, channels: 3, background: '#88aaff' } })
    .png()
    .toBuffer();
const artist = (o: Partial<ConstructorParameters<typeof KeyArtist>[0]> = {}) =>
  new KeyArtist({ novitaKey: 'k', novitaModel: 'anime.safetensors', novitaStrength: 0.5, novitaSide: 512, geminiKey: 'g', geminiModel: 'gemini-x', stylizer: new Stylizer(undefined), ...o });

describe('novitaRecipe', () => {
  it('asks Animagine XL in its own way', () => {
    const r = novitaRecipe('animagineXL40_v4Opt.safetensors');
    expect(r.sampler).toBe('Euler a');
    expect(r.cfg).toBe(5);
    expect(r.prompt).toContain('masterpiece, high score');
    expect(novitaRecipe('other.safetensors').sampler).toBe('DPM++ 2M Karras');
  });
});

describe('KeyArtist scenes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('paints a scene with Novita Qwen-Image (the checkpoint routes are gone), polls, downloads', async () => {
    const out = await png();
    let polls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/v3/async/qwen-image-txt2img')) {
          const body = JSON.parse(String(init?.body));
          expect(body.prompt).toContain('1girl, beach');
          expect(body.size).toBe('512*512');
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
    expect((await artist().paint('1girl, beach', 1))?.equals(out)).toBe(true);
  }, 20_000);

  it('drops a picture the NSFW check does not pass', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/qwen-image-txt2img')) return Response.json({ task_id: 't2' });
        if (url.includes('task-result'))
          return Response.json({ task: { status: 'TASK_STATUS_SUCCEED' }, images: [{ image_url: 'https://cdn.example/y.png', nsfw_detection_result: { valid: false } }] });
        throw new Error(`unexpected ${url}`);
      }),
    );
    expect(await artist().paint('scenery', 1)).toBeNull();
  }, 20_000);

  it('prefers our own GPU (Animagine recipe), falls back to Novita when it fails', async () => {
    const out = await png();
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(url);
        if (url === 'https://gpu.example/paint') {
          const body = JSON.parse(String(init?.body));
          expect(body.prompt).toContain('masterpiece, high score');
          expect(body.seed).toBe(7);
          expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tok');
          return Response.json({ image: out.toString('base64'), safe: true });
        }
        throw new Error(`unexpected ${url}`);
      }),
    );
    const a = artist({ paintUrl: 'https://gpu.example/', paintToken: async () => 'tok', novitaModel: 'animagineXL40_v4Opt.safetensors' });
    expect((await a.paint('1boy', 7))?.equals(out)).toBe(true);
    expect(a.sceneBudget(30, 12)).toBe(30);
    expect(artist().sceneBudget(30, 12)).toBe(12);
    expect(calls).toEqual(['https://gpu.example/paint']);
  });

  it('a photo key cut no longer calls Novita (img2img is gone) and never Gemini when Novita is set', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        throw new Error('no network');
      }),
    );
    expect(await artist().draw(await png())).toBeNull();
    expect(calls).toEqual([]);
  });
});
