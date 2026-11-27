/**
 * M-R325 / M-R326: the production cut-out run on real sample paintings — the cut of before and the new cut side by side,
 * each with the automatic checks' verdict (nothing is painted, no provider is called: the shape check against the
 * background-removal model and the vision check are skipped here). The lab's planet figures by default:
 *   npx tsx apps/api/scripts/cutout-samples.ts <out dir> [--jpeg] [picture …]
 * Per picture one sheet: the painting | the cut of before on dark | the new cut on dark | the new cut on light, with a
 * line under each cut: PASS, or FAIL and the checks it failed. `--jpeg`: small JPEGs (the hand-off shots).
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';
import { checkCut, rawOf } from '../src/media/cut';
import { cutPicture, inspectCut, type CutBackground, type CutResult } from '../src/media/cutting';

const LAB = resolve(__dirname, '../../../art/lab/runware-planet-avatar');
const SIDE = 384;
const BAR = 34;
const KIND: Record<string, string> = { 'saturn-ball': 'saturnBall', 'saturn-chibi': 'saturnChibi', 'jupiter-butterfly': 'jupiter', 'mercury-ship': 'mercury', 'mars-ufo': 'mars', 'venus-dj': 'venus', 'uranus-balloons': 'uranus', 'pluto-book': 'pluto', 'neptune-bubble': 'neptune' };

/** the cut of before M-R325 on a white background (cutoutWhite: a flood within 28 of pure white from the border), as a cut to inspect */
async function oldWhite(input: Buffer): Promise<CutResult> {
  const { px, W, H } = await rawOf(input);
  const before = px.slice();
  const N = W * H;
  const seen = new Uint8Array(N);
  const stack: number[] = [];
  const near = (i: number) => Math.max(255 - px[i * 4], 255 - px[i * 4 + 1], 255 - px[i * 4 + 2]) <= 28;
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
  for (let y = 0; y < H; y++) {
    seed(y * W);
    seed(y * W + W - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    px[i * 4 + 3] = 0;
    const x = i % W;
    if (x > 0) seed(i - 1);
    if (x < W - 1) seed(i + 1);
    if (i >= W) seed(i - W);
    if (i < N - W) seed(i + W);
  }
  const bg: [number, number, number] = [255, 255, 255];
  const png = await sharp(Buffer.from(px.buffer, px.byteOffset, px.length), { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  return { png, report: checkCut(before, px, W, H, { bg, kind: 'plain' }), how: 'plain', work: { px, before, W, H, bg } };
}

const checker = (dark: boolean) => {
  const [a, b] = dark ? ['#1c1630', '#241d3c'] : ['#d3d7e0', '#ffffff'];
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIDE}" height="${SIDE}"><defs><pattern id="c" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="${a}"/><rect width="16" height="16" fill="${b}"/><rect x="16" y="16" width="16" height="16" fill="${b}"/></pattern></defs><rect width="${SIDE}" height="${SIDE}" fill="url(#c)"/></svg>`,
  );
};
const on = async (png: Buffer, dark: boolean) =>
  sharp(checker(dark))
    .composite([{ input: await sharp(png).resize(SIDE, SIDE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer() }])
    .png()
    .toBuffer();
const bar = (text: string, ok: boolean | null) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIDE}" height="${BAR}"><rect width="${SIDE}" height="${BAR}" fill="${ok === null ? '#30343f' : ok ? '#1f7a4d' : '#b3261e'}"/><text x="10" y="23" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" font-weight="700" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`,
  );
const verdict = async (c: CutResult, background: CutBackground, kind: string) => {
  const i = await inspectCut(c, { background, kind, soft: kind === 'neptune' });
  return { ok: !i.failed.length, text: i.failed.length ? `FAIL: ${i.failed.join(', ')}` : 'PASS', failed: i.failed };
};

async function main() {
  const args = process.argv.slice(2);
  const jpeg = args.includes('--jpeg');
  const [out, ...given] = args.filter((a) => a !== '--jpeg');
  if (!out) throw new Error('usage: cutout-samples.ts <out dir> [--jpeg] [picture …]');
  await mkdir(out, { recursive: true });
  const files = given.length ? given : (await readdir(LAB)).filter((f) => /qwen-image-2-1-turbo\.jpg$|^(saturn|jupiter)[^_]*__[^_]*__flux2-klein-4b\.jpg$/.test(f)).map((f) => resolve(LAB, f));
  for (const f of files) {
    const src = await readFile(f);
    // painted on a key colour (the lab's green) or on white: read from the picture itself
    const { data } = await sharp(src).resize(8, 8, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const green = data[1] - Math.max(data[0], data[2]) > 60;
    const background: CutBackground = green ? 'green' : 'plain';
    const name = basename(f).replace(/\.[a-z]+$/, '');
    const kind = KIND[name.split('__')[0]] ?? 'figure';
    try {
      const cut = await cutPicture(src, 768, background, { bigHoles: kind === 'neptune' });
      const now = await verdict(cut, background, kind);
      const old = green ? null : await oldWhite(src);
      const was = old ? await verdict(old, background, kind) : null;
      const cells: { img: Buffer; label: Buffer }[] = [
        { img: await sharp(src).resize(SIDE, SIDE, { fit: 'contain', background: '#ffffff' }).png().toBuffer(), label: bar(`painting (${kind})`, null) },
        ...(old && was ? [{ img: await on(old.png, true), label: bar(`before: ${was.text}`, was.ok) }] : []),
        { img: await on(cut.png, true), label: bar(`new: ${now.text}`, now.ok) },
        { img: await on(cut.png, false), label: bar('new, on light', null) },
      ];
      const sheet = sharp({ create: { width: SIDE * cells.length, height: SIDE + BAR, channels: 3, background: '#000000' } }).composite(cells.flatMap((c, i) => [{ input: c.img, left: i * SIDE, top: 0 }, { input: c.label, left: i * SIDE, top: SIDE }]));
      if (jpeg) await writeFile(resolve(out, `${name}.jpg`), await sheet.jpeg({ quality: 82 }).toBuffer());
      else await writeFile(resolve(out, `${name}.png`), await sheet.png().toBuffer());
      const r = cut.report;
      console.log(`${name}\t${background}\tkept ${(r.kept * 100).toFixed(1)}%\tleak ${(r.leak * 100).toFixed(1)}%\tholes removed ${r.holesRemoved}\tnew ${now.text}\tbefore ${was?.text ?? '-'}`);
    } catch (e) {
      console.log(`${name}\t${background}\tFAILED ${String(e)}`);
    }
  }
}
void main();
