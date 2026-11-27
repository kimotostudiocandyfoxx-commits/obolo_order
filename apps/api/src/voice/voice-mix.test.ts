import { VOICE_MOODS, VOICE_SOUND_PARTS, VOICE_TUNE_DEFAULT } from '@obolo/shared';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUTOTUNE, autotuneArgs, cleanFilter, cleanVoice, cutFilter, hearArgs, heardVoice, MIX, mixArgs, mixPlan, mp3Seconds, NoVoiceError, prepareArgs, shapeArgs, shapeFilter, SILENCE_CUT, VOICE_SOUNDS_DIR } from './voice-mix';

describe('the ダチ voice message made ready (client 2026-11-27, sample K)', () => {
  it('a. clean: rumble out at 100 Hz, the strong noise removal that follows the noise, the gate — the approved chain', () => {
    expect(cleanFilter()).toBe('highpass=f=100,afftdn=nr=24:nf=-45:tn=1,agate=threshold=0.012:ratio=2:attack=10:release=250');
  });

  it('b. 「間をつめる」: the silence before the first word goes, a pause over 0.28 s becomes 0.14 s (−40 dB) — on by default', () => {
    expect(cutFilter()).toBe('silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.05:stop_periods=-1:stop_duration=0.28:stop_threshold=-40dB:stop_silence=0.14');
    expect(SILENCE_CUT.on).toBe(true);
    expect(VOICE_TUNE_DEFAULT.cut).toBe(true);
  });

  it('one ffmpeg run gives the words’ file (clean, UNCUT, as it was said) and the voice for the next steps (cut)', () => {
    const a = prepareArgs('/tmp/x/in', '/tmp/x/heard.mp3', '/tmp/x/voice.wav');
    // at most a minute of the recording, read from a file
    expect(a.slice(0, 8)).toEqual(['-hide_banner', '-loglevel', 'error', '-y', '-t', '62', '-i', '/tmp/x/in']);
    const graph = a[a.indexOf('-filter_complex') + 1];
    expect(graph).toBe(`[0:a]${cleanFilter()},aresample=44100,aformat=sample_fmts=s16:channel_layouts=mono,asplit=2[h][v0];[v0]${cutFilter()}[v]`);
    // the cut is only on the voice's branch: the words are heard from the whole take
    expect(graph.split(';')[0]).not.toContain('silenceremove');
    expect(a.slice(a.indexOf('[h]'))).toEqual(['[h]', '-b:a', '96k', '-map_metadata', '-1', '-f', 'mp3', '/tmp/x/heard.mp3', '-map', '[v]', '-c:a', 'pcm_s16le', '-f', 'wav', '/tmp/x/voice.wav']);
    // 「間はそのまま」: nothing is cut
    const whole = prepareArgs('in', 'h', 'v', false);
    expect(whole[whole.indexOf('-filter_complex') + 1]).toMatch(/\[v0\]anull\[v\]$/);
  });

  it('「きれい」: the take is only heard as words — step a alone (clean, whole, as it was said), no file beside it', () => {
    const a = hearArgs('/tmp/x/in');
    expect(a.slice(0, 8)).toEqual(['-hide_banner', '-loglevel', 'error', '-y', '-t', '62', '-i', '/tmp/x/in']);
    expect(a[a.indexOf('-af') + 1]).toBe(`${cleanFilter()},aresample=44100`);
    expect(a.join(' ')).not.toMatch(/silenceremove|rubberband|atempo|asetrate/);
    expect(a.at(-1)).toBe('pipe:1');
  });

  it('c. the autotune: the script, the two files, the strength inside 0…1', () => {
    expect(autotuneArgs('a.wav', 'b.wav', 0.6)).toEqual([AUTOTUNE.script, 'a.wav', 'b.wav', '0.6']);
    expect(autotuneArgs('a.wav', 'b.wav', 7, 's.py')).toEqual(['s.py', 'a.wav', 'b.wav', '1']);
    expect(existsSync(AUTOTUNE.script)).toBe(true);
    // the approved rule is in the script: toward the nearest semitone (A = 440) by the strength
    const py = readFileSync(AUTOTUNE.script, 'utf8');
    expect(py).toContain('"To Manipulation", 0.01, 75, 500');
    expect(py).toContain('st = 12 * math.log2(f / 440)');
    expect(py).toContain('440 * 2 ** ((st + (round(st) - st) * strength) / 12)');
    expect(py).toContain('"Get resynthesis (overlap-add)"');
  });

  it('d. the default: 1.8× and +2 semitones in one rubberband step (formants not kept), then one loudness', () => {
    expect(shapeFilter(VOICE_TUNE_DEFAULT)).toBe('rubberband=tempo=1.8:pitch=1.122462,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100');
    // a member who kept the morning's +6 of their own still gets it
    expect(shapeFilter({ key: 6, speed: 1.8 })).toBe('rubberband=tempo=1.8:pitch=1.414214,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100');
    expect(shapeFilter(VOICE_TUNE_DEFAULT)).not.toContain('formant');
    const a = shapeArgs('/tmp/x/voice.wav', VOICE_TUNE_DEFAULT);
    expect(a[a.indexOf('-af') + 1]).toBe(shapeFilter(VOICE_TUNE_DEFAULT));
    expect(a.join(' ')).toContain('-ac 1 -ar 44100 -b:a 96k');
    expect(a.at(-1)).toBe('pipe:1');
    expect(mp3Seconds(120_000)).toBe(10);
  });

  it('a member’s own settings: the key and the speed in the chain; the voice as recorded is only made one loudness', () => {
    expect(shapeFilter({ key: -6, speed: 1 })).toBe('rubberband=tempo=1:pitch=0.707107,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100');
    expect(shapeFilter({ key: 8, speed: 2 })).toContain('rubberband=tempo=2:pitch=1.587401,');
    expect(shapeFilter({ key: 0, speed: 1 })).toBe('loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100');
  });

  it('an ffmpeg without rubberband: the same speed and key by asetrate + atempo', () => {
    // +2 semitones by the sample rate makes it 1.122× faster too: atempo adds the rest of the 1.8×
    expect(shapeFilter(VOICE_TUNE_DEFAULT, false)).toBe('asetrate=49501,aresample=44100,atempo=1.603618,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100');
    expect(shapeFilter({ key: 6, speed: 1.8 }, false)).toBe('asetrate=62367,aresample=44100,atempo=1.272792,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100');
    // one atempo step is 0.5–2.0: more is two steps (−6 semitones at 2× = 2.83×)
    expect(shapeFilter({ key: -6, speed: 2 }, false)).toContain('asetrate=31183,aresample=44100,atempo=2,atempo=1.414213,');
    expect(shapeFilter({ key: 0, speed: 1 }, false)).toBe(shapeFilter({ key: 0, speed: 1 }));
    for (const key of [-6, 0, 6, 8])
      for (const speed of [1, 1.8, 2]) {
        const steps = [...shapeFilter({ key, speed }, false).matchAll(/atempo=([\d.]+)/g)].map((m) => Number(m[1]));
        expect(steps.every((t) => t >= 0.5 && t <= 2)).toBe(true);
        expect(steps.reduce((a, b) => a * b, 1) * 2 ** (key / 12)).toBeCloseTo(speed, 4);
      }
  });
});

/** the real tools, when this machine has them (CI and the API image do; nothing is called over the network) */
const has = (cmd: string, args: string[]) => spawnSync(cmd, args, { encoding: 'utf8' }).status === 0;
const FFMPEG = has('ffmpeg', ['-version']);
const PARSELMOUTH = has(AUTOTUNE.python, ['-c', 'import parselmouth']);
/** a made-up take: `voiced` seconds of a wobbling tone, a second of silence, the tone again — or silence alone */
const take = (voiced: boolean) =>
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', voiced ? "aevalsrc='0.4*sin(2*PI*(215+12*sin(2*PI*3*t))*t)*(lt(mod(t,3),2))':s=44100:d=6" : 'anullsrc=r=44100:cl=mono', '-t', '6', '-f', 'wav', 'pipe:1'], { maxBuffer: 1 << 26 }).stdout;

describe.skipIf(!FFMPEG)('the chain run for real (ffmpeg on this machine)', () => {
  it('a take of 6 s with a second of silence in each 3: cut short, 1.8× faster — and the words’ file is the whole take', async () => {
    const r = await cleanVoice(take(true), { ...VOICE_TUNE_DEFAULT, tune: 0 });
    // 4 s of voice + the short pauses kept, ÷ 1.8
    expect(r.seconds).toBeGreaterThan(1.8);
    expect(r.seconds).toBeLessThan(3);
    expect(mp3Seconds(r.heard.length)).toBeGreaterThan(5.8);
    expect(r.made.autotune).toBe(false);
    // 「間はそのまま」: the whole 6 s, ÷ 1.8
    const whole = await cleanVoice(take(true), { ...VOICE_TUNE_DEFAULT, tune: 0, cut: false });
    expect(whole.seconds).toBeGreaterThan(3.1);
    expect(whole.seconds).toBeLessThan(3.6);
  }, 30_000);

  it('「きれい」: the take heard whole, at the speed it was said', async () => {
    expect(mp3Seconds((await heardVoice(take(true))).length)).toBeGreaterThan(5.8);
  }, 30_000);

  it('a take that is all silence is no message (the web says 「もう少し長く、話してね」)', async () => {
    await expect(cleanVoice(take(false))).rejects.toBeInstanceOf(NoVoiceError);
  }, 30_000);

  it('the autotune failing or late never loses the message: the chain goes on without it', async () => {
    const missing = await cleanVoice(take(true), VOICE_TUNE_DEFAULT, { python: '/no/such/python' });
    expect(missing.made.autotune).toBe(false);
    expect(missing.seconds).toBeGreaterThan(1.8);
    // a "python" that never answers is stopped at the time limit
    const t0 = Date.now();
    const late = await cleanVoice(take(true), VOICE_TUNE_DEFAULT, { python: 'sleep', timeoutMs: 300 });
    expect(late.made.autotune).toBe(false);
    expect(late.seconds).toBeGreaterThan(1.8);
    expect(Date.now() - t0).toBeLessThan(8000);
  }, 30_000);

  it.skipIf(!PARSELMOUTH)('with praat-parselmouth: the autotune runs, and the voice is as long as without it', async () => {
    const tuned = await cleanVoice(take(true), VOICE_TUNE_DEFAULT);
    const plain = await cleanVoice(take(true), { ...VOICE_TUNE_DEFAULT, tune: 0 });
    expect(tuned.made).toEqual({ autotune: true, shape: 'rubberband' });
    expect(Math.abs(tuned.seconds - plain.seconds)).toBeLessThan(0.15);
  }, 30_000);
});

describe('the mix: a quiet sound under the voice', () => {
  it('an accent mood: one accent as it starts, one just before the voice ends, both far under the voice', () => {
    const p = mixPlan(10, 'ureshii');
    expect(p.parts).toEqual([
      { file: 'ureshii-a.mp3', loop: false },
      { file: 'ureshii-z.mp3', loop: false },
    ]);
    // the voice comes in 250 ms after the sound and is the key of the ducking
    expect(p.filter).toContain('[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono,adelay=250:all=1,apad=whole_dur=12.05,asplit=2[voice][key]');
    expect(p.filter).toContain('[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono,volume=-20dB[s1]');
    // the ending accent: 0.15 s before the voice ends (0.25 + 10 − 0.15)
    expect(p.filter).toContain('volume=-20dB,adelay=10100:all=1[s2]');
    expect(p.filter).toContain('[s1][s2]amix=inputs=2:normalize=0:duration=longest,');
    expect(p.total).toBe(12.05);
  });

  it('a bed mood: looped, −24 dB, as long as the voice plus the tail, fading over the last 1.5 s', () => {
    const p = mixPlan(20, 'shinmiri');
    expect(p.parts).toEqual([{ file: 'shinmiri-bed.mp3', loop: true }]);
    expect(p.total).toBe(22.05);
    expect(p.filter).toContain('volume=-24dB,atrim=0:22.05,afade=t=in:st=0:d=0.3,afade=t=out:st=20.55:d=1.5[s1]');
    const a = mixArgs('/tmp/v/in', '/lib', p);
    expect(a.join(' ')).toContain('-i /tmp/v/in -stream_loop -1 -i /lib/shinmiri-bed.mp3 -filter_complex');
    expect(a.join(' ')).toContain('-map [out] -t 22.05');
  });

  it('ducked further while the voice sounds, added without touching the voice’s level, under a limiter', () => {
    for (const m of VOICE_MOODS) {
      const f = mixPlan(8, m).filter;
      expect(f).toContain('[sound][key]sidechaincompress=threshold=0.05:ratio=2.5:attack=20:release=400[ducked]');
      expect(f).toContain('[voice][ducked]amix=inputs=2:normalize=0:duration=first,');
      expect(f).toMatch(/alimiter=limit=0\.84:level=0\[out\]$/);
      // never louder than the client's line: −24 dB for a bed, −20 dB for a short accent
      for (const db of [...f.matchAll(/volume=(-?[\d.]+)dB/g)].map((x) => Number(x[1]))) expect(db).toBeLessThanOrEqual(VOICE_SOUND_PARTS[m].bed ? MIX.bedDb : MIX.accentDb);
    }
  });

  it('the weakest うれしい: one bell as it starts, 6 dB lower, nothing at the end', () => {
    const p = mixPlan(10, 'ureshii', true);
    expect(p.parts).toEqual([{ file: 'ureshii-a.mp3', loop: false }]);
    expect(p.filter).toContain('volume=-26dB[s1]');
    expect(p.filter).not.toContain('amix=inputs=2:normalize=0:duration=longest');
    expect(mixPlan(10, 'otsukare', true).filter).toContain('volume=-30dB,');
  });

  it('every part a plan names is in the committed library', () => {
    for (const m of VOICE_MOODS) for (const part of mixPlan(5, m).parts) expect(existsSync(join(VOICE_SOUNDS_DIR, part.file)), part.file).toBe(true);
  });
});
