'use client';

import { unlockAudio } from '@/lib/onboarding/audio';
import { levelOf } from './core';

/**
 * How loud the mic is now (0..1). Nothing is played: the analyser hangs off the source and goes nowhere. Null where Web
 * Audio is missing — the caller then shows a plain "listening" without a level.
 *
 * `own` (iPhone / iPad — R21 playtest, client 2026-11-28): the level is read on a context of its own, made after the
 * stream is open and closed with the take. The page's one context (the story's music, the voices) was made long before
 * at the output's rate; when the capture starts iOS moves the hardware to the mic's rate and that context can stall
 * ("interrupted": the level is then no proof of anything, and a silent take was sent to be heard) or crackle. A new
 * one starts at the rate the hardware has now. If it does not run (no tap to start it), the page's context is used
 * after all. Elsewhere the page's context is used, as before (resumed here: call it from the tap).
 */
export type MicMeter = {
  level: () => number;
  live: () => boolean;
  close: () => void;
  /** whether the level was ever read on a running context during this take */
  everLive: () => boolean;
};

type Ctor = typeof AudioContext;
type Tap = { ctx: AudioContext; an: AnalyserNode; src: MediaStreamAudioSourceNode; own: boolean };

function ownContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const C: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!C) return null;
  try {
    const c = new C();
    void c.resume().catch(() => undefined);
    return c;
  } catch {
    return null;
  }
}

function tap(ctx: AudioContext, stream: MediaStream, own: boolean): Tap | null {
  try {
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    an.smoothingTimeConstant = 0.2;
    src.connect(an);
    return { ctx, an, src, own };
  } catch {
    if (own) void ctx.close().catch(() => undefined);
    return null;
  }
}

/** an own context that has not run after this long gives way to the page's */
const OWN_GRACE_MS = 600;

export function micMeter(stream: MediaStream, o: { own?: boolean } = {}): MicMeter | null {
  const born = Date.now();
  const ownCtx = o.own ? ownContext() : null;
  let cur: Tap | null = ownCtx ? tap(ownCtx, stream, true) : null;
  let triedShared = false;
  const shared = () => {
    triedShared = true;
    const c = unlockAudio();
    return c ? tap(c, stream, false) : null;
  };
  if (!cur) cur = shared();
  if (!cur) return null;
  const buf = new Float32Array(1024);
  let ever = false;
  const drop = (t: Tap) => {
    try {
      t.src.disconnect();
    } catch {
      /* gone already */
    }
    if (t.own) void t.ctx.close().catch(() => undefined);
  };
  /** the tap to read now: the own context unless it never ran in its grace time */
  const now = (): Tap => {
    const t = cur!;
    if (t.own && !ever && t.ctx.state !== 'running' && !triedShared && Date.now() - born > OWN_GRACE_MS) {
      const s = shared();
      if (s) {
        drop(t);
        cur = s;
      }
    }
    return cur!;
  };
  return {
    /** false while the context is not running: the level is then no proof of silence */
    live: () => {
      if (!cur) return false;
      const on = now().ctx.state === 'running';
      if (on) ever = true;
      return on;
    },
    level: () => {
      if (!cur) return 0;
      const t = now();
      // a context the phone suspended (the page was hidden) reads zeros: wake it
      if (t.ctx.state !== 'running') void t.ctx.resume().catch(() => undefined);
      t.an.getFloatTimeDomainData(buf);
      return levelOf(buf);
    },
    everLive: () => ever,
    close: () => {
      if (cur) drop(cur);
      cur = null;
    },
  };
}
