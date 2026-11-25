import { spellFrom, VIDEO_DEFAULTS, videoEdit, videoParams, withSong, type VideoCut } from '@obolo/shared';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { cameraMotion, cutPlan, lyricEffects, PACE, usesDepth, windowLyrics } from './cut';
import { renderMv } from './render';

const SONG = { id: '11111111-1111-4111-8111-111111111111', title: '夏の海のポップ' };
const cutOf = (said: string, n = 4): VideoCut => {
  const params = videoParams(withSong(spellFrom('video', said), SONG));
  return { params, order: Array.from({ length: n }, (_, k) => k), scenes: Array.from({ length: n }, (_, k) => ({ url: `https://x/${k}.webp`, dur: 1, tags: `scene ${k}` })) };
};
const lyrics = [
  { t: 0.5, text: 'なつのうみ', chorus: false },
  { t: 8, text: 'サビだよ', chorus: true },
];

describe('R13: the spell → the edit plan (pictures that move)', () => {
  it('the default spell: 2.5D on every picture, a soft fade where a new picture starts', () => {
    const cut = cutOf('夏の海');
    expect(usesDepth(cut.params)).toBe(true);
    const { plan, shown } = cutPlan(cut, { seconds: 16, bpm: 120, lyrics });
    expect(shown).toEqual([0, 1, 2, 3]);
    expect(plan.segments.reduce((a, s) => a + s.dur, 0)).toBeCloseTo(16, 5);
    const starts = plan.segments.filter((s, i) => i > 0 && plan.segments[i - 1].m !== s.m);
    expect(starts.length).toBeGreaterThanOrEqual(3);
    expect(starts.every((s) => s.enter === 'fade')).toBe(true);
    expect(plan.segments[0].enter).toBeUndefined();
  });
  it('横に流れる = pans; ゆっくりズーム = zooms at half the speed; パッと = hard cuts; ピカッと = white flashes', () => {
    const pan = cutPlan(cutOf('横に流れる'), { seconds: 16, bpm: 120, lyrics }).plan;
    expect(pan.segments.every((s) => s.motion === 'pan-left' || s.motion === 'pan-right')).toBe(true);
    expect(usesDepth(cutOf('横に流れる').params)).toBe(false);
    const zoom = cutPlan(cutOf('ゆっくりズーム'), { seconds: 16, bpm: 120, lyrics }).plan;
    expect(zoom.segments.every((s) => s.motion === 'zoom-in' || s.motion === 'zoom-out')).toBe(true);
    expect(zoom.segments.every((s) => s.pace === PACE.slow)).toBe(true);
    const cut = cutPlan(cutOf('パッと切りかえ'), { seconds: 16, bpm: 120, lyrics }).plan;
    expect(cut.segments.some((s) => s.enter)).toBe(false);
    const flash = cutPlan(cutOf('ピカッと'), { seconds: 16, bpm: 120, lyrics }).plan;
    expect(flash.segments.filter((s) => s.enter).every((s) => s.enter === 'flash')).toBe(true);
    expect(cameraMotion('still', 3, 'zoom-in')).toBe('hold');
  });
  it('slow = fewer cuts and no punches on the beat; the order and a cut scene are followed', () => {
    const base = cutOf('夏の海');
    const fast = cutPlan({ ...base, params: { ...base.params, pace: 'fast' } }, { seconds: 24, bpm: 120, lyrics }).plan.segments.length;
    const slow = cutPlan({ ...base, params: { ...base.params, pace: 'slow' } }, { seconds: 24, bpm: 120, lyrics }).plan;
    expect(slow.segments.length).toBeLessThan(fast);
    expect(slow.segments.some((s) => s.motion === 'pulse' || s.chorus)).toBe(false);
    const r = cutPlan({ ...base, order: [3, 1] }, { seconds: 12, bpm: 120, lyrics });
    expect(r.shown).toEqual([3, 1]);
  });
  it('the lyric lines: inside the window on the video’s clock; calm / big as asked', () => {
    const lines = [
      { t: 2, end: 5, text: 'a', chorus: false },
      { t: 40, end: 44, text: 'b', chorus: true },
      { t: 70, end: 74, text: 'c', chorus: true },
    ];
    expect(windowLyrics(lines, 39, 30)).toEqual([{ t: 1, end: 5, text: 'b', chorus: true }]);
    expect(lyricEffects(lines, 'auto')).toEqual(['MINIMAL_CHILL', 'ZOOM_BURST', 'STROBO_FLASH']);
    expect(lyricEffects(lines, 'soft')).toEqual(['MINIMAL_CHILL', 'MINIMAL_CHILL', 'MINIMAL_CHILL']);
    expect(lyricEffects(lines, 'big')).toEqual(['ZOOM_BURST', 'ZOOM_BURST', 'ZOOM_BURST']);
  });
  it('「カメラをもっとゆっくり」 after it is made: the same pictures, a new plan (no picture painted)', () => {
    const cut = cutOf('夏の海');
    const e = videoEdit(cut, 'カメラをもっとゆっくり');
    expect(e?.kind).toBe('free');
    if (e?.kind !== 'free') return;
    const after = cutPlan({ ...cut, params: e.params, order: e.order }, { seconds: 16, bpm: 120, lyrics });
    expect(after.shown).toEqual([0, 1, 2, 3]);
    expect(after.plan.segments.every((s) => s.pace === 0.5)).toBe(true);
  });
});

// --- the user path never calls a video-generation model -------------------------------------------------------------

/** names of video-generation models / endpoints (text or image to video) */
const VIDEO_MODEL = /videoInference|seedance|\bveo[-_ ]?\d|\bkling\b|image[-_ ]?to[-_ ]?video|text[-_ ]?to[-_ ]?video|img2vid|\bi2v\b|\bt2v\b|runwayml|gen-?3|dream ?machine|hailuo|wan-?2\.\d|ltx-?video|stable[-_ ]video|hunyuan[-_ ]?video|cogvideo|animatediff|\bsora\b/i;
/** a comment line (a note that some story film was made by hand with a tool is not a call) */
const COMMENT = /^\s*(\/\/|\*|\/\*)/;
async function sources(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', 'dist', '.next', 'scripts'].includes(e.name)) out.push(...(await sources(p)));
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('R13: no video-generation model in the user path', () => {
  it('nothing the API or the app runs names one (dev-only art scripts under scripts/ are not deployed)', async () => {
    const roots = ['src', '../web/lib', '../web/components', '../web/app', '../../packages/shared/src', '../../packages/ai/src'];
    const hits: string[] = [];
    for (const r of roots) for (const f of await sources(join(__dirname, '..', '..', r))) for (const [i, l] of (await readFile(f, 'utf8')).split('\n').entries()) if (VIDEO_MODEL.test(l) && !COMMENT.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 120)}`);
    expect(hits).toEqual([]);
  });

  const hasFfmpeg = (() => {
    try {
      execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();
  const dirs: string[] = [];
  afterAll(async () => {
    for (const d of dirs) await rm(d, { recursive: true, force: true });
  });
  it.skipIf(!hasFfmpeg)('a re-render is ffmpeg on the kept pictures only: no network call at all', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'obolo-cut-test-'));
    dirs.push(dir);
    const files: string[] = [];
    for (const [k, c] of ['#3a7bd5', '#f6a04d', '#7fd6c2'].entries()) {
      const f = join(dir, `p${k}.jpg`);
      await sharp({ create: { width: 256, height: 256, channels: 3, background: c } }).jpeg().toFile(f);
      files.push(f);
    }
    const depth = join(dir, 'd.png');
    await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient></defs><rect width="64" height="64" fill="url(#g)"/></svg>')).png().toFile(depth);
    const audio = join(dir, 'a.m4a');
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=8', '-c:a', 'aac', audio]);
    const cut = cutOf('夏の海', 3);
    const e = videoEdit(cut, 'カメラをもっとゆっくり、モノクロにして');
    if (e?.kind !== 'free') throw new Error('not free');
    const { plan, shown } = cutPlan({ ...cut, params: e.params, order: e.order }, { seconds: 4, bpm: 120, lyrics: [] });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const out = await renderMv({
      dir,
      materials: shown.map((k) => ({ kind: 'photo' as const, file: files[k], depth, parallax: { move: 'dolly-in' as const, fx: 0.5, fy: 0.5, strength: 1, focus: 128 } })),
      plan,
      audio,
      seconds: 4,
      bpm: 120,
      keyArtist: { draw: async () => null } as never,
      painted: true,
      audioStart: 2,
      grade: e.params.grade,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    const info = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'csv=p=0', out.video]).toString();
    expect(info).toContain('720,720');
    expect(info).toContain('audio');
    await writeFile(join(dir, 'ok'), '1');
  }, 120_000);

  it('the default spell keeps the defaults the docs promise', () => {
    expect(videoParams(spellFrom('video', 'x'))).toMatchObject({ ...VIDEO_DEFAULTS, songId: null });
  });
});
