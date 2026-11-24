'use client';

import { audioCtx, masterBus, unlockAudio } from '@/lib/onboarding/audio';
import { loadClip } from '@/lib/voice/webVoice';
import { clubGain } from './club';
import { decodable, playBuffer, popSound as pop } from './saturnSoundCore';

/**
 * M-R275: Saturn's sounds on the app's one AudioContext (lib/onboarding/audio.ts: created once, resumed by the first
 * tap anywhere — AudioUnlock — or by 〔▶ 全部流す〕). Voices are fetched and decoded ahead (preloadVoice, as the balls
 * come onto the record); a pop plays one only if it is ready — else the caller falls back to the <audio> player.
 */
export const getAC = () => unlockAudio();

const ready = new Map<string, AudioBuffer>();

export function preloadVoice(url: string | null | undefined) {
  if (!decodable(url) || ready.has(url) || !audioCtx()) return;
  void loadClip(url).then((b) => {
    if (b) ready.set(url, b);
    if (ready.size > 60) ready.delete(ready.keys().next().value!);
  });
}

export function popSound() {
  const c = audioCtx();
  if (!c || c.state !== 'running') return;
  pop(c, masterBus(c));
}

/** the maker's voice through Web Audio; null when it is not loaded yet or there is no running context (fall back) */
export function playVoice(url: string | null | undefined): number | null {
  const c = audioCtx();
  const buf = decodable(url) ? ready.get(url) : undefined;
  if (!c || !buf || c.state !== 'running') return null;
  return playBuffer(c, buf, masterBus(c), clubGain());
}
