import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../media/transcode';
import type { MvPlan, MvSegment } from './plan';
import { ANIME_FILTER, type Stylizer } from './stylize';

/**
 * The MV itself (ffmpeg, in the API image): every segment of Bati's plan becomes a square clip
 * (photos move — zoom / pan; videos are cut and cropped), with the anime look; the clips are joined,
 * faded and put under the song. The lyrics version burns the lines onto the finished MV.
 */
const SIDE = 720;
const FPS = 24;
/** anime frames for video segments (8 fps, like hand-drawn animation) */
const ANIME_FPS = 8;

export type RenderMaterial = { kind: 'photo' | 'video'; file: string };

function motion(m: MvSegment['motion'], frames: number) {
  const z = 1.18;
  switch (m) {
    case 'zoom-in':
      return `z='min(1+${(0.18 / frames).toFixed(5)}*on,${z})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
    case 'zoom-out':
      return `z='max(${z}-${(0.18 / frames).toFixed(5)}*on,1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
    case 'pan-left':
      return `z='${z}':x='(iw-iw/zoom)*(1-on/${frames})':y='ih/2-(ih/zoom/2)'`;
    case 'pan-right':
      return `z='${z}':x='(iw-iw/zoom)*(on/${frames})':y='ih/2-(ih/zoom/2)'`;
    default:
      return `z='1':x='0':y='0'`;
  }
}

const ff = (args: string[], timeout = 240_000) => run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], timeout);
const enc = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an'];

export async function renderMv(o: {
  dir: string;
  materials: RenderMaterial[];
  plan: MvPlan;
  audio: string;
  seconds: number;
  stylizer: Stylizer;
  /** how many video frames may go through the anime model (the rest get the filter) */
  animeFrameBudget: number;
}): Promise<{ video: string; poster: string }> {
  const { dir } = o;
  // photos get their anime look once, whatever how many times they are used
  const stillCache = new Map<number, string>();
  const still = async (m: number, anime: boolean) => {
    const key = anime ? m : -1 - m;
    if (stillCache.has(key)) return stillCache.get(key)!;
    const src = o.materials[m].file;
    const out = join(dir, `still-${key}.png`);
    if (anime && o.stylizer.usesModel) await writeFile(out, await o.stylizer.image(await readFile(src)));
    else await ff(['-i', src, '-frames:v', '1', ...(anime ? ['-vf', ANIME_FILTER] : []), out]);
    stillCache.set(key, out);
    return out;
  };

  let budget = o.animeFrameBudget;
  const clips: string[] = [];
  for (const [k, s] of o.plan.segments.entries()) {
    const mat = o.materials[s.m];
    const clip = join(dir, `clip-${k}.mp4`);
    const frames = Math.max(1, Math.round(s.dur * FPS));
    const square = `scale=${SIDE * 2}:${SIDE * 2}:force_original_aspect_ratio=increase,crop=${SIDE * 2}:${SIDE * 2}`;
    if (mat.kind === 'photo') {
      const img = await still(s.m, s.anime);
      await ff(['-loop', '1', '-i', img, '-vf', `${square},zoompan=${motion(s.motion, frames)}:d=${frames}:s=${SIDE}x${SIDE}:fps=${FPS},setsar=1`, '-frames:v', String(frames), ...enc, clip]);
    } else {
      const crop = `crop='min(iw,ih)':'min(iw,ih)',scale=${SIDE}:${SIDE},setsar=1`;
      const need = Math.ceil(s.dur * ANIME_FPS);
      if (s.anime && o.stylizer.usesModel && need <= budget) {
        // hand-drawn feel: 8 frames a second through the anime model
        budget -= need;
        const fdir = join(dir, `f-${k}`);
        await run('mkdir', ['-p', fdir]);
        await ff(['-ss', s.from.toFixed(2), '-t', s.dur.toFixed(2), '-i', mat.file, '-vf', `${crop},fps=${ANIME_FPS}`, join(fdir, '%04d.png')]);
        for (const f of (await readdir(fdir)).filter((x) => x.endsWith('.png')).sort()) await writeFile(join(fdir, f), await o.stylizer.image(await readFile(join(fdir, f))));
        await ff(['-framerate', String(ANIME_FPS), '-i', join(fdir, '%04d.png'), '-vf', `scale=${SIDE}:${SIDE},fps=${FPS},setsar=1`, '-t', s.dur.toFixed(2), ...enc, clip]);
      } else {
        await ff(['-ss', s.from.toFixed(2), '-t', s.dur.toFixed(2), '-i', mat.file, '-vf', `${crop},fps=${FPS}${s.anime ? `,${ANIME_FILTER}` : ''}`, ...enc, clip]);
      }
    }
    clips.push(clip);
  }

  // join, fade in / out, put the song under it
  const list = join(dir, 'clips.txt');
  await writeFile(list, clips.map((c) => `file '${c}'`).join('\n'));
  const joined = join(dir, 'joined.mp4');
  await ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);
  const video = join(dir, 'mv.mp4');
  const end = Math.max(0.5, o.seconds - 1);
  await ff(
    [
      '-i',
      joined,
      '-i',
      o.audio,
      '-map',
      '0:v',
      '-map',
      '1:a',
      '-t',
      o.seconds.toFixed(2),
      '-vf',
      `fade=t=in:st=0:d=0.6,fade=t=out:st=${end.toFixed(2)}:d=1`,
      '-af',
      `afade=t=out:st=${end.toFixed(2)}:d=1`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-movflags',
      '+faststart',
      video,
    ],
    600_000,
  );
  const poster = join(dir, 'poster.webp');
  await ff(['-ss', Math.min(2, o.seconds / 3).toFixed(2), '-i', video, '-frames:v', '1', '-vf', 'scale=480:480', poster]);
  return { video, poster };
}

/** Lyric lines as an ASS subtitle file: big, rounded, outlined, at the bottom. */
function assFile(lines: { t: number; end: number; text: string }[]) {
  const ts = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = (s % 60).toFixed(2).padStart(5, '0');
    return `${h}:${String(m).padStart(2, '0')}:${sec}`;
  };
  const esc = (t: string) => t.replace(/[{}\\]/g, '').replace(/\n/g, '\\N');
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${SIDE}`,
    `PlayResY: ${SIDE}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Lyric,Noto Sans CJK JP,46,&H00FFFFFF,&H00FFFFFF,&H00602A3A,&H80000000,1,0,0,0,100,100,1,0,1,4,2,2,40,40,56,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...lines.map((l) => `Dialogue: 0,${ts(l.t)},${ts(l.end)},Lyric,,0,0,0,,{\\fad(200,200)}${esc(l.text)}`),
  ].join('\n');
}

/** The MV with the lyric lines on it (the picture is not edited again). */
export async function burnLyrics(dir: string, video: string, lines: { t: number; end: number; text: string }[]): Promise<string> {
  const ass = join(dir, 'lyrics.ass');
  await writeFile(ass, assFile(lines));
  const out = join(dir, 'mv-lyrics.mp4');
  await ff(['-i', video, '-vf', `ass=${ass}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', out], 600_000);
  return out;
}
