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
    expect((await artist().paintAll([{ tags: '1girl, beach' }], 1, 2))[0]?.equals(out)).toBe(true);
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
    expect(await artist().paintAll([{ tags: 'scenery' }], 1, 2)).toEqual([null]);
  }, 20_000);

  it('prefers our own GPU (one call, Animagine recipe), and sends only what it missed to Novita', async () => {
    const out = await png();
    const calls: string[] = [];
    let polls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(url);
        if (url === 'https://gpu.example/paint') {
          const body = JSON.parse(String(init?.body));
          expect(body.items.map((i: { seed: number }) => i.seed)).toEqual([7, 8]);
          expect(body.items[0].prompt).toContain('1boy, safe, anime coloring');
          expect(body.negative).toContain('explicit');
          expect(body.items.map((i: { hero: boolean }) => i.hero)).toEqual([true, false]);
          expect(body.refScale).toBe(0.5);
          expect(body.reference.length).toBeGreaterThan(100);
          expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tok');
          return Response.json({ images: [out.toString('base64'), null] });
        }
        if (url.endsWith('/qwen-image-txt2img')) return Response.json({ task_id: 'q' });
        if (url.includes('task-result')) return Response.json(polls++ < 0 ? {} : { task: { status: 'TASK_STATUS_SUCCEED' }, images: [{ image_url: 'https://cdn.example/z.png' }] });
        if (url === 'https://cdn.example/z.png') return new Response(out);
        throw new Error(`unexpected ${url}`);
      }),
    );
    const a = artist({ paintUrl: 'https://gpu.example/', paintToken: async () => 'tok', novitaModel: 'animagineXL40_v4Opt.safetensors' });
    const got = await a.paintAll([{ tags: '1boy', hero: true }, { tags: 'scenery' }], 7, 4, { reference: out, refScale: 0.5 });
    expect(got.every((b) => b?.equals(out))).toBe(true);
    expect(calls.filter((c) => c.endsWith('/paint'))).toHaveLength(1);
    expect(calls.filter((c) => c.endsWith('/qwen-image-txt2img'))).toHaveLength(1);
    expect(a.sceneBudget(30, 12)).toBe(30);
    expect(artist().sceneBudget(30, 12)).toBe(12);
  }, 20_000);

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
