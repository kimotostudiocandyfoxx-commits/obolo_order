import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Any browser recording (webm / mp4 / …) → 44.1 kHz mono MP3 with ffmpeg, trimmed to `maxSec`; `semitones`
 * shifts the pitch and keeps the speed (Saturn / the egg: your voice a little higher for {bati}).
 * iPad feedback: the input is read from a temporary file, not a pipe — an MP4 / M4A whose index (moov) is at the end
 * (iPhone / iPad recordings, the client's default {bati} voice) cannot be read from a pipe: ffmpeg then "succeeded"
 * with an empty MP3 of a few hundred bytes. A result that short is refused.
 */
export async function toMp3(input: Buffer, semitones = 0, maxSec = 30): Promise<Buffer> {
  const r = Math.pow(2, semitones / 12);
  const shift = semitones ? ['-af', `asetrate=${Math.round(44100 * r)},aresample=44100,atempo=${(1 / r).toFixed(5)}`] : [];
  const dir = await mkdtemp(join(tmpdir(), 'obolo-mp3-'));
  const src = join(dir, 'in');
  try {
    await writeFile(src, input);
    const mp3 = await new Promise<Buffer>((resolve, reject) => {
      const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', src, '-t', String(maxSec), '-vn', '-ac', '1', '-ar', '44100', ...shift, '-b:a', '128k', '-f', 'mp3', 'pipe:1']);
      const out: Buffer[] = [];
      let err = '';
      p.stdout.on('data', (d: Buffer) => out.push(d));
      p.stderr.on('data', (d: Buffer) => (err += d.toString()));
      p.on('error', reject);
      p.on('close', (code) => (code === 0 && out.length ? resolve(Buffer.concat(out)) : reject(new Error(err.slice(-300) || `ffmpeg ${code}`))));
    });
    // 128 kbit/s: a tenth of a second is about 1.6 kB; less is no sound at all
    if (mp3.length < 1000) throw new Error(`ffmpeg made no sound (${mp3.length} bytes)`);
    return mp3;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
