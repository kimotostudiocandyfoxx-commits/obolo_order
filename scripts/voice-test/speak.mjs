/**
 * Voice try-out (2026-11-24): make a private Fish Audio voice model from one recording, read the Saturn
 * korolin lines with it (the way the app reads a member's lines in their own registered voice), then delete
 * the model. Input and output stay encrypted: /tmp/voice/{voice.wav,voice.txt} in, /tmp/voice-out/*.mp3 out.
 *   FISH_API_KEY=... node scripts/voice-test/speak.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const KEY = process.env.FISH_API_KEY;
const MODEL = process.env.FISH_MODEL || 's2.1-pro';
const BASE = 'https://api.fish.audio';
if (!KEY) throw new Error('FISH_API_KEY missing');

const LINES = process.env.LINES_JSON ? JSON.parse(process.env.LINES_JSON) : [
  ['01', '明日も、がんばるぜ！'],
  ['02', 'うまいラーメン、見つけた！'],
  ['03', 'ねむい……でも、楽しい。'],
  ['04', '新曲、できたかも！'],
  ['05', '空が、きれいだった。'],
];
const PREFIX = process.env.OUT_PREFIX || 'line-';

const form = new FormData();
form.append('title', 'voice try-out (temporary)');
form.append('visibility', 'private');
form.append('type', 'tts');
form.append('train_mode', 'fast');
form.append('texts', readFileSync((process.env.VOICE_DIR||'/tmp/voice')+'/voice.txt', 'utf8'));
form.append('voices', new Blob([readFileSync((process.env.VOICE_DIR||'/tmp/voice')+'/voice.wav')], { type: 'audio/wav' }), 'voice.wav');
const made = await fetch(`${BASE}/model`, { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form });
if (!made.ok) throw new Error(`create voice ${made.status}: ${(await made.text()).slice(0, 200)}`);
const j = await made.json();
const id = j._id ?? j.id;
console.log('voice model ready');

mkdirSync((process.env.OUT_DIR||'/tmp/voice-out'), { recursive: true });
try {
  for (const [n, text] of LINES) {
    const res = await fetch(`${BASE}/v1/tts`, {
      method: 'POST',
      headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json', model: MODEL },
      body: JSON.stringify({ text, reference_id: id, format: 'mp3', mp3_bitrate: 128, latency: 'normal', normalize: true }),
    });
    if (!res.ok) { console.log(`line ${n} failed ${res.status}: ${(await res.text()).slice(0, 200)}`); continue; }
    writeFileSync(`${process.env.OUT_DIR||'/tmp/voice-out'}/${PREFIX}${n}.mp3`, Buffer.from(await res.arrayBuffer()));
    console.log(`line ${n} done`);
  }
} finally {
  // the voice model is only for this try-out
  await fetch(`${BASE}/model/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { authorization: `Bearer ${KEY}` } }).catch(() => null);
  console.log('voice model deleted');
}
