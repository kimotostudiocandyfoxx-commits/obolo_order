import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { semitoneRatio, VOICE_SOUND_PARTS, VOICE_TUNE_DEFAULT, type VoiceMood, type VoiceSoundPick, type VoiceTune } from '@obolo/shared';

/**
 * Client 2026-11-27 (the ダチ voice message, shared/voiceSound.ts and voiceTune.ts): the member's own recording, made
 * ready on our own machine (no paid model):
 *
 *  1. cleanVoice — sample K, the default the client chose by ear (the member's own settings change it: voiceTune.ts):
 *       a. clean      ffmpeg: rumble out (100 Hz), a strong noise removal that follows the noise, a gate
 *       b. the cut    ffmpeg silenceremove: the silence before the first word goes, a pause longer than 0.28 s
 *                     becomes 0.14 s (SILENCE_CUT; 「間をつめる」)
 *       c. autotune   assets/voice-tune/autotune.py (python3 + praat-parselmouth): every pitch point pulled toward
 *                     the nearest semitone by the strength (0.6). A subprocess with a time limit: when it fails or
 *                     is late the chain goes on without it — a message is never lost for it.
 *       d. the shape  ffmpeg rubberband: 1.8× faster and +2 semitones (formants not kept: the approved sound; the key
 *                     was +6 until the client tried it), then one loudness (−16 LUFS). Without the rubberband filter: asetrate + atempo (the same speed and
 *                     pitch, a rougher sound).
 *     The words are heard from (a) — clean, uncut, at the speed and pitch it was said in (`heard`), so the caption
 *     does not depend on the settings. heardVoice is (a) alone, for the 「きれい」 version (shared voiceVersion.ts):
 *     the take is heard as words and nothing of it is kept.
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

/** a. the clean-up (sample K): the rumble cut (Hz), the noise removal (dB taken away, the floor, tracking on), the gate */
export const CLEAN = {
  highpassHz: 100,
  denoiseDb: 24,
  noiseFloorDb: -45,
  gate: { threshold: 0.012, ratio: 2, attackMs: 10, releaseMs: 250 },
} as const;
/**
 * b. 「間をつめる」 (the client may still tune it or drop it: `on` is the default for a member who has not chosen).
 * Below `thresholdDb` is silence: all of it before the first word but `startKeepSec`; a pause longer than
 * `pauseOverSec` is cut down to `pauseKeepSec`.
 */
export const SILENCE_CUT = { on: VOICE_TUNE_DEFAULT.cut, thresholdDb: -40, startKeepSec: 0.05, pauseOverSec: 0.28, pauseKeepSec: 0.14 } as const;
/** c. the autotune (the pitch analysis itself is in the script: Praat "To Manipulation" 0.01 s, 75–500 Hz) */
export const AUTOTUNE = { script: resolve(__dirname, '../../assets/voice-tune/autotune.py'), python: 'python3', timeoutMs: 8000 } as const;
/** a take with less voice than this left after the cut is no message (the web says 「もう少し長く、話してね」) */
export const MIN_VOICE_SEC = 0.3;
/** the cut and the autotune work on plain PCM (mono, 16 bit) */
const WAV_BYTES_PER_SEC = MIX_RATE * 2;

export function cleanFilter(): string {
  const g = CLEAN.gate;
  return [`highpass=f=${CLEAN.highpassHz}`, `afftdn=nr=${CLEAN.denoiseDb}:nf=${CLEAN.noiseFloorDb}:tn=1`, `agate=threshold=${g.threshold}:ratio=${g.ratio}:attack=${g.attackMs}:release=${g.releaseMs}`].join(',');
}
export function cutFilter(): string {
  const c = SILENCE_CUT;
  return `silenceremove=start_periods=1:start_threshold=${c.thresholdDb}dB:start_silence=${c.startKeepSec}:stop_periods=-1:stop_duration=${c.pauseOverSec}:stop_threshold=${c.thresholdDb}dB:stop_silence=${c.pauseKeepSec}`;
}
/**
 * d. the speed and the key, then one loudness. rubberband changes both at once (formants not kept). Without it:
 * asetrate raises the pitch and the speed together by the ratio, atempo brings the speed to what was asked.
 */
export function shapeFilter(tune: Pick<VoiceTune, 'key' | 'speed'>, rubberband = true): string {
  const pitch = semitoneRatio(tune.key);
  const change: string[] = [];
  if (rubberband) {
    if (tune.speed !== 1 || tune.key !== 0) change.push(`rubberband=tempo=${n(tune.speed)}:pitch=${n(pitch, 6)}`);
  } else {
    if (tune.key !== 0) change.push(`asetrate=${Math.round(MIX_RATE * pitch)}`, `aresample=${MIX_RATE}`);
    // one atempo step is 0.5–2.0: two steps for more
    let t = tune.speed / pitch;
    for (; t > 2; t /= 2) change.push('atempo=2');
    for (; t < 0.5; t *= 2) change.push('atempo=0.5');
    if (Math.abs(t - 1) > 1e-6) change.push(`atempo=${n(t, 6)}`);
  }
  // loudnorm works at 192 kHz inside
  return [...change, `loudnorm=I=${MIX.lufs}:TP=${MIX.truePeak}:LRA=11`, `aresample=${MIX_RATE}`].join(',');
}

const OUT_ARGS = ['-vn', '-ac', '1', '-ar', String(MIX_RATE), '-b:a', `${MIX_KBPS}k`, '-map_metadata', '-1', '-f', 'mp3', 'pipe:1'];
const IN_ARGS = ['-hide_banner', '-loglevel', 'error', '-y'];

/**
 * ffmpeg's arguments for a + b: the recording at `src` → `heard` (clean and whole: an MP3 for the words) and `voice`
 * (the same, the silences cut when `cut`: a WAV for the next steps)
 */
export function prepareArgs(src: string, heard: string, voice: string, cut: boolean = SILENCE_CUT.on): string[] {
  const graph = `[0:a]${cleanFilter()},aresample=${MIX_RATE},aformat=sample_fmts=s16:channel_layouts=mono,asplit=2[h][v0];[v0]${cut ? cutFilter() : 'anull'}[v]`;
  return [...IN_ARGS, '-t', String(MIX_MAX_INPUT_SEC), '-i', src, '-filter_complex', graph, '-map', '[h]', '-b:a', `${MIX_KBPS}k`, '-map_metadata', '-1', '-f', 'mp3', heard, '-map', '[v]', '-c:a', 'pcm_s16le', '-f', 'wav', voice];
}
/** ffmpeg's arguments for a alone: the recording at `src` → clean and whole (MP3 on stdout), to be heard as words */
export function hearArgs(src: string): string[] {
  return [...IN_ARGS, '-t', String(MIX_MAX_INPUT_SEC), '-i', src, '-af', `${cleanFilter()},aresample=${MIX_RATE}`, ...OUT_ARGS];
}
/** ffmpeg's arguments for d: the WAV at `src` → the voice as it is sent (MP3 on stdout) */
export function shapeArgs(src: string, tune: Pick<VoiceTune, 'key' | 'speed'>, rubberband = true): string[] {
  return [...IN_ARGS, '-i', src, '-af', shapeFilter(tune, rubberband), ...OUT_ARGS];
}
/** the autotune's command line (c) */
export function autotuneArgs(src: string, out: string, strength: number, script: string = AUTOTUNE.script): string[] {
  return [script, src, out, n(Math.min(1, Math.max(0, strength)), 2)];
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

function run(args: string[], stdout = true): Promise<Buffer> {
  return new Promise<Buffer>((ok, no) => {
    const p = spawn('ffmpeg', args);
    const out: Buffer[] = [];
    let err = '';
    p.stdout.on('data', (d: Buffer) => out.push(d));
    p.stderr.on('data', (d: Buffer) => (err += d.toString()));
    p.on('error', no);
    p.on('close', (code) => (code === 0 && (out.length || !stdout) ? ok(Buffer.concat(out)) : no(new Error(err.slice(-300) || `ffmpeg ${code}`))));
  });
}

async function withDir<T>(work: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'obolo-mix-'));
  try {
    return await work(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
async function withFile<T>(data: Buffer, work: (path: string, dir: string) => Promise<T>): Promise<T> {
  // a file, not a pipe: an iPhone recording's index (moov) is at its end (voice/audio.ts)
  return withDir(async (dir) => {
    const src = join(dir, 'in');
    await writeFile(src, data);
    return work(src, dir);
  });
}

/** c. the autotune as a subprocess with a time limit; false = not done (the caller goes on with the voice as it is) */
export function autotune(src: string, out: string, strength: number, o: { python?: string; timeoutMs?: number; script?: string } = {}): Promise<boolean> {
  return new Promise<boolean>((done) => {
    let over = false;
    const end = (ok: boolean) => {
      if (over) return;
      over = true;
      clearTimeout(timer);
      done(ok);
    };
    const p = spawn(o.python ?? AUTOTUNE.python, autotuneArgs(src, out, strength, o.script), { stdio: 'ignore' });
    const timer = setTimeout(() => {
      p.kill('SIGKILL');
      end(false);
    }, o.timeoutMs ?? AUTOTUNE.timeoutMs);
    p.on('error', () => end(false));
    p.on('close', (code) => void (code === 0 ? stat(out).then((s) => end(s.size > 44), () => end(false)) : end(false)));
  });
}

/** no voice was left in the take (all of it silence, or a slip of the finger) */
export class NoVoiceError extends Error {
  constructor(seconds: number) {
    super(`no voice in the take (${seconds}s after the cut)`);
  }
}

export interface CleanVoice {
  /** the voice as it is sent (MP3) and its length */
  mp3: Buffer;
  seconds: number;
  /** the take clean and whole — uncut, at the speed and pitch it was said in (MP3): what the words are heard from */
  heard: Buffer;
  /** how it was made: whether the autotune ran (false: off, failed or late) and which filter changed the speed and key */
  made: { autotune: boolean; shape: 'rubberband' | 'atempo' };
}
export interface CleanOptions {
  /** config VOICE_TUNE_PYTHON / VOICE_TUNE_TIMEOUT_MS */
  python?: string;
  timeoutMs?: number;
}

/** a recording (webm / mp4 … from the browser) → the voice in these settings */
export async function cleanVoice(input: Buffer, tune: VoiceTune = VOICE_TUNE_DEFAULT, o: CleanOptions = {}): Promise<CleanVoice> {
  return withFile(input, async (src, dir) => {
    const heardFile = join(dir, 'heard.mp3');
    const voice = join(dir, 'voice.wav');
    await run(prepareArgs(src, heardFile, voice, tune.cut), false);
    const left = Math.max(0, ((await stat(voice)).size - 44) / WAV_BYTES_PER_SEC);
    if (left < MIN_VOICE_SEC) throw new NoVoiceError(Math.round(left * 100) / 100);
    const tuned = join(dir, 'tuned.wav');
    const tunedOk = tune.tune > 0 && (await autotune(voice, tuned, tune.tune, o));
    const from = tunedOk ? tuned : voice;
    let shape: CleanVoice['made']['shape'] = 'rubberband';
    const mp3 = await run(shapeArgs(from, tune)).catch(() => {
      // an ffmpeg built without librubberband: the same speed and key by asetrate + atempo
      shape = 'atempo';
      return run(shapeArgs(from, tune, false));
    });
    // a tenth of a second is about 1.2 kB; less is no sound at all
    if (mp3.length < 1000) throw new Error(`ffmpeg made no sound (${mp3.length} bytes)`);
    return { mp3, seconds: mp3Seconds(mp3.length), heard: await readFile(heardFile), made: { autotune: tunedOk, shape } };
  });
}

/** a recording → clean and whole (MP3), only to be heard as words: step a alone, nothing cut or changed */
export async function heardVoice(input: Buffer): Promise<Buffer> {
  const mp3 = await withFile(input, (src) => run(hearArgs(src)));
  if (mp3.length < 1000) throw new Error(`ffmpeg made no sound (${mp3.length} bytes)`);
  return mp3;
}

/** the cleaned voice with its sound mixed in (MP3); `none` is not mixed — the caller keeps the clean voice */
export async function mixVoice(voiceMp3: Buffer, pick: VoiceSoundPick & { sound: VoiceMood }, dir: string = VOICE_SOUNDS_DIR): Promise<{ mp3: Buffer; seconds: number }> {
  const plan = mixPlan(mp3Seconds(voiceMp3.length), pick.sound, !!pick.soft);
  const mp3 = await withFile(voiceMp3, (src) => run(mixArgs(src, dir, plan)));
  if (mp3.length < 1000) throw new Error(`ffmpeg made no mix (${mp3.length} bytes)`);
  return { mp3, seconds: mp3Seconds(mp3.length) };
}
