import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { cutoutWhite } from './cutout';

describe('cutoutWhite', () => {
  it('removes the white background but keeps white inside the character', async () => {
    // white canvas, a pink disc with a white highlight inside it
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#fff"/><circle cx="220" cy="200" r="120" fill="#f4a3c4"/><circle cx="180" cy="160" r="25" fill="#fff"/></svg>`;
    const png = await cutoutWhite(await sharp(Buffer.from(svg)).png().toBuffer(), 256);
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(256);
    const alpha = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
    expect(alpha(2, 2)).toBe(0); // corner: background gone
    expect(alpha(128, 128)).toBe(255); // centre: the character
    // the white highlight (inside the disc, upper left of centre) stays opaque
    expect(alpha(128 - 42, 128 - 42)).toBe(255);
  });
});
