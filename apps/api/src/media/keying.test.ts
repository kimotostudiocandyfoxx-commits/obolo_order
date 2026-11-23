import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { chooseKey, cutoutChecked, cutoutKey, keyMatte, MIN_CLEARANCE, rekeyPrompt } from './keying';

// the same synthetic pictures as scripts/lib/test_keying.py
const svg = (body: string, bg = '#00ff00', w = 200, h = 240) => sharp(Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>`)).png().toBuffer();

async function raw(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { px: new Uint8Array(data.buffer, data.byteOffset, data.length), W: info.width, H: info.height };
}

describe('keyMatte (the shared chroma key)', () => {
  it('cuts an anti-aliased disc off green with no green left on its edge', async () => {
    const { px, W, H } = await raw(await svg('<circle cx="100" cy="120" r="60" fill="#c8283c"/>'));
    keyMatte(px, W, H, [0, 255, 0]);
    const a = (x: number, y: number) => px[(y * W + x) * 4 + 3];
    expect(a(100, 120)).toBe(255);
    expect(a(5, 5)).toBe(0);
    let edge = 0;
    let worst = -255;
    let sum = 0;
    for (let i = 0; i < W * H; i++) {
      const al = px[i * 4 + 3];
      sum += al / 255;
      if (al > 12 && al < 255) {
        edge++;
        worst = Math.max(worst, px[i * 4 + 1] - Math.max(px[i * 4], px[i * 4 + 2]));
      }
    }
    expect(edge).toBeGreaterThan(50);
    expect(worst).toBeLessThanOrEqual(12);
    // the coverage stays within about a pixel of the disc's area
    expect(Math.abs(sum - Math.PI * 60 * 60) / (Math.PI * 60 * 60)).toBeLessThan(0.05);
  });

  it('keeps a gap that is the key, fills a greenish button back in, drops specks and a floor shadow', async () => {
    const { px, W, H } = await raw(
      await svg(
        '<circle cx="100" cy="110" r="70" fill="#e6dcc8"/><circle cx="70" cy="110" r="16" fill="#00ff00"/><circle cx="135" cy="90" r="8" fill="#0af50f"/>' +
          '<rect x="10" y="10" width="2" height="2" fill="#fafafa"/><ellipse cx="100" cy="215" rx="60" ry="10" fill="#008c00"/>',
      ),
    );
    const info = keyMatte(px, W, H, [0, 255, 0]);
    const a = (x: number, y: number) => px[(y * W + x) * 4 + 3];
    expect(a(70, 110)).toBe(0);
    expect(a(135, 90)).toBe(255);
    expect(a(11, 11)).toBe(0);
    expect(a(100, 215)).toBe(0);
    expect(info.gapsKept).toBeGreaterThanOrEqual(1);
    expect(info.holesFilled).toBeGreaterThanOrEqual(1);
  });

  it('keeps grey shading on a grey key (textured, not flat)', async () => {
    // a striped grey figure on #808080: the stripes near the key's grey are part of it
    const stripes = Array.from({ length: 20 }, (_, k) => `<rect x="${50 + k * 5}" y="60" width="3" height="120" fill="#7a7a7a"/>`).join('');
    const { px, W, H } = await raw(await svg(`<rect x="50" y="60" width="100" height="120" fill="#909090"/>${stripes}`, '#808080'));
    keyMatte(px, W, H, [128, 128, 128]);
    let solid = 0;
    for (let y = 70; y < 170; y++) for (let x = 60; x < 140; x++) if (px[(y * W + x) * 4 + 3] > 200) solid++;
    expect(solid / (100 * 80)).toBeGreaterThan(0.95);
  });
});

describe('the key colour', () => {
  it('never keys a green character on green', async () => {
    const png = await sharp(Buffer.from('<svg width="200" height="200"><circle cx="100" cy="100" r="80" fill="#30c040"/></svg>')).png().toBuffer();
    expect(await chooseKey(png)).not.toBe('green');
    const pink = await sharp(Buffer.from('<svg width="200" height="200"><circle cx="100" cy="100" r="80" fill="#e030d0"/></svg>')).png().toBuffer();
    expect(await chooseKey(pink)).not.toBe('magenta');
  });

  it('paints the background again on another key when the character came out too near the first', async () => {
    const onGreen = await svg('<circle cx="100" cy="120" r="70" fill="#f0e0d0"/><circle cx="100" cy="120" r="30" fill="#20e030"/>');
    const asked: string[] = [];
    const r = await cutoutChecked(onGreen, 256, 'green', async (to, prompt) => {
      asked.push(to);
      expect(prompt).toBe(rekeyPrompt(to));
      return svg('<circle cx="100" cy="120" r="70" fill="#f0e0d0"/><circle cx="100" cy="120" r="30" fill="#20e030"/>', to === 'magenta' ? '#ff00ff' : '#0000ff');
    });
    expect(asked).toHaveLength(1);
    expect(asked[0]).not.toBe('green');
    expect(r?.key).toBe(asked[0]);
    expect(r!.clearance).toBeGreaterThan(MIN_CLEARANCE);
    const { px, W, H } = await raw(r!.png);
    expect(px[((H >> 1) * W + (W >> 1)) * 4 + 3]).toBe(255); // the green middle stays
  });

  it('a clean first cut asks for nothing more', async () => {
    let calls = 0;
    const r = await cutoutKey(await svg('<circle cx="100" cy="120" r="60" fill="#c8283c"/>'), 128, [0, 255, 0]);
    expect(r.info.clearance).toBeGreaterThan(MIN_CLEARANCE);
    await cutoutChecked(await svg('<circle cx="100" cy="120" r="60" fill="#c8283c"/>'), 128, 'green', async () => {
      calls++;
      return Buffer.alloc(0);
    });
    expect(calls).toBe(0);
  });
});
