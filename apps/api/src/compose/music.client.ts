import { HttpStatus, Logger } from '@nestjs/common';
import type { FullSongBody, InstrumentalBody } from '@obolo/shared';
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

/** The GPU service's /health (phase, download progress, error) — shown while the studio warms up. */
export async function musicStatus(baseUrl: string): Promise<Record<string, unknown>> {
  const url = baseUrl.replace(/\/$/, '');
  try {
    const token = await idToken(url);
    const res = await fetch(`${url}/health`, { headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) return { reachable: false, status: res.status, error: (await res.text().catch(() => '')).slice(0, 200) };
    return { reachable: true, ...((await res.json()) as Record<string, unknown>) };
  } catch (e) {
    return { reachable: false, error: String(e).slice(0, 200) };
  }
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

export type MadeSong = {
  seconds: number;
  /** when each lyric line is sung (may be empty if the alignment failed) */
  lines: { text: string; start: number; end: number }[];
  mix: Buffer;
  /** the vocal as delivered (in the member's voice when `voiced`) */
  vocals: Buffer;
  /** the studio's own vocal (kept so a voice can be swapped without singing again) */
  guide: Buffer;
  instrumental: Buffer;
  voiced: boolean;
  voiceNote: string;
};

/** Ask the GPU service for the whole song with vocals (ACE-Step) split by HTDemucs. AAC bytes. */
export async function generateSong(baseUrl: string, body: FullSongBody & { prompt: string; voice?: Buffer | null; similarity?: number }): Promise<MadeSong> {
  const url = baseUrl.replace(/\/$/, '');
  const token = await idToken(url);
  let res: Response;
  try {
    res = await fetch(`${url}/song`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        prompt: body.prompt,
        lyrics: body.sections.flatMap((s) => s.lines.map((l) => ({ section: s.name, text: l.text }))),
        seconds: Math.max(10, Math.min(180, body.seconds)),
        bpm: body.bpm,
        keyRoot: body.keyRoot,
        scale: body.scale,
        language: 'ja',
        // the member's recording: Seed-VC sings the song in their voice (zero-shot)
        ...(body.voice ? { voice: body.voice.toString('base64'), similarity: body.similarity ?? 0.7 } : {}),
      }),
      signal: AbortSignal.timeout(600_000),
    });
  } catch (e) {
    log.warn(`music service unreachable: ${String(e)}`);
    throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'MUSIC_WARMING', 'The music studio is starting up');
  }
  if (res.status === 503 || res.status === 429) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'MUSIC_WARMING', 'The music studio is starting up');
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 200);
    log.warn(`music service ${res.status}: ${text}`);
    throw apiError(HttpStatus.BAD_GATEWAY, 'MUSIC_FAILED', `The song could not be made (${res.status}): ${text}`);
  }
  const j = (await res.json()) as {
    seconds: number;
    lines?: MadeSong['lines'];
    mix: string;
    vocals: string;
    guide?: string;
    instrumental: string;
    voiced?: boolean;
    voiceNote?: string;
    timings?: unknown;
  };
  log.log(`song made ${j.seconds}s, ${j.lines?.length ?? 0} line times, voice: ${j.voiced ? 'member' : 'studio'} (${j.voiceNote ?? ''}) ${JSON.stringify(j.timings ?? {})}`);
  return {
    seconds: Number(j.seconds) || body.seconds,
    lines: Array.isArray(j.lines) ? j.lines : [],
    mix: Buffer.from(j.mix, 'base64'),
    vocals: Buffer.from(j.vocals, 'base64'),
    guide: Buffer.from(j.guide ?? j.vocals, 'base64'),
    voiced: !!j.voiced,
    voiceNote: String(j.voiceNote ?? ''),
    instrumental: Buffer.from(j.instrumental, 'base64'),
  };
}
