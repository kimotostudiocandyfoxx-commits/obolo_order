'use client';

import { useEffect, useRef, useState } from 'react';
import { masterBus, unlockAudio } from '@/lib/onboarding/audio';
import { playClip, type Clip } from '@/lib/voice/webVoice';

/**
 * R12: the sound behind an orb relic — ▶ / ❚❚, and its loudness (0–1) each frame so the orb's rings breathe with it.
 *  - 'element': a 📎 sound file (an object URL; it can be 30 minutes long, so it streams in an <audio>, routed through
 *    the shared AudioContext's analyser when that context runs; otherwise it just plays and the rings move on their own)
 *  - 'clip': a work's sound on the web (a song, a kororin, a radio show) through playClip, which gives its level
 * Only one orb sounds at a time (a new one stops the one before).
 */
type Source = { mode: 'element' | 'clip'; url: string | null };
let stopOther: (() => void) | null = null;

export function useOrbSound(get: () => Promise<Source>) {
  const [on, setOn] = useState(false);
  const [level, setLevel] = useState(0);
  const [progress, setProgress] = useState(0);
  /** a level comes from the sound itself (else the rings breathe by themselves) */
  const [measured, setMeasured] = useState(false);
  const el = useRef<HTMLAudioElement | null>(null);
  const an = useRef<AnalyserNode | null>(null);
  const clip = useRef<Clip | null>(null);
  const raf = useRef(0);
  const started = useRef(0);

  const stop = () => {
    cancelAnimationFrame(raf.current);
    el.current?.pause();
    clip.current?.stop();
    clip.current = null;
    setOn(false);
    setLevel(0);
    if (stopOther === stop) stopOther = null;
  };
  useEffect(() => () => stop(), []);

  const tick = () => {
    let lv = 0;
    if (clip.current) {
      lv = clip.current.level();
      setProgress(Math.min(1, (performance.now() - started.current) / 1000 / Math.max(0.1, clip.current.duration)));
    } else if (el.current) {
      if (an.current) {
        const buf = new Float32Array(an.current.fftSize);
        an.current.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        lv = Math.min(1, Math.sqrt(sum / buf.length) * 5);
      }
      const d = el.current.duration;
      if (d && Number.isFinite(d)) setProgress(el.current.currentTime / d);
    }
    setLevel((p) => p * 0.6 + lv * 0.4);
    raf.current = requestAnimationFrame(tick);
  };

  const toggle = async () => {
    if (on) return stop();
    stopOther?.();
    const ctx = unlockAudio();
    const src = await get();
    if (!src.url) return;
    if (src.mode === 'clip') {
      const c = await playClip(src.url);
      if (!c) return;
      clip.current = c;
      started.current = performance.now();
      setMeasured(true);
      void c.done.then(() => {
        if (clip.current === c) stop();
      });
    } else {
      if (!el.current) {
        const a = new Audio(src.url);
        a.preload = 'auto';
        a.onended = () => {
          setProgress(1);
          stop();
        };
        el.current = a;
        // the analyser only when the context runs (a routed element is silent in a suspended context)
        if (ctx) {
          await ctx.resume().catch(() => undefined);
          if (ctx.state === 'running') {
            try {
              const node = ctx.createMediaElementSource(a);
              const n = ctx.createAnalyser();
              n.fftSize = 512;
              node.connect(n);
              node.connect(masterBus(ctx));
              an.current = n;
              setMeasured(true);
            } catch {
              /* plays unrouted */
            }
          }
        }
      }
      await el.current.play().catch(() => undefined);
      if (el.current.paused) return;
    }
    setOn(true);
    stopOther = stop;
    raf.current = requestAnimationFrame(tick);
  };
  return { on, level, progress, measured, toggle };
}
