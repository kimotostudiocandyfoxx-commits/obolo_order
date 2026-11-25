import { timed } from '@obolo/ai';
import { HttpStatus, Logger } from '@nestjs/common';
import { lyricsSheet, type FullSongBody, type InstrumentalBody } from '@obolo/shared';
import { apiError } from '../common/errors';

const log = new Logger('Music');

/**
 * The GPU music service is private (Cloud Run IAM): on Cloud Run the API asks the metadata server
 * for an ID token for it. Locally (no metadata server) the call goes without one.
 */
export async function idToken(audience: string): Promise<string | undefined> {
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
  // client 2026-11-25: our GPU's seconds are this making's cost (GPU_SECOND_JPY)
  return timed('gpu', 'music:instrumental', () => instrumentalOnGpu(baseUrl, body));
}

async function instrumentalOnGpu(baseUrl: string, body: InstrumentalBody): Promise<{ data: Buffer; seconds: number }> {
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
export async function generateSong(
  baseUrl: string,
  body: FullSongBody & { prompt: string; voice?: Buffer | null; similarity?: number },
  /** POST /extend: the finished song (`src`) kept up to `keep` seconds, the rest newly sung */
  extend?: { src: Buffer; keep: number },
): Promise<MadeSong> {
  // client 2026-11-25: our GPU's seconds are this making's cost (GPU_SECOND_JPY)
  return timed('gpu', extend ? 'music:extend' : 'music:song', () => songOnGpu(baseUrl, body, extend));
}

async function songOnGpu(baseUrl: string, body: FullSongBody & { prompt: string; voice?: Buffer | null; similarity?: number }, extend?: { src: Buffer; keep: number }): Promise<MadeSong> {
  const url = baseUrl.replace(/\/$/, '');
  const token = await idToken(url);
  let res: Response;
  try {
    res = await fetch(`${url}/${extend ? 'extend' : 'song'}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        prompt: body.prompt,
        lyrics: body.sections.flatMap((s) => s.lines.map((l) => ({ section: s.name, text: l.text }))),
        // R13: the lyrics with their metatags as ACE-Step reads them ([Pre-Chorus - building energy] …); the studio sings
        // this sheet (a studio not yet redeployed ignores it and sings `lyrics` with its own verse / chorus tags)
        ...(body.lyrics ? { sheet: lyricsSheet(body.lyrics) } : {}),
        seconds: Math.max(10, Math.min(180, body.seconds)),
        bpm: body.bpm,
        keyRoot: body.keyRoot,
        scale: body.scale,
        language: 'ja',
        // the member's recording: Seed-VC sings the song in their voice (zero-shot)
        ...(body.voice ? { voice: body.voice.toString('base64'), similarity: body.similarity ?? 0.7 } : {}),
        ...(extend ? { src: extend.src.toString('base64'), keep: Math.round(extend.keep * 100) / 100 } : {}),
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

/**
 * R18 (君の声にする魔法): POST /voice — a split song's studio vocal sung in the member's own voice (Seed-VC) and mixed with
 * its instrumental. Only the conversion runs on our GPU (the stems are the ones kept): its seconds are this spell's cost.
 */
export type VoiceBody = { vocals: Buffer; instrumental: Buffer; voice: Buffer; similarity?: number };
export type VoicedSong = { seconds: number; vocals: Buffer; mix: Buffer; voiceNote: string };
export function voiceSong(baseUrl: string, body: VoiceBody): Promise<VoicedSong> {
  return timed('gpu', 'music:voice', () => voiceOnGpu(baseUrl, body));
}
async function voiceOnGpu(baseUrl: string, body: VoiceBody): Promise<VoicedSong> {
  const url = baseUrl.replace(/\/$/, '');
  const token = await idToken(url);
  let res: Response;
  try {
    res = await fetch(`${url}/voice`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ vocals: body.vocals.toString('base64'), instrumental: body.instrumental.toString('base64'), voice: body.voice.toString('base64'), similarity: body.similarity ?? 0.7 }),
      signal: AbortSignal.timeout(600_000),
    });
  } catch (e) {
    log.warn(`music service unreachable: ${String(e)}`);
    throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'MUSIC_WARMING', 'The music studio is starting up');
  }
  if (res.status === 503 || res.status === 429) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'MUSIC_WARMING', 'The music studio is starting up');
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 200);
    log.warn(`music service voice ${res.status}: ${text}`);
    throw apiError(HttpStatus.BAD_GATEWAY, 'MUSIC_FAILED', `The song could not be sung in the voice (${res.status}): ${text}`);
  }
  const j = (await res.json()) as { seconds: number; vocals: string; mix: string; voiceNote?: string };
  return { seconds: Number(j.seconds) || 0, vocals: Buffer.from(j.vocals, 'base64'), mix: Buffer.from(j.mix, 'base64'), voiceNote: String(j.voiceNote ?? '') };
}

/**
 * R17: POST /split — a song made elsewhere (Runware) split on our GPU (HTDemucs), its lyric lines timed (Whisper on the
 * vocal, matched to the lyrics) and, with a recording, sung in the member's voice (Seed-VC). No song is generated: it
 * is called lazily, only when a change first needs the stems / the times or the member's voice. AAC stems back.
 */
export type SplitBody = { audio: Buffer; lyrics: { section: string; text: string }[]; sheet?: string; language?: string; voice?: Buffer | null; similarity?: number };
export function splitSong(baseUrl: string, body: SplitBody): Promise<MadeSong> {
  return timed('gpu', 'music:split', () => splitOnGpu(baseUrl, body));
}
async function splitOnGpu(baseUrl: string, body: SplitBody): Promise<MadeSong> {
  const url = baseUrl.replace(/\/$/, '');
  const token = await idToken(url);
  let res: Response;
  try {
    res = await fetch(`${url}/split`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        audio: body.audio.toString('base64'),
        lyrics: body.lyrics.slice(0, 48),
        ...(body.sheet ? { sheet: body.sheet } : {}),
        language: body.language ?? 'ja',
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
    log.warn(`music service split ${res.status}: ${text}`);
    throw apiError(HttpStatus.BAD_GATEWAY, 'MUSIC_FAILED', `The song could not be split (${res.status}): ${text}`);
  }
  const j = (await res.json()) as { seconds: number; lines?: MadeSong['lines']; mix: string; vocals: string; guide?: string; instrumental: string; voiced?: boolean; voiceNote?: string };
  log.log(`song split ${j.seconds}s, ${j.lines?.length ?? 0} line times, voice: ${j.voiced ? 'member' : 'studio'}`);
  return {
    seconds: Number(j.seconds) || 0,
    lines: Array.isArray(j.lines) ? j.lines : [],
    mix: Buffer.from(j.mix, 'base64'),
    vocals: Buffer.from(j.vocals, 'base64'),
    guide: Buffer.from(j.guide ?? j.vocals, 'base64'),
    instrumental: Buffer.from(j.instrumental, 'base64'),
    voiced: !!j.voiced,
    voiceNote: String(j.voiceNote ?? ''),
  };
}
