'use client';

import { useSyncExternalStore } from 'react';

/**
 * Client 2026-11-27 (the ダチ voice message trial): the one who gets a voice message can turn its quiet sound off —
 * the small ♪ by the bubble → 〔おとをけす〕 plays the voice alone (the clean file kept beside the mix). The choice is
 * this device's, for every voice message, until 〔おとをつける〕 (most people find BGM noisy: once is enough to say so).
 */
const KEY = 'obolo.voice.soundOff';
/** PROVISIONAL wording (the story chat confirms) */
export const SOUND_PREF_WORDS = { off: 'おとをけす', on: 'おとをつける', label: 'おと' } as const;

let off: boolean | null = null;
const subs = new Set<() => void>();

export function soundOff(): boolean {
  if (off === null) {
    try {
      off = typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
    } catch {
      off = false;
    }
  }
  return off;
}

export function setSoundOff(v: boolean) {
  off = v;
  try {
    if (v) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: for this visit only */
  }
  subs.forEach((f) => f());
}

/** which file of a voice message plays: the voice alone when the sound is off and there is one */
export const voiceUrlFor = (v: { url: string | null; plainUrl?: string | null }, isOff: boolean = soundOff()): string | null => (isOff && v.plainUrl ? v.plainUrl : v.url);

export function useSoundOff(): boolean {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    soundOff,
    () => false,
  );
}
