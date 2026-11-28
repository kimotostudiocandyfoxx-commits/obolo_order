'use client';

import { micBusy, micSession } from '@/lib/onboarding/audio';

/**
 * One microphone stream for the whole page (client 2026-11-24, iPad R7: "the mic is asked for on every visit"): a
 * press reuses the stream that is open, so it does not ask again.
 *
 * Client 2026-11-27 (phones: 「マイクが反応しないことが多い」) — what the first version got wrong, and what it does now:
 * - it kept the stream alive for the whole visit, its track only switched off. On iPhone a stream that was interrupted
 *   (a call, another app, the screen locked, the browser's own speech recognition taking the mic) stays "live" but
 *   muted for good: the next recording was silent. Now a stream is reused only when its track is live AND not muted,
 *   it is closed MIC_IDLE_MS after the last recording, when the page is hidden, and before the recogniser starts.
 * - the sound session stayed "ambient" (play only): now "play-and-record" while the mic is open (lib/onboarding/audio).
 * - a reload asks again unless the phone's own setting allows it (the mic check says where).
 */
const CONSTRAINTS: MediaStreamConstraints = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
/** how long the quiet stream is kept for the next press (a second take, a slip of the finger) */
export const MIC_IDLE_MS = 15000;

let shared: Promise<MediaStream> | null = null;
let armed = false;
let idle: ReturnType<typeof setTimeout> | null = null;
/** how many recordings hold the stream now */
let holders = 0;

/** a stream that can really be recorded from: a live track that the system has not muted */
export function usable(s: { getAudioTracks(): { readyState: string; muted?: boolean }[] }): boolean {
  const t = s.getAudioTracks();
  return t.length > 0 && t.every((x) => x.readyState === 'live' && !x.muted);
}

function arm() {
  if (armed || typeof window === 'undefined') return;
  armed = true;
  window.addEventListener('pagehide', closeMic);
  // the page left the screen (another app, the lock screen) with the mic only kept for later: iOS cuts it there — let
  // it go, open it fresh next time. A recording that is running (a radio show on Venus) goes on.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && holders === 0) closeMic();
  });
}

/** whether this page can open a microphone at all (https, a browser with getUserMedia) */
export function canOpenMic(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * The page's microphone, switched on. Call it from the tap itself (no await before it): the first getUserMedia of a
 * page must come from a user's action on iPhone. Throws the browser's own error (lib/mic/core faultOfError names it).
 */
export async function openMic(): Promise<MediaStream> {
  if (!canOpenMic()) throw new Error('unsupported');
  if (idle) clearTimeout(idle);
  idle = null;
  // the story's music and lines go quiet first (they spoil the take: R21 playtest)
  micBusy(true);
  micSession(true);
  const ask = () => {
    const p = navigator.mediaDevices.getUserMedia(CONSTRAINTS);
    shared = p;
    return p;
  };
  // no stream yet: ask at once, inside the tap
  let mine = shared ?? ask();
  try {
    let s = await mine;
    if (!usable(s)) {
      // interrupted since the last take (muted / ended): a fresh one
      s.getTracks().forEach((t) => t.stop());
      mine = ask();
      s = await mine;
    }
    arm();
    for (const t of s.getAudioTracks()) t.enabled = true;
    holders++;
    return s;
  } catch (e) {
    if (shared === mine) shared = null;
    if (holders === 0) {
      micSession(false);
      micBusy(false);
    }
    throw e;
  }
}

/** a recording ended: the track goes quiet; the stream is kept a short while for the next press, then closed */
export function quietMic() {
  holders = Math.max(0, holders - 1);
  if (holders > 0) return;
  micBusy(false);
  void shared?.then((s) => s.getAudioTracks().forEach((t) => (t.enabled = false))).catch(() => undefined);
  if (idle) clearTimeout(idle);
  idle = setTimeout(closeMic, MIC_IDLE_MS);
}

/** the stream ends now (the page goes away, the recogniser needs the mic, the idle time is over) */
export function closeMic() {
  if (idle) clearTimeout(idle);
  idle = null;
  holders = 0;
  void shared?.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => undefined);
  shared = null;
  micSession(false);
  micBusy(false);
}

/** test only: forget everything */
export function resetMicForTest() {
  if (idle) clearTimeout(idle);
  idle = null;
  holders = 0;
  shared = null;
  armed = true;
}
