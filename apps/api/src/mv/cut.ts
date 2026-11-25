import { sceneTimes, type VideoCut, type VideoParams } from '@obolo/shared';
import type { ParallaxMove } from './parallax';
import type { MvMotion, MvPlan, MvTextEffect } from './plan';
import { storyToPlan, type StoryLyric, type StoryPlan } from './storyboard';

/**
 * R13 (docs/動画の作り方.md): the edit of a video from what it is made of (its pictures, in their order, and the
 * settings from its spell or the member's later words) — the same for the first render and every free re-render, so a
 * change of how it moves never needs a new picture. Pure (no ffmpeg here): render.ts makes the frames from the plan.
 */

/** how far the camera goes for each pace */
export const PACE: Record<VideoParams['pace'], number> = { slow: 0.5, normal: 1, fast: 1.5 };

/** the motion of shot j of a picture for a camera without depth (zoom / pan / still), or the fallback of a 2.5D one */
export function cameraMotion(camera: VideoParams['camera'], j: number, fallback: MvMotion): MvMotion {
  if (camera === 'zoom') return j % 2 ? 'zoom-out' : 'zoom-in';
  if (camera === 'pan') return j % 2 ? 'pan-right' : 'pan-left';
  if (camera === 'still') return 'hold';
  if (camera === 'fly') return j % 2 ? 'zoom-in' : 'tilt-up';
  return fallback;
}

/** the 2.5D move for the flying camera: up and forward, never sideways */
export const FLY_MOVES: ParallaxMove[] = ['crane-up', 'dolly-in', 'crane-down', 'dolly-in'];

/** does this camera move the pictures in 2.5D (with their depth)? */
export const usesDepth = (p: Pick<VideoParams, 'camera'>) => p.camera === 'parallax' || p.camera === 'fly';

/**
 * The edit plan: the pictures in their order (material j = the j-th picture shown), each cut on the bars into shots
 * (slow: every 4 bars, fast: every bar), the camera's motion per shot, a soft fade / white flash where a new picture
 * starts, and the lyric lines' effects (calm verses, big chorus — or all calm / all big as asked).
 */
export function cutPlan(cut: VideoCut, o: { seconds: number; bpm: number; lyrics: StoryLyric[]; note?: string }): { plan: MvPlan; shown: number[] } {
  const p = cut.params;
  const times = sceneTimes(cut, o.seconds);
  const story: StoryPlan = {
    note: o.note ?? '',
    style: '',
    scenes: times.map((t, j) => ({ dur: t.dur, tags: cut.scenes[t.k].tags ?? '', hero: true, motion: cameraMotion(p.camera, j, (['zoom-in', 'pan-left', 'zoom-out', 'pan-right'] as MvMotion[])[j % 4]), effect: 'NONE' as const })),
    lyrics: lyricEffects(o.lyrics, p.captionStyle),
  };
  // slow: half the cuts (a bar twice as long), fast: more
  const bpm = o.bpm ? o.bpm * (p.pace === 'slow' ? 0.5 : p.pace === 'fast' ? 1.5 : 1) : o.bpm;
  const plan = storyToPlan(story, bpm, o.lyrics);
  let j = 0;
  plan.segments = plan.segments.map((s, i) => {
    const before = plan.segments[i - 1];
    const fresh = i > 0 && before && before.m !== s.m;
    j = fresh || i === 0 ? 0 : j + 1;
    let motion = s.motion;
    // a camera of its own: zoom / pan / still / fly over every shot (2.5D pictures move by their depth instead)
    if (p.camera !== 'parallax') motion = cameraMotion(p.camera, j + s.m, s.motion);
    // slow and calm: no punches on the beat
    if (p.pace === 'slow' && (motion === 'pulse' || motion === 'face')) motion = 'zoom-in';
    return { ...s, motion, chorus: p.pace === 'slow' ? false : s.chorus, pace: PACE[p.pace], enter: fresh && p.transition !== 'cut' ? (p.transition === 'flash' ? 'flash' : 'fade') : undefined };
  });
  return { plan, shown: times.map((t) => t.k) };
}

/** each lyric line's effect: auto = calm verses, the first chorus line bursting, the next ones flashing */
export function lyricEffects(lyrics: { chorus: boolean }[], style: VideoParams['captionStyle']): MvTextEffect[] {
  let first = true;
  return lyrics.map((l) => {
    if (style === 'soft') return 'MINIMAL_CHILL';
    if (style === 'big') return 'ZOOM_BURST';
    if (!l.chorus) return 'MINIMAL_CHILL';
    const e: MvTextEffect = first ? 'ZOOM_BURST' : 'STROBO_FLASH';
    first = false;
    return e;
  });
}

/** the song's lyric lines inside the window, on the video's own clock */
export function windowLyrics<L extends { t: number; end: number }>(lines: L[], start: number, seconds: number): L[] {
  return lines
    .filter((l) => l.end > start + 0.2 && l.t < start + seconds - 0.3)
    .map((l) => ({ ...l, t: Math.max(0, l.t - start), end: Math.min(seconds, l.end - start) }));
}
