'use client';

import { audioCtx, masterBus, unlockAudio } from '@/lib/onboarding/audio';

/**
 * Voice clips through Web Audio (M-R239): decoded buffers on the one shared AudioContext under the "ambient" session,
 * so they keep quiet when the phone's silent switch is on (an <audio> element plays through it on iPhone) and never
 * fight the story's motions for the media session. One clip at a time; an analyser gives the loudness for the
 * speaker's lip flap. URLs: https:/relative paths, blob:, idb:<id> (the demo's recordings).
 */
export type Clip = { stop: () => void; done: Promise<void>; duration: number; level: () => number };

const cache = new Map<string, Promise<AudioBuffer | null>>();
let current: { src: AudioBufferSourceNode; stop: () => void } | null = null;

async function bytesOf(url: string): Promise<ArrayBuffer | null> {
  try {
    if (url.startsWith('idb:')) {
      const { getBlob } = await import('@/lib/api/idb');
      const b = await getBlob(url.slice(4));
      return b ? await b.arrayBuffer() : null;
    }
    const r = await fetch(url);
    return r.ok ? await r.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** fetch + decode once (kept for replays) */
export function loadClip(url: string): Promise<AudioBuffer | null> {
  let p = cache.get(url);
  if (!p) {
    const c = audioCtx();
    p = c
      ? bytesOf(url).then((b) => (b ? c.decodeAudioData(b).catch(() => null) : null))
      : Promise.resolve(null);
    cache.set(url, p);
    if (cache.size > 40) cache.delete(cache.keys().next().value!);
  }
  return p;
}

export function stopClip() {
  current?.stop();
  current = null;
}

/** whether Web Audio can play now (it needs a tap first on iOS; a suspended context plays nothing) */
export const canPlay = () => audioCtx()?.state === 'running';

/**
 * Plays one clip (stopping the one before). Null when it cannot be played (no Web Audio, not unlocked, a bad file):
 * the caller shows the words and moves the mouth without sound.
 */
export async function playClip(url: string, opts: { volume?: number } = {}): Promise<Clip | null> {
  const c = unlockAudio();
  if (!c) return null;
  const buf = await loadClip(url);
  if (!buf || c.state !== 'running') return null;
  stopClip();
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.value = opts.volume ?? 1;
  const an = c.createAnalyser();
  an.fftSize = 512;
  const wave = new Float32Array(an.fftSize);
  src.connect(gain);
  gain.connect(masterBus(c));
  gain.connect(an);
  let end: () => void = () => undefined;
  const done = new Promise<void>((r) => (end = r));
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      src.stop();
    } catch {
      /* not started */
    }
    end();
  };
  src.onended = () => {
    stopped = true;
    if (current?.src === src) current = null;
    end();
  };
  current = { src, stop };
  src.start();
  return {
    stop,
    done,
    duration: buf.duration,
    level: () => {
      an.getFloatTimeDomainData(wave);
      let sum = 0;
      for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
      return Math.min(1, Math.sqrt(sum / wave.length) * 6);
    },
  };
}

/**
 * R9 (client): the words and the voice start together — fetch and decode the clip first, at most `capMs` (then the
 * words show and the voice plays when it comes). true = decoded and ready to start at once.
 */
export const VOICE_WAIT_MS = 2500;
export async function readyClip(url: string | null | undefined, capMs = VOICE_WAIT_MS): Promise<boolean> {
  if (!url) return false;
  return Promise.race([loadClip(url).then((b) => !!b).catch(() => false), new Promise<boolean>((r) => setTimeout(() => r(false), capMs))]);
}
