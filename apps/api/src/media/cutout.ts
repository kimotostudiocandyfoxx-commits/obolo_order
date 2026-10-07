import sharp from 'sharp';

/**
 * Cut a character out of a plain white background (Saturn picture characters): flood-fill the
 * near-white pixels connected to the image border (so white INSIDE the character — rice, shine —
 * stays), soften the edge, then crop to a square around the character with a little margin and
 * return a 512 px transparent PNG.
 */
export async function cutoutWhite(input: Buffer, out = 512): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().resize(720, 720, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const px = new Uint8Array(data.buffer, data.byteOffset, data.length);
  // how far from white each pixel is (0 = pure white)
  const dist = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) dist[i] = 255 - Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
  const BG = 28; // still background
  const EDGE = 90; // fades in up to here at the border of the character
  const bg = new Uint8Array(W * H);
  const stack: number[] = [];
  const seed = (i: number) => {
    if (!bg[i] && dist[i] <= BG) {
      bg[i] = 1;
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
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % W;
    const y = (i / W) | 0;
    if (x > 0) seed(i - 1);
    if (x < W - 1) seed(i + 1);
    if (y > 0) seed(i - W);
    if (y < H - 1) seed(i + W);
  }
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (bg[i]) {
        px[i * 4 + 3] = 0;
        continue;
      }
      // soft edge: a pixel touching the background fades by how white it is
      const touches = (x > 0 && bg[i - 1]) || (x < W - 1 && bg[i + 1]) || (y > 0 && bg[i - W]) || (y < H - 1 && bg[i + W]);
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
