import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Stylizer } from './stylize';

/**
 * キメ絵 (client decision 2026-10-08): only the few cuts the direction sheet marks as key are
 * redrawn as an anime illustration by an image-to-image service — a few yen per MV, not every frame.
 * The first one that is set up is used:
 *  1. Novita AI (NOVITA_API_KEY + NOVITA_MODEL, client decision 2026-10-08): anime checkpoints,
 *     img2img, async (submit → poll). PLACEHOLDER (P-MV-2): the checkpoint's licence must allow a paid service.
 *  2. Runware (RUNWARE_API_KEY + RUNWARE_MODEL): the same idea, another cheap img2img API.
 *  3. Gemini image (MV_KEYART_MODEL) — only when neither of those is set up (dearer, and not an anime model).
 *  4. the ONNX model (ANIME_ONNX_URL), if one is set.
 * If none works the cut keeps the photo with the cel effect.
 */
const PROMPT = 'anime style illustration, hand-drawn cel animation, clean line art, vibrant colors, soft light, same composition and same people';
const NEGATIVE = 'photo, realistic, 3d, lowres, blurry, text, watermark, signature, nsfw, nude, deformed face, bad hands, extra fingers';
const SIDE = 1024;
const log = new Logger('MvKeyArt');

export class KeyArtist {
  constructor(
    private readonly o: {
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
    return !!(this.o.novitaKey && this.o.novitaModel);
  }
  private get runwareOn() {
    return !!(this.o.runwareKey && this.o.runwareModel);
  }

  /** One picture → the same picture as an anime illustration (PNG), or null. */
  async draw(input: Buffer): Promise<Buffer | null> {
    const src = await sharp(input).rotate().resize(SIDE, SIDE, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
    if (this.novita) {
      const out = await this.novitaDraw(src).catch((e) => log.warn(`novita: ${String(e).slice(0, 200)}`));
      if (out) return out;
    }
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

  /** Novita AI img2img (v3 async): submit, then poll the task until the picture is there. */
  private async novitaDraw(src: Buffer): Promise<Buffer | null> {
    const side = this.o.novitaSide;
    const img = await sharp(src).resize(side, side, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
    const headers = { 'content-type': 'application/json', authorization: `Bearer ${this.o.novitaKey}` };
    const res = await fetch('https://api.novita.ai/v3/async/img2img', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        extra: { response_image_type: 'png', enable_nsfw_detection: true },
        request: {
          model_name: this.o.novitaModel,
          image_base64: img.toString('base64'),
          prompt: `masterpiece, best quality, ${PROMPT}`,
          negative_prompt: NEGATIVE,
          width: side,
          height: side,
          image_num: 1,
          steps: 24,
          guidance_scale: 7,
          sampler_name: 'DPM++ 2M Karras',
          strength: this.o.novitaStrength,
          seed: -1,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`submit ${res.status} ${(await res.text()).slice(0, 200)}`);
    const { task_id: taskId } = (await res.json()) as { task_id?: string };
    if (!taskId) throw new Error('no task_id');
    const until = Date.now() + 120_000;
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
