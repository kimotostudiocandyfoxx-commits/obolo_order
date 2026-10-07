import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { probe, run } from '../media/transcode';

/**
 * Mercury 歌入れ — audio around the Fish vocal (ffmpeg, in the API image):
 *  - guideWav: the design's melody as a plain tone (optional audio prompt for Fish, P-VOICE-5)
 *  - mixSong: the vocal fitted to the song's length and mixed over the instrumental
 */

const GUIDE_SR = 22050;

/** The melody (one note per mora) as a soft tone, mono 16-bit WAV. */
export function guideWav(melody: { midi: number | null; beats: number }[], bpm: number, maxSeconds = 30): Buffer {
  const spb = 60 / bpm;
  const total = Math.min(maxSeconds, melody.reduce((a, n) => a + n.beats * spb, 0));
  const pcm = new Int16Array(Math.ceil(total * GUIDE_SR));
  let t0 = 0;
  for (const n of melody) {
    const len = n.beats * spb;
    if (t0 >= total) break;
    if (n.midi !== null) {
      const f = 440 * 2 ** ((n.midi - 69) / 12);
      const a = Math.floor(t0 * GUIDE_SR);
      const b = Math.min(pcm.length, Math.floor((t0 + len) * GUIDE_SR));
      for (let i = a; i < b; i++) {
        const t = (i - a) / GUIDE_SR;
        const env = Math.min(1, t / 0.02, (b - i) / GUIDE_SR / 0.04);
        const s = Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t) + 0.15 * Math.sin(6 * Math.PI * f * t);
        pcm[i] = Math.round(s * env * 0.45 * 32767 * 0.66);
      }
    }
    t0 += len;
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.byteLength, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(GUIDE_SR, 24);
  h.writeUInt32LE(GUIDE_SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.byteLength, 40);
  return Buffer.concat([h, Buffer.from(pcm.buffer)]);
}

/** How far the vocal may be stretched / squeezed to fit the song (beyond this it sounds wrong). */
const FIT = { min: 0.8, max: 1.25 };
/** PLACEHOLDER (P-VOICE-6): when the vocal comes in after the instrumental starts, in seconds. */
const VOCAL_DELAY_S = 0;

export async function mixSong(o: { instrumental: Buffer; vocal: Buffer; vocalSeconds: number }): Promise<{ data: Buffer; vocal: Buffer; seconds: number; fit: number }> {
  const dir = await mkdtemp(join(tmpdir(), 'sing-'));
  try {
    const inst = join(dir, 'inst.m4a');
    const raw = join(dir, 'vocal.mp3');
    const trimmed = join(dir, 'trimmed.wav');
    const fitted = join(dir, 'fitted.mp3');
    const out = join(dir, 'song.m4a');
    await writeFile(inst, o.instrumental);
    await writeFile(raw, o.vocal);
    // 1) cut the silence Fish leaves before the first word
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05', '-ac', '1', '-ar', '44100', trimmed]);
    // 2) fit its length to the lyrics' length in the design (atempo keeps the pitch)
    const dur = (await probe(trimmed)).seconds || o.vocalSeconds;
    const fit = Math.max(FIT.min, Math.min(FIT.max, dur / Math.max(1, o.vocalSeconds)));
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', trimmed, '-af', `atempo=${fit.toFixed(3)}`, '-b:a', '128k', fitted]);
    // 3) mix: a little compression and room on the voice, instrumental slightly under it
    const delay = Math.round(VOCAL_DELAY_S * 1000);
    await run(
      'ffmpeg',
      [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', inst, '-i', fitted,
        '-filter_complex',
        `[0:a]volume=0.72[i];[1:a]adelay=${delay}|${delay},highpass=f=90,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,aecho=0.8:0.6:60|120:0.16|0.08,volume=1.25[v];[i][v]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[o]`,
        '-map', '[o]', '-ar', '44100', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
        out,
      ],
      180_000,
    );
    return { data: await readFile(out), vocal: await readFile(fitted), seconds: Math.round((await probe(out)).seconds * 10) / 10, fit };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
