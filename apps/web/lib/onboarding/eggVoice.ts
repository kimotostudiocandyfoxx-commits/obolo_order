import { BATI_VOICE_TARGET_SECONDS } from '@obolo/shared';

/**
 * 「たまごに声を聞かせる」 (D03-S005, M-R246): the ring around the mic and what a release means.
 * The ring is the length spoken so far (all the held takes, appended) over BATI_VOICE_TARGET_SECONDS.
 */
export const ringProgress = (seconds: number) => Math.max(0, Math.min(1, seconds / BATI_VOICE_TARGET_SECONDS));

/** after a take: full → the egg glows and the story goes on; else OBOLON 「、、、もう少し、聞かせてやれ。」 and more takes */
export const afterTake = (total: number): 'full' | 'short' => (total >= BATI_VOICE_TARGET_SECONDS - 0.05 ? 'full' : 'short');

/** the ring as an SVG circle's dash (circumference c) */
export const ringDash = (seconds: number, c: number) => `${(ringProgress(seconds) * c).toFixed(2)} ${c.toFixed(2)}`;

/** a recording → base64 (for POST /voice/bati) */
export async function blobBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
