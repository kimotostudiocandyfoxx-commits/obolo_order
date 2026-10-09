import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { run } from '../media/transcode';
import type { KeyArtist } from './keyart';
import type { MvEffect, MvPlan, MvSegment, MvTextEffect } from './plan';

/**
 * The MV itself (ffmpeg, in the API image; no cost per MV). Every cut of Bati's direction sheet
 * becomes a square clip — photos move (zoom / pan), videos are cut and cropped, the キメ絵 are the
 * anime illustrations — with its picture effect; the clips are joined, faded and put under the
 * song. The lyrics version burns the lines onto the finished MV, each with its text effect.
 */
const SIDE = 720;
const FPS = 24;

/** the light painted look every cut gets (not the キメ絵, they are drawn already) */
export const ANIME_FILTER = 'hqdn3d=3:3:4:4,eq=saturation=1.45:contrast=1.12:brightness=0.02,unsharp=5:5:0.8';

export type RenderMaterial = { kind: 'photo' | 'video'; file: string };

function motion(m: MvSegment['motion'], frames: number, beat = 0.5) {
  const z = 1.18;
  switch (m) {
    case 'pulse': {
      // a small punch-in on every beat, easing out until the next one
      const per = Math.max(1, beat * FPS).toFixed(3);
      return `z='1.06+0.06*pow(1-mod(on,${per})/${per},3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
    }
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

/** The picture effect of one cut (on the square SIDE×SIDE picture). `painted` = already anime (no painted look on top). */
function effectFilter(e: MvEffect, beat: number, painted = false) {
  const look = painted ? 'null' : ANIME_FILTER;
  switch (e) {
    case 'POSTERIZE':
      // cel colours: 3 bits a channel, a little lift so shadows do not go black
      return `${look},lutrgb=r='bitand(val,224)+16':g='bitand(val,224)+16':b='bitand(val,224)+16'`;
    case 'GLITCH': {
      // colour split all along, plus a hard shake on every beat
      const hit = `lt(mod(t,${beat.toFixed(3)}),0.09)`;
      return `${look},rgbashift=rh=-9:bh=9,noise=alls=9:allf=t,scale=${SIDE + 32}:${SIDE + 32},crop=${SIDE}:${SIDE}:x='16+if(${hit},14*sin(t*97),0)':y='16+if(${hit},10*cos(t*83),0)'`;
    }
    default:
      return look;
  }
}

/** Manga speed lines around the middle (transparent PNG). */
async function speedLines(file: string) {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const c = SIDE / 2;
  const rays: string[] = [];
  for (let k = 0; k < 90; k++) {
    const a = (k / 90) * Math.PI * 2 + rnd() * 0.05;
    const w = 0.004 + rnd() * 0.012;
    const r0 = SIDE * (0.3 + rnd() * 0.18);
    const r1 = SIDE;
    const p = (r: number, d: number) => `${(c + Math.cos(a + d) * r).toFixed(1)},${(c + Math.sin(a + d) * r).toFixed(1)}`;
    rays.push(`<polygon points="${p(r0, 0)} ${p(r1, -w)} ${p(r1, w)}" fill="white" fill-opacity="${(0.55 + rnd() * 0.4).toFixed(2)}"/>`);
  }
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIDE}" height="${SIDE}">${rays.join('')}</svg>`))
    .png()
    .toFile(file);
}

const ff = (args: string[], timeout = 240_000) => run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], timeout);
const enc = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an'];

export async function renderMv(o: {
  dir: string;
  materials: RenderMaterial[];
  plan: MvPlan;
  audio: string;
  seconds: number;
  bpm: number;
  keyArtist: KeyArtist;
  /** the materials are anime pictures already (story MV): no painted look on top */
  painted?: boolean;
}): Promise<{ video: string; poster: string; keyCuts: number }> {
  const { dir } = o;
  const beat = 60 / (o.bpm || 100);
  const lines = join(dir, 'lines.png');
  if (o.plan.segments.some((s) => s.effect === 'SPEED_LINES')) await speedLines(lines);

  // キメ絵: one anime illustration per material marked key (a video gives the frame where its cut starts)
  const keyArt = new Map<number, string | null>();
  const keyOf = async (s: MvSegment) => {
    if (keyArt.has(s.m)) return keyArt.get(s.m)!;
    const mat = o.materials[s.m];
    let src: Buffer;
    if (mat.kind === 'video') {
      const frame = join(dir, `key-src-${s.m}.png`);
      await ff(['-ss', s.from.toFixed(2), '-i', mat.file, '-frames:v', '1', frame]);
      src = await readFile(frame);
    } else src = await readFile(mat.file);
    const drawn = await o.keyArtist.draw(src).catch(() => null);
    const out = drawn ? join(dir, `key-${s.m}.png`) : null;
    if (out) await writeFile(out, drawn!);
    keyArt.set(s.m, out);
    return out;
  };

  const clips: string[] = [];
  for (const [k, s] of o.plan.segments.entries()) {
    const mat = o.materials[s.m];
    const clip = join(dir, `clip-${k}.mp4`);
    const frames = Math.max(1, Math.round(s.dur * FPS));
    const key = s.key ? await keyOf(s) : null;
    const big = `scale=${SIDE * 2}:${SIDE * 2}:force_original_aspect_ratio=increase,crop=${SIDE * 2}:${SIDE * 2}`;
    const inputs: string[] = [];
    let base: string;
    if (key || mat.kind === 'photo') {
      inputs.push('-loop', '1', '-i', key ?? mat.file);
      base = `[0:v]${big},zoompan=${motion(s.motion === 'still' ? 'zoom-in' : s.motion, frames, beat)}:d=${frames}:s=${SIDE}x${SIDE}:fps=${FPS},setsar=1`;
    } else {
      inputs.push('-ss', s.from.toFixed(2), '-t', s.dur.toFixed(2), '-i', mat.file);
      base = `[0:v]crop='min(iw,ih)':'min(iw,ih)',scale=${SIDE}:${SIDE},fps=${FPS},setsar=1`;
    }
    // the キメ絵 are drawn already: they only get a white flash in
    const look = key ? `fade=t=in:st=0:d=0.25:color=white` : effectFilter(s.effect, beat, o.painted);
    let graph = `${base},${look}[v]`;
    if (s.effect === 'SPEED_LINES') {
      inputs.push('-loop', '1', '-i', lines);
      graph = `${base},${look}[b];[1:v]format=rgba,rotate=a='0.06*sin(n*2.7)':c=none:ow=iw:oh=ih[l];[b][l]overlay=shortest=1,format=yuv420p[v]`;
    }
    await ff([...inputs, '-filter_complex', graph, '-map', '[v]', '-frames:v', String(frames), ...enc, clip]);
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
  // the poster: the first キメ絵 if there is one
  const firstKey = o.plan.segments.reduce<{ t: number; at: number | null }>((a, s) => (a.at === null && s.key && keyArt.get(s.m) ? { t: a.t, at: a.t } : { t: a.t + s.dur, at: a.at }), {
    t: 0,
    at: null,
  }).at;
  const poster = join(dir, 'poster.webp');
  await ff(['-ss', (firstKey !== null ? firstKey + 0.6 : Math.min(2, o.seconds / 3)).toFixed(2), '-i', video, '-frames:v', '1', '-vf', 'scale=480:480', poster]);
  return { video, poster, keyCuts: [...keyArt.values()].filter(Boolean).length };
}

export type LyricLine = { t: number; end: number; text: string; effect: MvTextEffect };

/** Lyric lines as an ASS subtitle file, each line with its text effect. */
function assFile(lines: LyricLine[]) {
  const ts = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = (Math.max(0, s) % 60).toFixed(2).padStart(5, '0');
    return `${h}:${String(m).padStart(2, '0')}:${sec}`;
  };
  const esc = (t: string) => t.replace(/[{}\\]/g, '').replace(/\n/g, '\\N');
  const c = SIDE / 2;
  const ev = (a: number, b: number, style: string, tags: string, text: string) => `Dialogue: 0,${ts(a)},${ts(b)},${style},,0,0,0,,{${tags}}${esc(text)}`;
  const events: string[] = [];
  for (const l of lines) {
    switch (l.effect) {
      case 'ZOOM_BURST':
        events.push(ev(l.t, l.end, 'Big', `\\pos(${c},${c})\\fad(60,200)\\fscx190\\fscy190\\t(0,260,\\fscx100\\fscy100)`, l.text));
        break;
      case 'STROBO_FLASH': {
        // yellow / white every 110 ms for the first second, then white
        let tags = `\\pos(${c},${c})\\fad(0,200)\\c&H00E5FF&`;
        for (let k = 1; k <= 9; k++) tags += `\\t(${k * 110},${k * 110 + 1},\\c&H${k % 2 ? 'FFFFFF' : '00E5FF'}&)`;
        events.push(ev(l.t, l.end, 'Big', tags, l.text));
        break;
      }
      case 'SHAKE_HARD': {
        // shaking for the first second (short events at jumping positions), then still
        const until = Math.min(l.end, l.t + 1);
        let k = 0;
        for (let t = l.t; t < until - 0.01; t += 0.07, k++) {
          const dx = Math.round(Math.sin(k * 2.3) * 14);
          const dy = Math.round(Math.cos(k * 3.1) * 10);
          events.push(ev(t, Math.min(until, t + 0.07), 'Big', `\\pos(${c + dx},${c + dy})`, l.text));
        }
        if (until < l.end) events.push(ev(until, l.end, 'Big', `\\pos(${c},${c})\\fad(0,200)`, l.text));
        break;
      }
      default:
        events.push(ev(l.t, l.end, 'Lyric', '\\fad(200,200)', l.text));
    }
  }
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${SIDE}`,
    `PlayResY: ${SIDE}`,
    'WrapStyle: 0',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Lyric,Noto Sans CJK JP,46,&H00FFFFFF,&H00FFFFFF,&H00602A3A,&H80000000,1,0,0,0,100,100,1,0,1,4,2,2,40,40,56,1',
    'Style: Big,Noto Sans CJK JP,62,&H00FFFFFF,&H00FFFFFF,&H00401860,&H90000000,1,0,0,0,100,100,2,0,1,6,3,5,30,30,30,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
  ].join('\n');
}

/** The MV with the lyric lines on it (the picture is not edited again). */
export async function burnLyrics(dir: string, video: string, lines: LyricLine[]): Promise<string> {
  const ass = join(dir, 'lyrics.ass');
  await writeFile(ass, assFile(lines));
  const out = join(dir, 'mv-lyrics.mp4');
  await ff(['-i', video, '-vf', `ass=${ass}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', out], 600_000);
  return out;
}
