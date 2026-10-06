import { HttpStatus, Logger } from '@nestjs/common';
import { apiError } from '../common/errors';

/**
 * Fish Audio REST API (commercial use OK via the paid API, client decision 2026-10-07).
 * Shapes follow the official SDK (fishaudio/fish-audio-python):
 *  - POST /model (multipart: title, visibility, train_mode=fast, texts, voices) → voice model {_id}
 *  - POST /v1/tts (header `model`, body text / reference_id / format …) → audio bytes
 */
const BASE = 'https://api.fish.audio';
const log = new Logger('Fish');

async function fail(res: Response, what: string): Promise<never> {
  const body = (await res.text().catch(() => '')).slice(0, 200);
  log.warn(`${what} ${res.status}: ${body}`);
  if (res.status === 401 || res.status === 403) throw apiError(HttpStatus.BAD_GATEWAY, 'VOICE_AUTH', 'The voice service rejected the API key');
  if (res.status === 402) throw apiError(HttpStatus.BAD_GATEWAY, 'VOICE_CREDIT', 'The voice service has no credit left');
  throw apiError(HttpStatus.BAD_GATEWAY, 'VOICE_FAILED', `${what} failed (${res.status}): ${body}`);
}

/** Make a private voice model from one recording and its transcript. */
export async function createVoiceModel(key: string, o: { title: string; audio: Buffer; filename: string; mime: string; text: string }): Promise<string> {
  const form = new FormData();
  form.append('title', o.title);
  form.append('visibility', 'private');
  form.append('type', 'tts');
  form.append('train_mode', 'fast');
  form.append('texts', o.text);
  form.append('voices', new Blob([new Uint8Array(o.audio)], { type: o.mime }), o.filename);
  const res = await fetch(`${BASE}/model`, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) await fail(res, 'create voice');
  const json = (await res.json()) as { _id?: string; id?: string };
  const id = json._id ?? json.id;
  if (!id) throw apiError(HttpStatus.BAD_GATEWAY, 'VOICE_FAILED', 'The voice service returned no model id');
  return id;
}

export async function deleteVoiceModel(key: string, id: string): Promise<void> {
  const res = await fetch(`${BASE}/model/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (res && !res.ok && res.status !== 404) log.warn(`delete voice ${id}: ${res.status}`);
}

/** Read a text aloud in a voice model. Returns MP3 bytes. */
export async function textToSpeech(key: string, model: string, o: { text: string; referenceId: string }): Promise<Buffer> {
  const res = await fetch(`${BASE}/v1/tts`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', model },
    body: JSON.stringify({ text: o.text, reference_id: o.referenceId, format: 'mp3', mp3_bitrate: 128, latency: 'normal', normalize: true }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) await fail(res, 'tts');
  return Buffer.from(await res.arrayBuffer());
}
