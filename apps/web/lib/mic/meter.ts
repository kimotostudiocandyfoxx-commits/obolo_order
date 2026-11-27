'use client';

import { unlockAudio } from '@/lib/onboarding/audio';
import { levelOf } from './core';

/**
 * How loud the mic is now (0..1), read from the stream on the page's one AudioContext (resumed here: call it from the
 * tap). Nothing is played: the analyser hangs off the source and goes nowhere. Null where Web Audio is missing — the
 * caller then shows a plain "listening" without a level.
 */
export type MicMeter = { level: () => number; live: () => boolean; close: () => void };
export function micMeter(stream: MediaStream): MicMeter | null {
  const ctx = unlockAudio();
  if (!ctx) return null;
  try {
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    an.smoothingTimeConstant = 0.2;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    return {
      /** false while the context is not running: the level is then no proof of silence */
      live: () => ctx.state === 'running',
      level: () => {
        // a context the phone suspended (the page was hidden) reads zeros: wake it
        if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
        an.getFloatTimeDomainData(buf);
        return levelOf(buf);
      },
      close: () => {
        try {
          src.disconnect();
        } catch {
          /* gone already */
        }
      },
    };
  } catch {
    return null;
  }
}
