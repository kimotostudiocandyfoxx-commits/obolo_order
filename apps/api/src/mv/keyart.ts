import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Stylizer } from './stylize';

/**
 * キメ絵 (client decision 2026-10-08): only the few cuts the direction sheet marks as key are
 * redrawn as an anime illustration by an image-to-image service — a few yen per MV, not every frame.
 * The first one that is set up is used:
 *  1. (Novita's checkpoint img2img/txt2img routes were retired by Novita — 404 "route not found" since
 *     2026-10; scenes are painted by `paint` below instead.)
 *  2. Runware (RUNWARE_API_KEY + RUNWARE_MODEL): the same idea, another cheap img2img API.
 *  3. Gemini image (MV_KEYART_MODEL) — only when neither of those is set up (dearer, and not an anime model).
 *  4. the ONNX model (ANIME_ONNX_URL), if one is set.
 * If none works the cut keeps the photo with the cel effect.
 */
const PROMPT = 'anime style illustration, hand-drawn cel animation, clean line art, vibrant colors, soft light, same composition and same people';
const NEGATIVE = 'photo, realistic, 3d, lowres, blurry, text, watermark, signature, nsfw, nude, deformed face, bad hands, extra fingers';

/**
 * How to ask a checkpoint. Animagine XL 4.0 (client choice 2026-10-08; CreativeML Open RAIL++-M) is an
 * SDXL anime model that reads Danbooru-style tags with its quality tags, and likes Euler a at a low CFG
 * (its model card); anything else gets the generic SD settings.
 */
export function novitaRecipe(model: string, redraw = true) {
  const base = redraw ? PROMPT : 'anime style illustration, cel animation, clean line art, vibrant colors, cinematic lighting';
  if (/animagine/i.test(model))
    return {
      prompt: `anime coloring, anime screencap, ${base}, masterpiece, high score, great score, absurdres`,
      negative: `lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, low score, bad score, average score, signature, watermark, username, blurry, photo, realistic, 3d, nsfw, nude`,
      sampler: 'Euler a',
      cfg: 5,
      steps: 28,
    };
  return { prompt: `masterpiece, best quality, ${base}`, negative: NEGATIVE, sampler: 'DPM++ 2M Karras', cfg: 7, steps: 24 };
}
const SIDE = 1024;

/** One storyboard scene to paint: its tags, and whether the hero is in it. */
export type PaintScene = { tags: string; hero?: boolean };
/**
 * People to keep out of a picture (MV lab m03: human silhouettes still walked into scenery shots):
 * none in a scenery shot, and none next to a hero who is not human.
 */
export function keepOut(s: PaintScene, heroIsHuman = true) {
  const people = '1girl, 1boy, multiple girls, multiple boys, human, person, silhouette, crowd';
  return !s.hero || !heroIsHuman ? people : 'multiple girls, multiple boys, crowd, 2girls, 2boys';
}

export type PaintOptions = {
  /** the hero is a person (1girl / 1boy…), not a creature or mascot */
  heroIsHuman?: boolean;
  reference?: Buffer | null; refScale?: number; steps?: number; warmMs?: number; pollMs?: number };
const log = new Logger('MvKeyArt');

export class KeyArtist {
  constructor(
    private readonly o: {
      /** our own GPU painter (gpu/music POST /paint, Animagine XL 4.0) — preferred when set */
      paintUrl?: string;
      paintToken?: () => Promise<string | undefined>;
      novitaKey?: string;
      novitaModel?: string;
      novitaStrength: number;
      novitaSide: number;
      runwareKey?: string;
      runwareModel?: string;
      geminiKey?: string;
      geminiModel: string;
      stylizer: Stylizer;
    },
  ) {}

  private get novita() {
    return !!this.o.novitaKey;
  }
  private get runwareOn() {
    return !!(this.o.runwareKey && this.o.runwareModel);
  }

  /** One picture → the same picture as an anime illustration (PNG), or null. */
  async draw(input: Buffer): Promise<Buffer | null> {
    const src = await sharp(input).rotate().resize(SIDE, SIDE, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
    if (this.runwareOn) {
      const out = await this.runware(src).catch((e) => log.warn(`runware: ${String(e).slice(0, 200)}`));
      if (out) return out;
    }
    if (this.o.geminiKey && !this.novita && !this.runwareOn) {
      const out = await this.gemini(src).catch((e) => log.warn(`gemini image: ${String(e).slice(0, 200)}`));
      if (out) return out;
    }
    if (this.o.stylizer.usesModel) return this.o.stylizer.image(src).catch(() => null);
    return null;
  }

  /** Can scenes be painted from words? */
  get canPaint() {
    return !!this.o.paintUrl || this.novita;
  }

  /**
   * How many scenes one MV may paint: our own GPU paints the whole storyboard (seconds of GPU time),
   * Novita Qwen-Image costs about 3 yen a picture, so fewer scenes (each shown longer) there.
   */
  sceneBudget(max: number, qwenMax: number) {
    return this.o.paintUrl ? max : Math.min(max, qwenMax);
  }

  /**
   * The storyboard's scenes painted from words, in order (null where a scene could not be painted).
   * `tags` are each scene's Danbooru-style tags (character, place, action, light). Our GPU paints the
   * whole list in one call with Animagine XL 4.0 (its quality tags added, the GPU serves one request
   * at a time); anything it did not paint goes to Novita Qwen-Image, a few at a time, as TV-anime stills.
   */
  async paintAll(scenes: PaintScene[], seed: number, parallel: number, opt: PaintOptions = {}): Promise<(Buffer | null)[]> {
    const tags = scenes.map((s) => s.tags);
    const out: (Buffer | null)[] = tags.map(() => null);
    if (this.o.paintUrl) {
      const got = await this.gpuPaint(scenes, seed, opt).catch((e) => {
        log.warn(`gpu paint: ${String(e).slice(0, 200)}`);
        return [] as (Buffer | null)[];
      });
      got.forEach((b, k) => (out[k] = b));
    }
    if (!this.novita) return out;
    const todo = out.map((b, k) => (b ? -1 : k)).filter((k) => k >= 0);
    const worker = async () => {
      for (let k = todo.shift(); k !== undefined; k = todo.shift()) out[k] = await this.qwenPaint(tags[k]);
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(parallel, todo.length)) }, worker));
    return out;
  }

  private async qwenPaint(tags: string): Promise<Buffer | null> {
    const side = this.o.novitaSide;
    return this.novitaTask('qwen-image-txt2img', {
      prompt: `Anime illustration, a still from a Japanese TV anime: cel shading, clean line art, vibrant colours, cinematic lighting. ${tags}. No text, no letters, no watermark, no frame.`.slice(0, 1900),
      size: `${side}*${side}`,
    }).catch((e) => {
      log.warn(`novita paint: ${String(e).slice(0, 200)}`);
      return null;
    });
  }

  private async gpuPaint(scenes: PaintScene[], seed: number, opt: PaintOptions): Promise<(Buffer | null)[]> {
    const recipe = novitaRecipe(this.o.novitaModel ?? 'animagine', false);
    const base = this.o.paintUrl!.replace(/\/$/, '');
    const auth = async (): Promise<Record<string, string>> => {
      const token = await this.o.paintToken?.();
      return token ? { authorization: `Bearer ${token}` } : {};
    };
    // the hero's own picture: the hero scenes are painted looking at it (IP-Adapter on our GPU)
    const reference = opt.reference ? (await sharp(opt.reference).rotate().flatten({ background: '#ffffff' }).resize(512, 512, { fit: 'contain', background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer()).toString('base64') : undefined;

    // 1. wake the painter and wait for it: a cold GPU (weights, then the painter) takes minutes, longer
    //    than an HTTP answer may take (Node's fetch gives up after 5 minutes without one) — 2026-10-09
    //    logs: "gpu paint: fetch failed" after a cold start, and Qwen painted the MV instead (~33 yen)
    const until = Date.now() + (opt.warmMs ?? 9 * 60_000);
    for (let first = true; ; first = false) {
      const res = await fetch(`${base}/paint/warm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await auth()) },
        body: JSON.stringify({ ip: !!reference }),
        signal: AbortSignal.timeout(120_000),
      }).catch(() => null);
      const st = res?.ok ? ((await res.json()) as { ready?: boolean; ip?: boolean; error?: string | null; ipError?: string }) : null;
      if (st?.error) throw new Error(`painter: ${st.error}`);
      if (st?.ready && (!reference || st.ip || st.ipError)) break;
      if (Date.now() > until) throw new Error('painter did not wake up in time');
      if (first) log.log('waking the GPU painter…');
      await new Promise((r) => setTimeout(r, opt.pollMs ?? 10_000));
    }

    // 2. the scenes, a few per call (each call well under the 5-minute limit)
    const out: (Buffer | null)[] = [];
    for (let i = 0; i < scenes.length; i += 8) {
      const part = scenes.slice(i, i + 8);
      const res = await fetch(`${base}/paint`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await auth()) },
        body: JSON.stringify({
          // kids-friendly app: Animagine's "safe" rating tag, and the other ratings in the negative
          items: part.map((s, k) => ({ prompt: `${s.tags}, safe, ${recipe.prompt}`.slice(0, 1900), seed: seed + i + k, hero: !!s.hero, negative: keepOut(s, opt.heroIsHuman) })),
          negative: `${recipe.negative}, sensitive, explicit, suggestive`,
          side: this.o.novitaSide,
          steps: opt.steps ?? recipe.steps,
          cfg: recipe.cfg,
          ...(reference ? { reference, refScale: opt.refScale ?? 0.6 } : {}),
        }),
        signal: AbortSignal.timeout(280_000),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
      const { images } = (await res.json()) as { images?: (string | null)[] };
      part.forEach((_, k) => out.push(images?.[k] ? Buffer.from(images[k]!, 'base64') : null));
    }
    return out;
  }

  /** Submit a Novita v3 async task, then poll it until the picture is there (null = refused by the NSFW check). */
  private async novitaTask(kind: 'qwen-image-txt2img', request: Record<string, unknown>): Promise<Buffer | null> {
    const headers = { 'content-type': 'application/json', authorization: `Bearer ${this.o.novitaKey}` };
    const res = await fetch(`https://api.novita.ai/v3/async/${kind}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`submit ${res.status} ${(await res.text()).slice(0, 200)}`);
    const { task_id: taskId } = (await res.json()) as { task_id?: string };
    if (!taskId) throw new Error('no task_id');
    const until = Date.now() + 150_000;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 1500));
      const r = await fetch(`https://api.novita.ai/v3/async/task-result?task_id=${encodeURIComponent(taskId)}`, { headers, signal: AbortSignal.timeout(20_000) });
      if (!r.ok) continue;
      const j = (await r.json()) as { task?: { status?: string; reason?: string }; images?: { image_url?: string; nsfw_detection_result?: { valid?: boolean; confidence?: number } }[] };
      const status = j.task?.status ?? '';
      if (status === 'TASK_STATUS_FAILED') throw new Error(`task failed: ${j.task?.reason ?? ''}`);
      if (status !== 'TASK_STATUS_SUCCEED') continue;
      const out = j.images?.[0];
      // kids-friendly app: a picture the NSFW check does not pass is never used
      if (!out?.image_url || (out.nsfw_detection_result && out.nsfw_detection_result.valid === false)) return null;
      const pic = await fetch(out.image_url, { signal: AbortSignal.timeout(60_000) });
      return pic.ok ? Buffer.from(await pic.arrayBuffer()) : null;
    }
    throw new Error('timed out');
  }

  private async runware(src: Buffer): Promise<Buffer | null> {
    const res = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.o.runwareKey}` },
      body: JSON.stringify([
        {
          taskType: 'imageInference',
          taskUUID: randomUUID(),
          model: this.o.runwareModel,
          positivePrompt: `masterpiece, best quality, ${PROMPT}`,
          negativePrompt: 'photo, realistic, text, watermark, lowres, nsfw',
          seedImage: `data:image/jpeg;base64,${src.toString('base64')}`,
          strength: 0.6,
          steps: 20,
          width: SIDE,
          height: SIDE,
          numberResults: 1,
          outputType: 'URL',
          outputFormat: 'PNG',
        },
      ]),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { data?: { imageURL?: string }[] };
    const url = json.data?.[0]?.imageURL;
    if (!url) return null;
    const img = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    return img.ok ? Buffer.from(await img.arrayBuffer()) : null;
  }

  private async gemini(src: Buffer): Promise<Buffer | null> {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.o.geminiModel}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.o.geminiKey! },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: src.toString('base64') } },
              { text: `Redraw this picture as an ${PROMPT}. Keep the layout, poses and faces recognisable. Square image, no text, no frame.` },
            ],
          },
        ],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] };
    const data = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
    return data ? Buffer.from(data, 'base64') : null;
  }
}
