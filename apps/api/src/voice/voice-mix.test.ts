import { VOICE_MOODS, VOICE_SOUND_PARTS } from '@obolo/shared';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanArgs, cleanFilter, MIX, mixArgs, mixPlan, mp3Seconds, VOICE_SOUNDS_DIR } from './voice-mix';

describe('the ダチ voice message’s clean-up (client 2026-11-27): ffmpeg alone', () => {
  it('rumble out, a mild denoise, 1.2× with the pitch kept (atempo), one loudness — in that order', () => {
    const f = cleanFilter();
    expect(f).toBe('highpass=f=90,afftdn=nr=10:nf=-40,atempo=1.2,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100');
    // the pitch is kept: the tempo filter, never a sample-rate trick
    expect(f).not.toMatch(/asetrate|rubberband/);
    expect(cleanFilter(1)).toContain('atempo=1,');
  });

  it('reads the recording from a file, at most a minute of it, and writes mono MP3 at a constant rate', () => {
    const a = cleanArgs('/tmp/x/in');
    expect(a.slice(0, 7)).toEqual(['-hide_banner', '-loglevel', 'error', '-i', '/tmp/x/in', '-t', '62']);
    expect(a[a.indexOf('-af') + 1]).toBe(cleanFilter());
    expect(a.join(' ')).toContain('-ac 1 -ar 44100 -b:a 96k');
    expect(a.at(-1)).toBe('pipe:1');
    expect(mp3Seconds(120_000)).toBe(10);
  });
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
