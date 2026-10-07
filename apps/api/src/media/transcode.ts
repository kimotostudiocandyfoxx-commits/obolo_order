import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { MEDIA_POLICY } from '@obolo/shared';

/**
 * Upload processing (client decision 2026-10-06): every photo / video is re-encoded before it is
 * stored so storage and CDN delivery stay inside the ¥88 budget (docs/media.md).
 *  - video: shorter side ≤ 720 px, H.264 ~1.5 Mbps, AAC 96 kbps, faststart MP4, trimmed to the limit
 *  - poster: one WebP frame for lists (the video itself loads only when opened)
 *  - photo: WebP, longer side ≤ 1600 px, EXIF rotation applied and all metadata (GPS) dropped
 */

export function run(cmd: string, args: string[], timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d: Buffer) => (out += d.toString()));
    p.stderr.on('data', (d: Buffer) => (err = (err + d.toString()).slice(-2000)));
    const timer = setTimeout(() => p.kill('SIGKILL'), timeoutMs);
    p.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited ${code}: ${err.trim().split('\n').slice(-3).join(' | ')}`));
    });
  });
}

export interface VideoInfo {
  seconds: number;
  width: number;
  height: number;
  hasVideo: boolean;
}

export async function probe(file: string): Promise<VideoInfo> {
  const json = JSON.parse(await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], 30_000)) as {
    streams?: { codec_type?: string; width?: number; height?: number; tags?: { rotate?: string }; side_data_list?: { rotation?: number }[] }[];
    format?: { duration?: string };
  };
  const v = json.streams?.find((s) => s.codec_type === 'video');
  const rot = Math.abs(Number(v?.tags?.rotate ?? v?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0)) % 180;
  const [w, h] = [v?.width ?? 0, v?.height ?? 0];
  return { seconds: Number(json.format?.duration ?? 0), width: rot === 90 ? h : w, height: rot === 90 ? w : h, hasVideo: !!v };
}

/** Shorter side ≤ 720 px (never upscaled), even dimensions. */
const SCALE_720 = "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'";

export async function transcodeVideo(input: string, output: string, maxSeconds: number): Promise<void> {
  const p = MEDIA_POLICY.video;
  await run(
    'ffmpeg',
    [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', input,
      '-t', String(maxSeconds),
      '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', SCALE_720,
      '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
      '-crf', '26', '-maxrate', p.maxrate, '-bufsize', p.bufsize,
      '-c:a', 'aac', '-b:a', p.audioBitrate, '-ac', '2',
      '-movflags', '+faststart', '-map_metadata', '-1',
      output,
    ],
    300_000,
  );
}

/** First frame (just after the start) as a small WebP for lists. */
export async function videoPoster(video: string, output: string): Promise<Buffer> {
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', '0.3', '-i', video, '-frames:v', '1', '-f', 'image2', '-c:v', 'png', output], 60_000);
  return sharp(await readFile(output)).resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
}

export async function transcodePhoto(data: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const max = MEDIA_POLICY.photo.maxSide;
  const { data: out, info } = await sharp(data, { failOn: 'error' })
    .rotate() // apply EXIF orientation; metadata (GPS etc.) is not copied
    .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: MEDIA_POLICY.photo.quality })
    .toBuffer({ resolveWithObject: true });
  return { data: out, width: info.width, height: info.height };
}

/**
 * Mars posts are square (client decision 2026-10-07): centre-crop to a square, 720 px, H.264.
 */
export async function squareVideo(input: string, output: string, maxSeconds: number): Promise<void> {
  const p = MEDIA_POLICY.video;
  await run(
    'ffmpeg',
    [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', input,
      '-t', String(maxSeconds),
      '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', "crop='min(iw,ih)':'min(iw,ih)',scale='min(720,iw)':-2,setsar=1",
      '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
      '-crf', '26', '-maxrate', p.maxrate, '-bufsize', p.bufsize,
      '-c:a', 'aac', '-b:a', p.audioBitrate, '-ac', '2',
      '-movflags', '+faststart', '-map_metadata', '-1',
      output,
    ],
    300_000,
  );
}
