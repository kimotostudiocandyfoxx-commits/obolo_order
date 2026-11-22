import { spawn } from 'node:child_process';

/**
 * Any browser recording (webm / mp4 / …) → 44.1 kHz mono MP3 with ffmpeg, trimmed to `maxSec`; `semitones`
 * shifts the pitch and keeps the speed (Saturn / the egg: your voice a little higher for {bati}).
 */
export function toMp3(input: Buffer, semitones = 0, maxSec = 30): Promise<Buffer> {
  const r = Math.pow(2, semitones / 12);
  const shift = semitones ? ['-af', `asetrate=${Math.round(44100 * r)},aresample=44100,atempo=${(1 / r).toFixed(5)}`] : [];
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-t', String(maxSec), '-ac', '1', '-ar', '44100', ...shift, '-b:a', '128k', '-f', 'mp3', 'pipe:1']);
    const out: Buffer[] = [];
    let err = '';
    p.stdout.on('data', (d: Buffer) => out.push(d));
    p.stderr.on('data', (d: Buffer) => (err += d.toString()));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 && out.length ? resolve(Buffer.concat(out)) : reject(new Error(err.slice(-300) || `ffmpeg ${code}`))));
    p.stdin.on('error', () => {});
    p.stdin.end(input);
  });
}
