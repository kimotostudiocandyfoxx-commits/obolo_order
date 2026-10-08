import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Stylizer } from './stylize';

/**
 * キメ絵 (client decision 2026-10-08): only the few cuts the direction sheet marks as key are
 * redrawn as an anime illustration by an image-to-image service — a few yen per MV, not every frame.
 * The first one that is set up is used:
 *  1. Runware (RUNWARE_API_KEY + RUNWARE_MODEL): the cheap img2img API. PLACEHOLDER (P-MV-2): pick a
 *     model whose licence allows a paid service.
 *  2. Gemini image (MV_KEYART_MODEL, the cheap Flash image model; outputs may be used commercially).
 *  3. the ONNX model (ANIME_ONNX_URL), if one is set.
 * If none works the cut keeps the photo with the cel effect.
 */
const PROMPT = 'anime style illustration, hand-drawn cel animation, clean line art, vibrant colors, soft light, same composition and same people';
const SIDE = 1024;
const log = new Logger('MvKeyArt');

export class KeyArtist {
  constructor(private readonly o: { runwareKey?: string; runwareModel?: string; geminiKey?: string; geminiModel: string; stylizer: Stylizer }) {}

  /** One picture → the same picture as an anime illustration (PNG), or null. */
  async draw(input: Buffer): Promise<Buffer | null> {
    const src = await sharp(input).rotate().resize(SIDE, SIDE, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
    if (this.o.runwareKey && this.o.runwareModel) {
      const out = await this.runware(src).catch((e) => log.warn(`runware: ${String(e).slice(0, 200)}`));
      if (out) return out;
    }
    if (this.o.geminiKey) {
      const out = await this.gemini(src).catch((e) => log.warn(`gemini image: ${String(e).slice(0, 200)}`));
      if (out) return out;
    }
    if (this.o.stylizer.usesModel) return this.o.stylizer.image(src).catch(() => null);
    return null;
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
