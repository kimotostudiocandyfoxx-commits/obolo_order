/**
 * Client 2026-11-27 (the ダチ voice message trial): sample mixes for the ear — the production clean-up and mix
 * (src/voice/voice-mix.ts) run on a recording, nothing else called (no model, no storage).
 *   npx tsx apps/api/scripts/voice-mix-samples.ts <out dir> <recording> [more recordings …]
 * Per recording: the clean voice alone (1.2×), and one mix per mood (MOODS=a,b picks some) and the weakest うれしい.
 * Prints the time each took and the loudness of each file.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { VOICE_MOODS, type VoiceMood } from '@obolo/shared';
import { cleanVoice, mixVoice } from '../src/voice/voice-mix';

const lufsOf = (file: string) => /I:\s+(-?[\d.]+) LUFS/.exec(spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.split('Summary:')[1] ?? '')?.[1];

async function main() {
  const [out, ...files] = process.argv.slice(2);
  if (!out || !files.length) throw new Error('usage: voice-mix-samples.ts <out dir> <recording> …');
  await mkdir(out, { recursive: true });
  const only = process.env.MOODS?.split(',') as VoiceMood[] | undefined;
  for (const f of files) {
    const name = basename(f).replace(/\.[^.]+$/, '');
    const t0 = Date.now();
    const clean = await cleanVoice(await readFile(f));
    const cleanFile = resolve(out, `${name}-0-voice-only.mp3`);
    await writeFile(cleanFile, clean.mp3);
    console.log(`${name}: clean ${clean.seconds}s in ${Date.now() - t0}ms, ${lufsOf(cleanFile)} LUFS`);
    const picks: { sound: VoiceMood; soft?: boolean }[] = [...(only ?? VOICE_MOODS).map((sound) => ({ sound })), { sound: 'ureshii', soft: true }];
    for (const [k, p] of picks.entries()) {
      const t = Date.now();
      const mix = await mixVoice(clean.mp3, p);
      const file = resolve(out, `${name}-${k + 1}-${p.sound}${p.soft ? '-soft' : ''}.mp3`);
      await writeFile(file, mix.mp3);
      console.log(`  ${p.sound}${p.soft ? ' (soft)' : ''}: ${mix.seconds}s in ${Date.now() - t}ms, ${lufsOf(file)} LUFS`);
    }
  }
}
void main();
