'use client';

/**
 * One AudioContext shared by the story BGM and the sound effects. It is created/resumed from the
 * visitor's first tap (iOS requirement) and kept alive across screens, so the countdown ticks can
 * play right after the story ends without another tap.
 */
let ctx: AudioContext | null = null;

type NavigatorWithAudioSession = Navigator & { audioSession?: { type: string } };

/**
 * M-R239 (client 2026-11-22): sound follows the phone's silent switch — with the switch on, nothing sounds. Web Audio
 * under an "ambient" audio session (Safari 16.4+) is muted by the switch and mixes with other apps; an <audio>
 * element would play through it on iPhone, so voices and music go through Web Audio (lib/voice/webVoice.ts,
 * lib/story/lineVoice.ts, lib/onboarding/bgm.ts). Before this the session was "playback" (it played through the
 * switch on purpose). Returns false where the API is missing (Android and older iOS: the system decides).
 */
export function setAudioSession(type: 'ambient' | 'playback' = 'ambient'): boolean {
  if (typeof navigator === 'undefined') return false;
  const n = navigator as NavigatorWithAudioSession;
  if (!n.audioSession) return false;
  // the mic is open: iOS records under "play-and-record" only — nothing may pull the session back while it listens
  if (micOpen) return true;
  try {
    if (n.audioSession.type !== type) n.audioSession.type = type;
    return true;
  } catch {
    return false;
  }
}

/**
 * Client 2026-11-27 (iPhone: 「マイクが反応しないことが多い」): the "ambient" session above (the silent switch, M-R239) is a
 * play-only session. On iPhone / iPad a microphone opened under it can give no sound (or not start), and every sound
 * the page played called audioCtx() and set "ambient" again, also in the middle of a recording. So: while a mic is
 * open (lib/micStream.ts, lib/mic/hear.ts) the session is "play-and-record" and stays so; when the mic is let go it
 * goes back to "ambient". No audioSession API (Android, older iOS): nothing to do.
 */
let micOpen = false;
/**
 * R21 playtest (client 2026-11-28, iPhone Safari, day 2's favourite food): the story's music now plays on days 1 and 2,
 * also under the mic — and both takes came back as 「00:00」 / noise. The phone's speaker playing into its own mic
 * (and, on iPhone, Web Audio running while the capture starts) spoils the take, as on Saturn (QA 5 N14: the music is
 * silent while the mic records). So every take is told to the page — from just before the mic is asked for until the
 * take ends (lib/micStream.ts, lib/mic/hear.ts) — and the story quiets its music and stops a line being read meanwhile
 * (components/onboarding/StoryPlayer.tsx).
 */
export const MIC_BUSY_EVENT = 'obolo:mic-busy';
let busy = false;
export function micBusy(on: boolean) {
  if (busy === on) return;
  busy = on;
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(MIC_BUSY_EVENT, { detail: on }));
  } catch {
    /* nothing listens */
  }
}
export const isMicBusy = () => busy;
export function micSession(on: boolean) {
  micOpen = on;
  if (typeof navigator === 'undefined') return;
  const n = navigator as NavigatorWithAudioSession;
  if (!n.audioSession) return;
  try {
    const want = on ? 'play-and-record' : 'ambient';
    if (n.audioSession.type !== want) n.audioSession.type = want;
  } catch {
    /* an older WebKit without this type: the system decides */
  }
}
export const isMicSession = () => micOpen;
/** the old name (the BGM calls it): now the silent-switch-respecting session */
export const hasPlaybackSession = () => setAudioSession('ambient');

export function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  hasPlaybackSession();
  if (!ctx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

/** Call from a user gesture. */
export function unlockAudio(): AudioContext | null {
  const c = audioCtx();
  if (c && c.state !== 'running') void c.resume();
  return c;
}

/**
 * iPad feedback (voices did not play): iOS / iPadOS Safari lets a suspended AudioContext start only inside a real user
 * activation — touchend / click / keydown / pointerup. A pointerdown from a finger (TalkScene's tap) is a touchstart
 * underneath and does not count, so resume() there left the context suspended and every clip came back null (the
 * words and the mouth without sound). This arms a listener for the whole app (layout: AudioUnlock): the first such
 * event resumes the context and plays one silent frame (what WebKit needs to really open the output); it stays armed
 * until the context runs, and arms again when the page comes back (iOS suspends / interrupts it in the background).
 * The silent switch (M-R239, the "ambient" session) is untouched: with the iPad muted, nothing sounds, as decided.
 */
const UNLOCK_EVENTS = ['touchend', 'click', 'keydown', 'pointerup'] as const;
let armed = false;
function unlockOnce() {
  const c = unlockAudio();
  if (!c) return;
  try {
    const b = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = b;
    src.connect(c.destination);
    src.start(0);
  } catch {
    /* nothing to open */
  }
  if (c.state === 'running') disarm();
  else void c.resume().then(() => c.state === 'running' && disarm(), () => undefined);
}
function disarm() {
  if (!armed) return;
  armed = false;
  for (const e of UNLOCK_EVENTS) window.removeEventListener(e, unlockOnce, true);
}
/** arm the first-tap unlock (idempotent); returns the clean-up */
export function armAudioUnlock(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const arm = () => {
    if (armed) return;
    if (ctx && ctx.state === 'running') return;
    armed = true;
    for (const e of UNLOCK_EVENTS) window.addEventListener(e, unlockOnce, { capture: true, passive: true });
  };
  const back = () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') arm();
  };
  arm();
  document.addEventListener('visibilitychange', back);
  return () => {
    disarm();
    document.removeEventListener('visibilitychange', back);
  };
}

let bus: DynamicsCompressorNode | null = null;

/**
 * Master output for music + effects: a gentle limiter so the louder mix never clips on phone
 * speakers. Everything synthesised or routed through Web Audio connects here.
 */
export function masterBus(c: AudioContext): AudioNode {
  if (!bus || bus.context !== c) {
    bus = c.createDynamicsCompressor();
    bus.threshold.value = -3;
    bus.knee.value = 3;
    bus.ratio.value = 20;
    bus.attack.value = 0.002;
    bus.release.value = 0.2;
    bus.connect(c.destination);
  }
  return bus;
}
