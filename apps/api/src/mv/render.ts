import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { run } from '../media/transcode';
import type { KeyArtist } from './keyart';
import { parallaxGraph, type Parallax } from './parallax';
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

/** `depth` (a grey picture, white = near) and `parallax` (its camera move, `focus` = the depth kept still) make a still move in 2.5D */
export type RenderMaterial = { kind: 'photo' | 'video'; file: string; depth?: string | null; parallax?: (Parallax & { focus: number }) | null };

function motion(m: MvSegment['motion'], frames: number, beat = 0.5) {
  const z = 1.18;
  switch (m) {
    case 'face':
      // a quick push towards the upper middle, where the character's face usually is
      return `z='min(1.15+${(0.25 / frames).toFixed(5)}*on,1.4)':x='iw/2-(iw/zoom/2)':y='ih*0.3-(ih/zoom/2)+ih/zoom/2*0.4'`;
    case 'tilt-up':
      // from the feet up to the face
      return `z='1.3':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(1-on/${frames})'`;
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
    let pre: string | null = null;
    if (!key && mat.kind === 'photo' && mat.depth && mat.parallax) {
      // 2.5D: near and far move apart; the chorus cuts keep their punch on the beat
      inputs.push('-loop', '1', '-framerate', String(FPS), '-i', mat.file, '-loop', '1', '-framerate', String(FPS), '-i', mat.depth);
      const p = { ...mat.parallax };
      // a scene cut into several bars swings back and forth instead of repeating the same slide
      const nth = o.plan.segments.slice(0, k).filter((x) => x.m === s.m).length;
      if (nth % 2 === 1) p.move = ({ 'orbit-left': 'orbit-right', 'orbit-right': 'orbit-left', 'crane-up': 'crane-down', 'crane-down': 'crane-up', 'dolly-in': 'dolly-out', 'dolly-out': 'dolly-in' } as const)[p.move];
      pre = parallaxGraph(p, mat.parallax.focus, s.dur, SIDE, s.motion === 'pulse' ? beat : undefined).replace(/\[v\]$/, '[pv]');
      base = '[pv]null';
    } else if (key || mat.kind === 'photo') {
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
      const li = pre ? 2 : 1;
      inputs.push('-loop', '1', '-i', lines);
      graph = `${base},${look}[b];[${li}:v]format=rgba,rotate=a='0.06*sin(n*2.7)':c=none:ow=iw:oh=ih[l];[b][l]overlay=shortest=1,format=yuv420p[v]`;
    }
    if (pre) graph = `${pre};${graph}`;
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

/**
 * Lyric lines as an ASS subtitle file, each line with its text effect (client 2026-10-11: show the
 * lyrics in a cool way). Every line comes in letter by letter, the sung part fills with colour as it
 * goes (karaoke, spread over the line), and a soft glow sits behind the letters.
 */
function assFile(lines: LyricLine[]) {
  const ts = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = (Math.max(0, s) % 60).toFixed(2).padStart(5, '0');
    return `${h}:${String(m).padStart(2, '0')}:${sec}`;
  };
  const clean = (t: string) => t.replace(/[{}\\]/g, '').replace(/\n/g, ' ');
  const c = SIDE / 2;
  const ev = (layer: number, a: number, b: number, style: string, text: string) => `Dialogue: ${layer},${ts(a)},${ts(b)},${style},,0,0,0,,${text}`;
  /** the letters one by one: each fades / pops in `step` ms after the one before, and fills in time with the singing */
  const letters = (text: string, dur: number, pop: 'rise' | 'burst', karaoke: boolean) => {
    const chars = [...clean(text)];
    const sung = chars.filter((ch) => ch.trim()).length || 1;
    const step = Math.min(45, (dur * 1000 * 0.35) / sung);
    const fill = Math.max(1, Math.round((dur * 100 * 0.85) / sung)); // centiseconds a letter
    let k = 0;
    return chars
      .map((ch) => {
        if (!ch.trim()) return ch;
        const d = Math.round(k++ * step);
        const inTag =
          pop === 'burst'
            ? `\\alpha&HFF&\\fscx30\\fscy30\\frz-10\\t(${d},${d + 130},\\alpha&H00&\\fscx128\\fscy128\\frz0)\\t(${d + 130},${d + 260},\\fscx100\\fscy100)`
            : `\\alpha&HFF&\\fscy40\\t(${d},${d + 200},\\alpha&H00&\\fscy100)`;
        return `{${inTag}${karaoke ? `\\kf${fill}` : ''}}${ch}`;
      })
      .join('');
  };
  const events: string[] = [];
  for (const l of lines) {
    const dur = Math.max(0.3, l.end - l.t);
    switch (l.effect) {
      case 'ZOOM_BURST':
        events.push(ev(0, l.t, l.end, 'Glow', `{\\pos(${c},${c})\\fad(500,200)\\blur9}${clean(l.text)}`));
        events.push(ev(1, l.t, l.end, 'Big', `{\\pos(${c},${c})\\fad(0,200)}${letters(l.text, dur, 'burst', true)}`));
        break;
      case 'STROBO_FLASH': {
        // yellow / white every 110 ms for the first second, then white
        let tags = `\\pos(${c},${c})\\fad(0,200)\\1c&H00E5FF&`;
        for (let k = 1; k <= 9; k++) tags += `\\t(${k * 110},${k * 110 + 1},\\1c&H${k % 2 ? 'FFFFFF' : '00E5FF'}&)`;
        events.push(ev(0, l.t, l.end, 'Glow', `{\\pos(${c},${c})\\fad(500,200)\\blur9}${clean(l.text)}`));
        events.push(ev(1, l.t, l.end, 'Big', `{${tags}}${letters(l.text, dur, 'burst', false)}`));
        break;
      }
      case 'SHAKE_HARD': {
        // shaking for the first second (short events at jumping positions), then still
        const until = Math.min(l.end, l.t + 1);
        let k = 0;
        for (let t = l.t; t < until - 0.01; t += 0.07, k++) {
          const dx = Math.round(Math.sin(k * 2.3) * 14);
          const dy = Math.round(Math.cos(k * 3.1) * 10);
          events.push(ev(1, t, Math.min(until, t + 0.07), 'Big', `{\\pos(${c + dx},${c + dy})}${clean(l.text)}`));
        }
        if (until < l.end) events.push(ev(1, until, l.end, 'Big', `{\\pos(${c},${c})\\fad(0,200)}${clean(l.text)}`));
        break;
      }
      default:
        events.push(ev(0, l.t, l.end, 'GlowLow', `{\\fad(200,200)\\blur7}${clean(l.text)}`));
        events.push(ev(1, l.t, l.end, 'Lyric', `{\\fad(0,200)}${letters(l.text, dur, 'rise', true)}`));
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
    // karaoke: the letters start white (Secondary) and fill warm yellow (Primary) as they are sung
    'Style: Lyric,Noto Sans CJK JP,44,&H0066E6FF,&H00FFFFFF,&H00502040,&H80000000,1,0,0,0,100,100,2,0,1,3.5,1.5,2,40,40,60,1',
    'Style: GlowLow,Noto Sans CJK JP,44,&HFF000000,&HFF000000,&H40B060FF,&HFF000000,1,0,0,0,100,100,2,0,1,10,0,2,40,40,60,1',
    'Style: Big,Noto Sans CJK JP,58,&H0066E6FF,&H00FFFFFF,&H00401860,&H90000000,1,0,0,0,100,100,3,0,1,5,2,5,30,30,30,1',
    'Style: Glow,Noto Sans CJK JP,58,&HFF000000,&HFF000000,&H30C050FF,&HFF000000,1,0,0,0,100,100,3,0,1,14,0,5,30,30,30,1',
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
