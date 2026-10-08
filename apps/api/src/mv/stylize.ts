import { createWriteStream } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type * as Ort from 'onnxruntime-node';
import sharp from 'sharp';

/**
 * An anime model run in the API (ONNX Runtime, client request 2026-10-08), the last choice for the
 * キメ絵 (keyart.ts): an image-to-image model (AnimeGAN-style: NHWC or NCHW float in [-1, 1]) loaded
 * from ANIME_ONNX_URL (downloaded once per instance). PLACEHOLDER (P-MV-2): choose a model whose
 * licence allows a paid service — the well-known AnimeGAN models are non-commercial only.
 */

const SIZE = 512;

export class Stylizer {
  private session: Promise<Ort.InferenceSession> | null = null;
  constructor(private readonly modelUrl: string | undefined) {}

  get usesModel() {
    return !!this.modelUrl;
  }

  private load() {
    this.session ??= (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ort = require('onnxruntime-node') as typeof Ort;
      const dir = join(tmpdir(), 'obolo-models');
      await mkdir(dir, { recursive: true });
      const url = this.modelUrl!;
      const file = url.startsWith('/') ? url : join(dir, `anime-${Buffer.from(url).toString('base64url').slice(-24)}.onnx`);
      const have = await access(file).then(
        () => true,
        () => false,
      );
      if (!have) {
        const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
        if (!res.ok || !res.body) throw new Error(`model download ${res.status}`);
        await pipeline(Readable.fromWeb(res.body as never), createWriteStream(file));
      }
      return ort.InferenceSession.create(file, { intraOpNumThreads: 2 });
    })().catch((e) => {
      this.session = null;
      throw e;
    });
    return this.session;
  }

  /** One image → the same image in anime style (PNG), at most SIZE on the long side. */
  async image(input: Buffer): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ort = require('onnxruntime-node') as typeof Ort;
    const s = await this.load();
    const meta = await sharp(input).rotate().metadata();
    const k = SIZE / Math.max(meta.width ?? SIZE, meta.height ?? SIZE);
    // the model wants sides that are multiples of 8
    const w = Math.max(64, Math.round(((meta.width ?? SIZE) * Math.min(1, k)) / 8) * 8);
    const h = Math.max(64, Math.round(((meta.height ?? SIZE) * Math.min(1, k)) / 8) * 8);
    const rgb = await sharp(input).rotate().resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer();
    const name = s.inputNames[0];
    const shape = (s.inputMetadata as unknown as { shape?: (number | string)[] }[] | undefined)?.[0]?.shape;
    const nchw = shape?.[1] === 3;
    const data = new Float32Array(w * h * 3);
    for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) data[nchw ? c * w * h + i : i * 3 + c] = rgb[i * 3 + c] / 127.5 - 1;
    const out = await s.run({ [name]: new ort.Tensor('float32', data, nchw ? [1, 3, h, w] : [1, h, w, 3]) });
    const y = out[s.outputNames[0]].data as Float32Array;
    const px = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) px[i * 3 + c] = Math.max(0, Math.min(255, Math.round((y[nchw ? c * w * h + i : i * 3 + c] + 1) * 127.5)));
    return sharp(px, { raw: { width: w, height: h, channels: 3 } })
      .png()
      .toBuffer();
  }
}
