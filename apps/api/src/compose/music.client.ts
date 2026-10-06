import { HttpStatus, Logger } from '@nestjs/common';
import type { InstrumentalBody } from '@obolo/shared';
import { apiError } from '../common/errors';

const log = new Logger('Music');

/**
 * The GPU music service is private (Cloud Run IAM): on Cloud Run the API asks the metadata server
 * for an ID token for it. Locally (no metadata server) the call goes without one.
 */
async function idToken(audience: string): Promise<string | undefined> {
  if (!process.env.K_SERVICE) return undefined;
  const res = await fetch(`http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`, {
    headers: { 'Metadata-Flavor': 'Google' },
  });
  if (!res.ok) throw new Error(`metadata identity ${res.status}`);
  return res.text();
}

/** Ask the GPU service for an instrumental. Returns AAC (audio/mp4) bytes. */
export async function generateInstrumental(baseUrl: string, body: InstrumentalBody): Promise<{ data: Buffer; seconds: number }> {
  const url = baseUrl.replace(/\/$/, '');
  const token = await idToken(url);
  let res: Response;
  try {
    res = await fetch(`${url}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        prompt: body.prompt,
        // the GPU service clamps to what its engine can make (ACE-Step 120 s, MusicGen 30 s)
        seconds: Math.max(4, Math.min(120, body.seconds)),
        bpm: body.bpm,
        keyRoot: body.keyRoot,
        scale: body.scale,
        progression: body.progression,
        melody: body.melody,
      }),
      signal: AbortSignal.timeout(280_000),
    });
  } catch (e) {
    log.warn(`music service unreachable: ${String(e)}`);
    throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'MUSIC_WARMING', 'The music studio is starting up');
  }
  // a cold GPU instance answers 503 while the model loads (or Cloud Run is still starting one)
  if (res.status === 503 || res.status === 429) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'MUSIC_WARMING', 'The music studio is starting up');
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 200);
    log.warn(`music service ${res.status}: ${text}`);
    throw apiError(HttpStatus.BAD_GATEWAY, 'MUSIC_FAILED', `The instrumental could not be made (${res.status}): ${text}`);
  }
  return { data: Buffer.from(await res.arrayBuffer()), seconds: Number(res.headers.get('x-seconds')) || body.seconds };
}
