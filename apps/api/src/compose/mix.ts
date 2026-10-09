import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { probe, run } from '../media/transcode';

/**
 * Mercury 歌入れ — audio around the Fish vocal (ffmpeg, in the API image):
 *  - guideWav: the design's melody as a plain tone (optional audio prompt for Fish, P-VOICE-5)
 *  - preparePhrase: one sung line with the silence around it cut
 *  - renderSong: all lines placed at their own start, mixed over the instrumental (re-run on
 *    every tempo / volume / timing edit — no AI call)
 */

const GUIDE_SR = 22050;

/** The melody (one note per mora) as a soft tone, mono 16-bit WAV. */
export function guideWav(melody: { midi: number | null; beats: number }[], bpm: number, maxSeconds = 30): Buffer {
  const spb = 60 / bpm;
  const total = Math.min(
    maxSeconds,
    melody.reduce((a, n) => a + n.beats * spb, 0),
  );
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

/** How far one line may be squeezed / stretched to fit its slot (beyond this it sounds wrong). */
const FIT = { min: 0.9, max: 1.25 };

/** One Fish line → trimmed (silence before / after cut) mono MP3, and its length. */
export async function preparePhrase(mp3: Buffer): Promise<{ data: Buffer; seconds: number }> {
  const dir = await mkdtemp(join(tmpdir(), 'phrase-'));
  try {
    const raw = join(dir, 'in.mp3');
    const out = join(dir, 'out.mp3');
    await writeFile(raw, mp3);
    const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03';
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw, '-af', `${trim},areverse,${trim},areverse`, '-ac', '1', '-ar', '44100', '-b:a', '128k', out]);
    return { data: await readFile(out), seconds: Math.round((await probe(out)).seconds * 100) / 100 };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export interface RenderPhrase {
  data: Buffer;
  seconds: number;
  startBeat: number;
  beats: number;
}

export interface RenderMix {
  tempo: number;
  vocalDb: number;
  bgmDb: number;
  delayBeats: number;
  gaps: number[];
}

/** Where each line starts (seconds) after the delay and the gaps before it. */
export function phraseStarts(phrases: Pick<RenderPhrase, 'startBeat'>[], bpm: number, mix: Pick<RenderMix, 'delayBeats' | 'gaps'>): number[] {
  const spb = 60 / bpm;
  let pushed = 0;
  return phrases.map((p, i) => {
    const t = (p.startBeat + mix.delayBeats) * spb + pushed;
    pushed += mix.gaps[i] ?? 0;
    return Math.round(t * 1000) / 1000;
  });
}

/**
 * Put the song together from its stored parts: every line placed at its own start in the design
 * (fitted to its slot), a little compression and room on the voice, the instrumental under it,
 * then the whole-song tempo (pitch kept) and loudness. No AI involved.
 */
export async function renderSong(o: { instrumental: Buffer; phrases: RenderPhrase[]; bpm: number; mix: RenderMix }): Promise<{ data: Buffer; seconds: number }> {
  const dir = await mkdtemp(join(tmpdir(), 'song-'));
  try {
    const inst = join(dir, 'inst.m4a');
    const out = join(dir, 'song.m4a');
    await writeFile(inst, o.instrumental);
    const spb = 60 / o.bpm;
    const starts = phraseStarts(o.phrases, o.bpm, o.mix);
    const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', inst];
    const chains: string[] = [];
    for (const [i, p] of o.phrases.entries()) {
      const f = join(dir, `p${i}.mp3`);
      await writeFile(f, p.data);
      args.push('-i', f);
      const slot = Math.max(0.5, p.beats * spb);
      const fit = Math.max(FIT.min, Math.min(FIT.max, p.seconds / slot));
      const ms = Math.round(starts[i] * 1000);
      chains.push(`[${i + 1}:a]atempo=${fit.toFixed(3)},adelay=${ms}|${ms}[p${i}]`);
    }
    const n = o.phrases.length;
    const vocalBus = n
      ? `${o.phrases.map((_, i) => `[p${i}]`).join('')}amix=inputs=${n}:duration=longest:normalize=0,highpass=f=90,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,aecho=0.8:0.6:60|120:0.16|0.08,volume=${(1.25 * 10 ** (o.mix.vocalDb / 20)).toFixed(3)}[v]`
      : 'anullsrc=r=44100:cl=mono,atrim=0:1[v]';
    const tempo = Math.abs(o.mix.tempo - 1) > 0.001 ? `,atempo=${o.mix.tempo.toFixed(3)}` : '';
    const graph = [
      ...chains,
      vocalBus,
      `[0:a]volume=${(0.72 * 10 ** (o.mix.bgmDb / 20)).toFixed(3)}[i]`,
      `[i][v]amix=inputs=2:duration=longest:normalize=0${tempo},loudnorm=I=-14:TP=-1.5:LRA=11[o]`,
    ].join(';');
    args.push('-filter_complex', graph, '-map', '[o]', '-ar', '44100', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out);
    await run('ffmpeg', args, 180_000);
    return { data: await readFile(out), seconds: Math.round((await probe(out)).seconds * 10) / 10 };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * A sung song from the music studio (ACE-Step + HTDemucs, 2026-10-09) re-mixed from its two stems:
 * the vocal and instrumental volumes, the vocal coming in later (delayBeats), the whole-song tempo.
 * (Per-line gaps do not apply: the vocal is one take.)
 */
export async function mixStems(o: { instrumental: Buffer; vocals: Buffer; bpm: number; mix: RenderMix }): Promise<{ data: Buffer; seconds: number }> {
  const dir = await mkdtemp(join(tmpdir(), 'stems-'));
  try {
    const inst = join(dir, 'inst.m4a');
    const voc = join(dir, 'voc.m4a');
    const out = join(dir, 'song.m4a');
    await writeFile(inst, o.instrumental);
    await writeFile(voc, o.vocals);
    const ms = Math.max(0, Math.round(o.mix.delayBeats * (60 / o.bpm) * 1000));
    const tempo = Math.abs(o.mix.tempo - 1) > 0.001 ? `,atempo=${o.mix.tempo.toFixed(3)}` : '';
    const graph = [
      `[0:a]volume=${(10 ** (o.mix.bgmDb / 20)).toFixed(3)}[i]`,
      `[1:a]${ms ? `adelay=${ms}:all=1,` : ''}volume=${(10 ** (o.mix.vocalDb / 20)).toFixed(3)}[v]`,
      `[i][v]amix=inputs=2:duration=longest:normalize=0${tempo},loudnorm=I=-14:TP=-1.5:LRA=11[o]`,
    ].join(';');
    await run(
      'ffmpeg',
      ['-y', '-hide_banner', '-loglevel', 'error', '-i', inst, '-i', voc, '-filter_complex', graph, '-map', '[o]', '-ar', '44100', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out],
      180_000,
    );
    return { data: await readFile(out), seconds: Math.round((await probe(out)).seconds * 10) / 10 };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
