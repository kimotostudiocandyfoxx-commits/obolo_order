/**
 * M-R325: the production cut-out run on real sample paintings, the old cut and the new side by side on a checkerboard
 * (nothing is painted, no provider is called). The lab's planet figures (art/lab/runware-planet-avatar) by default:
 *   npx tsx apps/api/scripts/cutout-samples.ts <out dir> [picture …]
 * Per picture: <name>.png = the painting | the cut of before | the new cut, and a line with the check's report.
 */
import { readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';
import { cutPicture, type CutBackground } from '../src/media/cutting';

const LAB = resolve(__dirname, '../../../art/lab/runware-planet-avatar');
const SIDE = 384;

/** the cut of before M-R325 (cutoutWhite: a flood within 28 of pure white from the border), for the comparison */
async function oldWhite(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).removeAlpha().ensureAlpha().resize(720, 720, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const N = W * info.height;
  const seen = new Uint8Array(N);
  const stack: number[] = [];
  const near = (i: number) => Math.max(255 - data[i * 4], 255 - data[i * 4 + 1], 255 - data[i * 4 + 2]) <= 28;
  const seed = (i: number) => {
    if (!seen[i] && near(i)) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < W; x++) {
    seed(x);
    seed(N - W + x);
  }
  for (let y = 0; y < info.height; y++) {
    seed(y * W);
    seed(y * W + W - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    data[i * 4 + 3] = 0;
    const x = i % W;
    if (x > 0) seed(i - 1);
    if (x < W - 1) seed(i + 1);
    if (i >= W) seed(i - W);
    if (i < N - W) seed(i + W);
  }
  return sharp(data, { raw: { width: W, height: info.height, channels: 4 } }).png().toBuffer();
}

const checker = (dark: boolean) => {
  const [a, b] = dark ? ['#1c1630', '#2a2244'] : ['#cfd3dc', '#ffffff'];
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIDE}" height="${SIDE}"><defs><pattern id="c" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="${a}"/><rect width="16" height="16" fill="${b}"/><rect x="16" y="16" width="16" height="16" fill="${b}"/></pattern></defs><rect width="${SIDE}" height="${SIDE}" fill="url(#c)"/></svg>`,
  );
};
const on = async (png: Buffer, dark: boolean) =>
  sharp(checker(dark))
    .composite([{ input: await sharp(png).resize(SIDE, SIDE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer() }])
    .png()
    .toBuffer();

async function main() {
  const [out, ...given] = process.argv.slice(2);
  if (!out) throw new Error('usage: cutout-samples.ts <out dir> [picture …]');
  await mkdir(out, { recursive: true });
  const files = given.length ? given : (await readdir(LAB)).filter((f) => /qwen-image-2-1-turbo\.jpg$|^(saturn|jupiter)[^_]*__[^_]*__flux2-klein-4b\.jpg$/.test(f)).map((f) => resolve(LAB, f));
  for (const f of files) {
    const src = await readFile(f);
    // the key-coloured ones are named for their background in the lab (green); the others were painted on white
    const { data } = await sharp(src).resize(8, 8, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const green = data[1] - Math.max(data[0], data[2]) > 60;
    const background: CutBackground = green ? 'green' : 'plain';
    const name = basename(f).replace(/\.[a-z]+$/, '');
    try {
      const cut = await cutPicture(src, 768, background, { bigHoles: /neptune/.test(name) });
      const before = green ? null : await oldWhite(src);
      const cells = [await sharp(src).resize(SIDE, SIDE, { fit: 'contain', background: '#ffffff' }).png().toBuffer(), ...(before ? [await on(before, true)] : []), await on(cut.png, true), await on(cut.png, false)];
      const sheet = await sharp({ create: { width: SIDE * cells.length, height: SIDE, channels: 4, background: '#000000' } })
        .composite(cells.map((input, i) => ({ input, left: i * SIDE, top: 0 })))
        .png()
        .toBuffer();
      await writeFile(resolve(out, `${name}.png`), sheet);
      const r = cut.report;
      console.log(`${name}\t${background}\tkept ${(r.kept * 100).toFixed(1)}%\tleak ${(r.leak * 100).toFixed(1)}%\tholes removed ${r.holesRemoved} (${(r.holes * 100).toFixed(1)}%)\tleft ${r.holesLeft}\t${r.problems.join(',') || 'ok'}`);
    } catch (e) {
      console.log(`${name}\t${background}\tFAILED ${String(e)}`);
    }
  }
}
void main();
