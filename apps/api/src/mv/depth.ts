import { Logger } from '@nestjs/common';
import { createWriteStream } from 'node:fs';
import { access, mkdir, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type * as Ort from 'onnxruntime-node';
import sharp from 'sharp';

/**
 * How far away each part of a picture is (client idea 2026-10-11: the food and the background move
 * apart slowly → the still looks 3D, at no cost per MV). Depth Anything V2 Small (Apache-2.0) in
 * ONNX Runtime on the API's CPU, about a second a picture; the model is downloaded once per instance.
 * The result is a grey picture: white = near, black = far.
 */
const DEFAULT_URL = 'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx';
const SIZE = 518; // the model's own size (a multiple of its 14px patches)
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const log = new Logger('MvDepth');

export class DepthModel {
  private session: Promise<Ort.InferenceSession> | null = null;
  constructor(private readonly url: string = DEFAULT_URL) {}

  private load() {
    this.session ??= (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ort = require('onnxruntime-node') as typeof Ort;
      const dir = join(tmpdir(), 'obolo-models');
      await mkdir(dir, { recursive: true });
      const file = this.url.startsWith('/') ? this.url : join(dir, `depth-${Buffer.from(this.url).toString('base64url').slice(-24)}.onnx`);
      const have = await access(file).then(
        () => true,
        () => false,
      );
      if (!have) {
        const res = await fetch(this.url, { signal: AbortSignal.timeout(180_000) });
        if (!res.ok || !res.body) throw new Error(`depth model download ${res.status}`);
        const part = `${file}.part`;
        await pipeline(Readable.fromWeb(res.body as never), createWriteStream(part));
        await rename(part, file);
      }
      return ort.InferenceSession.create(file, { graphOptimizationLevel: 'all' });
    })();
    // a failed load is tried again next time
    this.session.catch(() => (this.session = null));
    return this.session;
  }

  /** The depth picture (grey PNG, `side`×`side`, white = near), or null when the model cannot run. */
  async depth(picture: Buffer, side = 720): Promise<Buffer | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ort = require('onnxruntime-node') as typeof Ort;
      const session = await this.load();
      const { data } = await sharp(picture).rotate().removeAlpha().resize(SIZE, SIZE, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
      const n = SIZE * SIZE;
      const input = new Float32Array(3 * n);
      for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) input[c * n + i] = (data[i * 3 + c] / 255 - MEAN[c]) / STD[c];
      const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
      const d = out[session.outputNames[0]].data as Float32Array;
      // relative depth → 0..255, the far 2% and near 2% clipped so one odd spot does not flatten the rest
      const sorted = Float32Array.from(d.subarray(0, n)).sort();
      const lo = sorted[Math.floor(n * 0.02)];
      const hi = sorted[Math.floor(n * 0.98)];
      const grey = Buffer.alloc(n);
      for (let i = 0; i < n; i++) grey[i] = Math.max(0, Math.min(255, Math.round(((d[i] - lo) / (hi - lo || 1)) * 255)));
      // a little blur: edges between near and far stretch softly instead of tearing
      return await sharp(grey, { raw: { width: SIZE, height: SIZE, channels: 1 } }).resize(side, side, { fit: 'fill' }).blur(4).png().toBuffer();
    } catch (e) {
      log.warn(`depth: ${String(e).slice(0, 200)}`);
      return null;
    }
  }
}

/** The grey value (0..255) of a depth picture at (x, y) in 0..1, averaged over a small patch. */
export async function depthAt(depth: Buffer, x: number, y: number): Promise<number> {
  const { data, info } = await sharp(depth).greyscale().resize(64, 64, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const cx = Math.round(Math.max(0, Math.min(1, x)) * (info.width - 1));
  const cy = Math.round(Math.max(0, Math.min(1, y)) * (info.height - 1));
  let sum = 0;
  let cnt = 0;
  for (let yy = Math.max(0, cy - 2); yy <= Math.min(info.height - 1, cy + 2); yy++)
    for (let xx = Math.max(0, cx - 2); xx <= Math.min(info.width - 1, cx + 2); xx++) {
      sum += data[yy * info.width * info.channels + xx * info.channels];
      cnt++;
    }
  return cnt ? sum / cnt : 128;
}
