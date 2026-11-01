import sharp from 'sharp';

/**
 * Cut a character out of a plain white background (Saturn picture characters): flood-fill the
 * near-white pixels connected to the image border (so white INSIDE the character — rice, shine —
 * stays), soften the edge, then crop to a square around the character with a little margin and
 * return a 512 px transparent PNG. `bg`: another flat background colour (the Bati's mid-grey).
 * `noShadow`: the soft grey shadow the painter leaves under the feet goes too (the app draws its own; on a dark
 * stage it read as a white stain, story chat 2026-11-01) — the flood runs on into light, colourless pixels in the
 * lower part of the picture only, so white inside the character (mayonnaise, shine) stays.
 */
export async function cutoutWhite(input: Buffer, out = 512, bg: [number, number, number] = [255, 255, 255], noShadow = false): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().resize(720, 720, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const px = new Uint8Array(data.buffer, data.byteOffset, data.length);
  // how far from the background colour each pixel is (0 = the background itself)
  const dist = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) dist[i] = Math.max(Math.abs(px[i * 4] - bg[0]), Math.abs(px[i * 4 + 1] - bg[1]), Math.abs(px[i * 4 + 2] - bg[2]));
  const BG = 28; // still background
  const EDGE = 90; // fades in up to here at the border of the character
  const isBg = new Uint8Array(W * H);
  const stack: number[] = [];
  const seed = (i: number) => {
    if (!isBg[i] && dist[i] <= BG) {
      isBg[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < W; x++) {
    seed(x);
    seed((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    seed(y * W);
    seed(y * W + W - 1);
  }
  const flood = (take: (i: number) => void) => {
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W;
      const y = (i / W) | 0;
      if (x > 0) take(i - 1);
      if (x < W - 1) take(i + 1);
      if (y > 0) take(i - W);
      if (y < H - 1) take(i + W);
    }
  };
  flood(seed);
  if (noShadow) {
    // the shadow under the feet: light, nearly colourless and warm (never bluish: the sky-blue band stays), in the lowest 40%
    const shade = (i: number) => {
      if (isBg[i] || ((i / W) | 0) < H * 0.6) return;
      const r = px[i * 4];
      const g = px[i * 4 + 1];
      const b = px[i * 4 + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) <= 45 && Math.min(r, g, b) >= 140 && r >= b - 4) {
        isBg[i] = 1;
        stack.push(i);
      }
    };
    for (let i = 0; i < W * H; i++) if (isBg[i] && ((i / W) | 0) >= H * 0.6) stack.push(i);
    flood(shade);
  }
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (isBg[i]) {
        px[i * 4 + 3] = 0;
        continue;
      }
      // soft edge: a pixel touching the background fades by how white it is
      const touches = (x > 0 && isBg[i - 1]) || (x < W - 1 && isBg[i + 1]) || (y > 0 && isBg[i - W]) || (y < H - 1 && isBg[i + W]);
      if (touches && dist[i] < EDGE) px[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, (dist[i] - BG) / (EDGE - BG))) * 255);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX <= minX || maxY <= minY) throw new Error('nothing left after removing the background');
  // a square around the character, 3% margin
  const side = Math.round(Math.max(maxX - minX, maxY - minY) * 1.06);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const left = Math.round(cx - side / 2);
  const top = Math.round(cy - side / 2);
  const cut = await sharp(Buffer.from(px.buffer, px.byteOffset, px.length), { raw: { width: W, height: H, channels: 4 } })
    .extend({ top: Math.max(0, -top), bottom: Math.max(0, top + side - H), left: Math.max(0, -left), right: Math.max(0, left + side - W), background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp(cut)
    .extract({ left: Math.max(0, left), top: Math.max(0, top), width: side, height: side })
    .resize(out, out)
    .png({ compressionLevel: 9 })
    .toBuffer();
}
