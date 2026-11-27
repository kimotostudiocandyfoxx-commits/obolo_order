import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { VOICE_MIX_TEMPO, VOICE_SOUND_PARTS, type VoiceMood, type VoiceSoundPick } from '@obolo/shared';

/**
 * Client 2026-11-27 (the ダチ voice message trial, shared/voiceSound.ts): the member's own recording, made ready with
 * ffmpeg alone (no paid model):
 *
 *  1. cleanVoice — a mild noise removal, the loudness brought to one level, 1.2× faster with the pitch kept (atempo).
 *  2. mixVoice — a small sound that fits the words, far under the voice, pushed down further while the voice sounds
 *     (a side-chain compressor keyed by the voice), a short lead-in, a 1.5 s fade at the end.
 *
 * Both files are kept (the mix is what is heard; the clean voice alone is 〔おとをけす〕). The arguments are built by
 * pure functions (tested without running ffmpeg); the sounds are apps/api/assets/voice-sounds (made once by
 * scripts/make-voice-sounds.mjs).
 */

/** MP3, mono, constant bit rate: the length of a file is its bytes (mp3Seconds) */
export const MIX_KBPS = 96;
export const MIX_RATE = 44100;
/** the longest recording read (the web's recorder stops at 60 s) */
export const MIX_MAX_INPUT_SEC = 62;

export const MIX = {
  /** the voice's loudness (EBU R128, LUFS) and true peak ceiling (dBTP) */
  lufs: -16,
  truePeak: -1.5,
  /** how much of the noise floor is taken away (dB) — mild: a hard setting makes a voice sound under water */
  denoiseDb: 10,
  noiseFloorDb: -40,
  /** the rumble below the voice is cut (Hz) */
  highpassHz: 90,
  /** the library files peak at −6 dBFS; these bring a bed / an accent to its place under the voice (dB) */
  bedDb: -24,
  accentDb: -20,
  /** the weakest うれしい: this much lower still, and no ending accent */
  softDb: -6,
  /** the voice comes in this long after the sound (ms) */
  leadMs: 250,
  /** after the voice: a bed rings on this long, the last `fadeSec` of it fading (seconds) */
  tailSec: 1.8,
  fadeSec: 1.5,
  /** the ending accent starts this long before the voice ends (seconds) */
  endOverlapSec: 0.15,
  /** ducked further while the voice sounds: the side-chain compressor */
  duck: { threshold: 0.05, ratio: 2.5, attackMs: 20, releaseMs: 400 },
} as const;

const n = (v: number, d = 3) => String(Math.round(v * 10 ** d) / 10 ** d);

/** the length of a constant-bit-rate MP3 from its size */
export const mp3Seconds = (bytes: number, kbps: number = MIX_KBPS): number => Math.round(((bytes * 8) / (kbps * 1000)) * 100) / 100;

/** the clean-up chain: rumble out, mild FFT denoise, faster with the pitch kept, one loudness, back to 44.1 kHz */
export function cleanFilter(tempo: number = VOICE_MIX_TEMPO): string {
  return [
    `highpass=f=${MIX.highpassHz}`,
    `afftdn=nr=${MIX.denoiseDb}:nf=${MIX.noiseFloorDb}`,
    // atempo keeps the pitch (0.5–2.0 in one step); before loudnorm, so the loudness is measured on what is heard
    `atempo=${n(tempo)}`,
    `loudnorm=I=${MIX.lufs}:TP=${MIX.truePeak}:LRA=11`,
    // loudnorm works at 192 kHz inside
    `aresample=${MIX_RATE}`,
  ].join(',');
}

const OUT_ARGS = ['-vn', '-ac', '1', '-ar', String(MIX_RATE), '-b:a', `${MIX_KBPS}k`, '-map_metadata', '-1', '-f', 'mp3', 'pipe:1'];

/** ffmpeg's arguments for the clean-up of the recording at `src` */
export function cleanArgs(src: string, tempo: number = VOICE_MIX_TEMPO): string[] {
  return ['-hide_banner', '-loglevel', 'error', '-i', src, '-t', String(MIX_MAX_INPUT_SEC), '-af', cleanFilter(tempo), ...OUT_ARGS];
}

export type MixPart = { file: string; loop: boolean };
export interface MixPlan {
  /** the sound files, in the order of ffmpeg's inputs 1.. (input 0 is the voice) */
  parts: MixPart[];
  filter: string;
  /** the mix's whole length (seconds) */
  total: number;
}

/**
 * The filter graph of one mix. Input 0 is the cleaned voice (`voiceSec` long); the sound's parts follow.
 *  - a bed is looped (at the input), brought to bedDb, trimmed to the voice + tail and faded out;
 *  - an accent plays once at the start (accentDb), another starts just before the voice ends;
 *  - together they pass a compressor keyed by the voice (ducked while it sounds), then are added to the voice — amix
 *    with normalize=0 (the voice keeps its own level) — and a limiter keeps the sum under the ceiling.
 */
export function mixPlan(voiceSec: number, mood: VoiceMood, soft = false): MixPlan {
  const has = VOICE_SOUND_PARTS[mood];
  const lead = MIX.leadMs / 1000;
  const voiceEnd = lead + voiceSec;
  const total = Math.round((voiceEnd + MIX.tailSec) * 1000) / 1000;
  const fmt = `aformat=sample_fmts=fltp:sample_rates=${MIX_RATE}:channel_layouts=mono`;
  const less = soft ? MIX.softDb : 0;
  const parts: MixPart[] = [];
  const chains: string[] = [`[0:a]${fmt},adelay=${MIX.leadMs}:all=1,apad=whole_dur=${n(total)},asplit=2[voice][key]`];
  const sounds: string[] = [];
  const add = (suffix: 'a' | 'z' | 'bed', chain: string) => {
    parts.push({ file: `${mood}-${suffix}.mp3`, loop: suffix === 'bed' });
    const label = `s${parts.length}`;
    chains.push(`[${parts.length}:a]${fmt},${chain}[${label}]`);
    sounds.push(`[${label}]`);
  };
  if (has.bed) add('bed', `volume=${n(MIX.bedDb + less, 1)}dB,atrim=0:${n(total)},afade=t=in:st=0:d=0.3,afade=t=out:st=${n(total - MIX.fadeSec)}:d=${MIX.fadeSec}`);
  if (has.a) add('a', `volume=${n(MIX.accentDb + less, 1)}dB`);
  // the weakest sound has no ending accent: one faint bell as it starts, and that is all
  if (has.z && !soft) add('z', `volume=${n(MIX.accentDb, 1)}dB,adelay=${Math.round((voiceEnd - MIX.endOverlapSec) * 1000)}:all=1`);
  chains.push(`${sounds.join('')}${sounds.length > 1 ? `amix=inputs=${sounds.length}:normalize=0:duration=longest,` : ''}apad=whole_dur=${n(total)},atrim=0:${n(total)}[sound]`);
  const d = MIX.duck;
  chains.push(`[sound][key]sidechaincompress=threshold=${d.threshold}:ratio=${d.ratio}:attack=${d.attackMs}:release=${d.releaseMs}[ducked]`);
  chains.push(`[voice][ducked]amix=inputs=2:normalize=0:duration=first,afade=t=out:st=${n(total - 0.4)}:d=0.4,alimiter=limit=0.84:level=0[out]`);
  return { parts, filter: chains.join(';'), total };
}

/** ffmpeg's arguments for the mix: the voice at `voice`, the library in `dir` */
export function mixArgs(voice: string, dir: string, plan: MixPlan): string[] {
  const inputs = plan.parts.flatMap((p) => [...(p.loop ? ['-stream_loop', '-1'] : []), '-i', join(dir, p.file)]);
  return ['-hide_banner', '-loglevel', 'error', '-i', voice, ...inputs, '-filter_complex', plan.filter, '-map', '[out]', '-t', n(plan.total), ...OUT_ARGS];
}

/** where the committed library is (src/voice or dist/voice → apps/api/assets/voice-sounds) */
export const VOICE_SOUNDS_DIR = resolve(__dirname, '../../assets/voice-sounds');

function run(args: string[]): Promise<Buffer> {
  return new Promise<Buffer>((ok, no) => {
    const p = spawn('ffmpeg', args);
    const out: Buffer[] = [];
    let err = '';
    p.stdout.on('data', (d: Buffer) => out.push(d));
    p.stderr.on('data', (d: Buffer) => (err += d.toString()));
    p.on('error', no);
    p.on('close', (code) => (code === 0 && out.length ? ok(Buffer.concat(out)) : no(new Error(err.slice(-300) || `ffmpeg ${code}`))));
  });
}

async function withFile<T>(data: Buffer, work: (path: string) => Promise<T>): Promise<T> {
  // a file, not a pipe: an iPhone recording's index (moov) is at its end (voice/audio.ts)
  const dir = await mkdtemp(join(tmpdir(), 'obolo-mix-'));
  const src = join(dir, 'in');
  try {
    await writeFile(src, data);
    return await work(src);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** a browser recording (webm / mp4 …) → the clean, faster voice (MP3) and its length */
export async function cleanVoice(input: Buffer, tempo: number = VOICE_MIX_TEMPO): Promise<{ mp3: Buffer; seconds: number }> {
  const mp3 = await withFile(input, (src) => run(cleanArgs(src, tempo)));
  // a tenth of a second is about 1.2 kB; less is no sound at all
  if (mp3.length < 1000) throw new Error(`ffmpeg made no sound (${mp3.length} bytes)`);
  return { mp3, seconds: mp3Seconds(mp3.length) };
}

/** the cleaned voice with its sound mixed in (MP3); `none` is not mixed — the caller keeps the clean voice */
export async function mixVoice(voiceMp3: Buffer, pick: VoiceSoundPick & { sound: VoiceMood }, dir: string = VOICE_SOUNDS_DIR): Promise<{ mp3: Buffer; seconds: number }> {
  const plan = mixPlan(mp3Seconds(voiceMp3.length), pick.sound, !!pick.soft);
  const mp3 = await withFile(voiceMp3, (src) => run(mixArgs(src, dir, plan)));
  if (mp3.length < 1000) throw new Error(`ffmpeg made no mix (${mp3.length} bytes)`);
  return { mp3, seconds: mp3Seconds(mp3.length) };
}
