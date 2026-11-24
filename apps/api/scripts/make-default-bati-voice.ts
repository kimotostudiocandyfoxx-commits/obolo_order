/**
 * iPad feedback (2026-11-24): {bati}'s default voice — the voice every {bati} speaks in until the member's own (from the
 * egg recording, D03-S005) is made, then it switches by itself (BatiVoiceService.voiceRef).
 *
 * One-off: the client's reference recording (design/voices/default-bati-source.<ext>, any format ffmpeg reads) is
 * converted exactly as the egg recording is — toMp3(…, BATI_VOICE_BASE_SEMITONES = +2, BATI_VOICE_MAX_SECONDS) — and
 * made into a private Fish Audio voice model (the same POST /model as the members' voices; paid, approved). The model
 * id is printed; set it as the GitHub variable FISH_DEFAULT_VOICE_ID and run "Deploy API".
 *
 * Run: .github/workflows/make-default-bati-voice.yml (Actions → Default Bati voice → Run workflow), or locally
 *   FISH_API_KEY=… npx tsx apps/api/scripts/make-default-bati-voice.ts [source] [--dry]
 * env: FISH_API_KEY (not needed with --dry), SOURCE (else the first design/voices/default-bati-source.*),
 *      TRANSCRIPT (optional: what is said in the recording — helps the cloning), MAX_SECONDS (default 40, as the egg),
 *      OUT (the pitched MP3 is written here too, to listen to; default design/voices/default-bati-pitched.mp3)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { BATI_VOICE_BASE_SEMITONES, BATI_VOICE_MAX_SECONDS } from '@obolo/shared';
import { toMp3 } from '../src/voice/audio';
import { createVoiceModel } from '../src/voice/fish.client';

const ROOT = resolve(__dirname, '../../..');
const DIR = join(ROOT, 'design/voices');

function source(): string {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const given = arg || process.env.SOURCE;
  if (given) return resolve(ROOT, given);
  const found = (existsSync(DIR) ? readdirSync(DIR) : []).find((f) => /^default-bati-source\.[a-z0-9]+$/i.test(f));
  if (!found) throw new Error(`no recording: put the client's file at design/voices/default-bati-source.<ext>`);
  return join(DIR, found);
}

async function main() {
  const dry = process.argv.includes('--dry');
  const src = source();
  const maxSec = Number(process.env.MAX_SECONDS) || BATI_VOICE_MAX_SECONDS;
  const raw = readFileSync(src);
  // the same conversion as the egg recording's model (BatiVoiceService.make): +2 semitones, speed kept, mono 44.1 kHz MP3
  const audio = await toMp3(raw, BATI_VOICE_BASE_SEMITONES, maxSec);
  const out = resolve(ROOT, process.env.OUT || 'design/voices/default-bati-pitched.mp3');
  writeFileSync(out, audio);
  console.log(`${basename(src)} → +${BATI_VOICE_BASE_SEMITONES} semitones, ≤${maxSec}s: ${audio.length} bytes (${out})`);
  if (dry) return console.log('--dry: no voice model made');
  const key = process.env.FISH_API_KEY;
  if (!key) throw new Error('FISH_API_KEY is not set');
  const id = await createVoiceModel(key, { title: 'obolo-default-bati', audio, filename: 'default-bati.mp3', mime: 'audio/mpeg', text: process.env.TRANSCRIPT?.trim() || undefined });
  console.log(`FISH_DEFAULT_VOICE_ID=${id}`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [`### Default Bati voice model`, '', `\`FISH_DEFAULT_VOICE_ID=${id}\``, '', 'Settings → Secrets and variables → Actions → Variables: set FISH_DEFAULT_VOICE_ID to this id, then run "Deploy API".', ''].join('\n'),
    );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
