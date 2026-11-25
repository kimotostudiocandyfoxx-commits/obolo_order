import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TWEAK_XFADE, type Segment, type TweakPlan } from '@obolo/shared';
import { probe, run } from '../media/transcode';

/**
 * R13 (client 2026-11-25): a finished song changed for free on our side — ffmpeg on the two stems we keep (the vocal and
 * the instrumental, HTDemucs), always from the original stems with every op so far (no loss version to version):
 *  1. the stretches kept (cuts / repeats by the lyric line times), joined with a short crossfade — both stems alike
 *  2. the voice / the music louder or softer, or muted (karaoke / vocals only), a little room on the voice
 *  3. mixed, then the key and the tempo together (rubberband: pitch and time independent; without it, asetrate+atempo)
 *  4. at most the length asked (with a fade-out), fades, the loudness
 * At most TWEAK_FFMPEG_MS of ffmpeg a change (our CPU time).
 */
export const TWEAK_FFMPEG_MS = 90_000;

let hasRubberband: Promise<boolean> | null = null;
/** whether this ffmpeg has the rubberband filter (Debian's has; checked once) */
export function rubberbandReady(): Promise<boolean> {
  hasRubberband ??= run('ffmpeg', ['-hide_banner', '-filters'], 15_000)
    .then((o) => /\brubberband\b/.test(o))
    .catch(() => false);
  return hasRubberband;
}

/**
 * R17: rubberband at its cleanest for a sung mix — the formants kept (the voice does not go chipmunk), the high-quality
 * pitch path, smooth transients and laminar phase (no phasey / metallic vocals), both channels together (the image kept)
 */
export const RUBBERBAND_HQ = 'formant=preserved:pitchq=quality:transients=smooth:phase=laminar:channels=together';

/** the tempo (and key) change as ffmpeg filters: rubberband in high quality, else asetrate + atempo; [] when none */
export function tempoFilters(tempo: number, semitones: number, rubberband: boolean): string[] {
  if (semitones === 0 && Math.abs(tempo - 1) <= 0.001) return [];
  const ratio = 2 ** (semitones / 12);
  if (rubberband) return [`rubberband=tempo=${tempo.toFixed(4)}:pitch=${ratio.toFixed(5)}:${RUBBERBAND_HQ}`];
  if (semitones !== 0) return [`asetrate=${Math.round(44100 * ratio)}`, 'aresample=44100', `atempo=${(tempo / ratio).toFixed(4)}`];
  return [`atempo=${tempo.toFixed(4)}`];
}

/**
 * R17: the song as delivered — the take sung at 1.0× made `tempo` faster, the pitch kept (SONG_DEFAULT_TEMPO); AAC in
 * MP4, and its length. The take itself is kept as the original (the free changes are made from it, never from this).
 */
export async function stretchSong(audio: Buffer, tempo: number): Promise<{ data: Buffer; seconds: number }> {
  const dir = await mkdtemp(join(tmpdir(), 'tempo-'));
  try {
    const src = join(dir, 'take');
    const out = join(dir, 'song.m4a');
    await writeFile(src, audio);
    const filters = ['aresample=44100', 'aformat=channel_layouts=stereo', ...tempoFilters(tempo, 0, await rubberbandReady())].join(',');
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-af', filters, '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], TWEAK_FFMPEG_MS);
    return { data: await readFile(out), seconds: Math.round((await probe(out)).seconds * 10) / 10 };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** the filter graph (exported for the tests): inputs 0 = instrumental, 1 = vocals; output [o] */
export function tweakGraph(o: { segments: Segment[]; plan: TweakPlan; seconds: number; total: number; rubberband: boolean }): string {
  const { plan } = o;
  const segs = o.segments.length ? o.segments : [{ start: 0, end: o.seconds }];
  const whole = segs.length === 1 && segs[0].start <= 0.01 && segs[0].end >= o.seconds - 0.01;
  const parts: string[] = [];
  const stem = (i: number, name: string) => {
    if (whole) return parts.push(`[${i}:a]aresample=44100,aformat=channel_layouts=stereo[${name}]`);
    parts.push(`[${i}:a]aresample=44100,aformat=channel_layouts=stereo,asplit=${segs.length}${segs.map((_, k) => `[${name}s${k}]`).join('')}`);
    segs.forEach((s, k) => parts.push(`[${name}s${k}]atrim=start=${s.start.toFixed(3)}:end=${s.end.toFixed(3)},asetpts=PTS-STARTPTS[${name}t${k}]`));
    let last = `${name}t0`;
    for (let k = 1; k < segs.length; k++) {
      const out = k === segs.length - 1 ? name : `${name}x${k}`;
      parts.push(`[${last}][${name}t${k}]acrossfade=d=${TWEAK_XFADE}:c1=tri:c2=tri[${out}]`);
      last = out;
    }
    if (segs.length === 1) parts.push(`[${name}t0]anull[${name}]`);
  };
  const db = (x: number) => (10 ** (x / 20)).toFixed(3);
  const useInst = plan.stem !== 'vocals';
  const useVoc = plan.stem !== 'instrumental';
  if (useInst) stem(0, 'i');
  if (useVoc) stem(1, 'v');
  if (useInst) parts.push(`[i]volume=${db(plan.bgmDb)}[ib]`);
  if (useVoc) {
    const room = plan.room > 0 ? `aecho=0.8:0.75:45|90:${(0.28 * plan.room).toFixed(2)}|${(0.14 * plan.room).toFixed(2)},` : '';
    parts.push(`[v]${room}volume=${db(plan.vocalDb)}[vb]`);
  }
  const mixed = useInst && useVoc ? '[ib][vb]amix=inputs=2:duration=longest:normalize=0' : useInst ? '[ib]anull' : '[vb]anull';
  // key and tempo
  // (R17: plan.tempo has the delivered tempo folded in — the stems are the 1.0× take)
  const kt = tempoFilters(plan.tempo, plan.semitones, o.rubberband);
  // length and fades (on the new timeline)
  const tail: string[] = [];
  const total = o.total;
  if (plan.maxSeconds && plan.maxSeconds > 0) tail.push(`atrim=0:${total.toFixed(2)}`);
  const fadeOut = plan.fadeOut || (plan.maxSeconds && plan.maxSeconds > 0 ? 4 : 0);
  if (plan.fadeIn > 0) tail.push(`afade=t=in:st=0:d=${plan.fadeIn.toFixed(2)}`);
  if (fadeOut > 0) tail.push(`afade=t=out:st=${Math.max(0, total - fadeOut).toFixed(2)}:d=${fadeOut.toFixed(2)}`);
  parts.push(`${mixed}${[...kt, ...tail, 'loudnorm=I=-14:TP=-1.5:LRA=11'].map((f) => `,${f}`).join('')}[o]`);
  return parts.join(';');
}

/** the new version's audio (AAC in MP4) and its length */
export async function renderTweak(o: { instrumental: Buffer; vocals: Buffer; segments: Segment[]; plan: TweakPlan; seconds: number; total: number }): Promise<{ data: Buffer; seconds: number }> {
  const dir = await mkdtemp(join(tmpdir(), 'tweak-'));
  try {
    const inst = join(dir, 'inst.m4a');
    const voc = join(dir, 'voc.m4a');
    const out = join(dir, 'song.m4a');
    await Promise.all([writeFile(inst, o.instrumental), writeFile(voc, o.vocals)]);
    const graph = tweakGraph({ ...o, rubberband: await rubberbandReady() });
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', inst, '-i', voc, '-filter_complex', graph, '-map', '[o]', '-ar', '44100', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], TWEAK_FFMPEG_MS);
    return { data: await readFile(out), seconds: Math.round((await probe(out)).seconds * 10) / 10 };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
