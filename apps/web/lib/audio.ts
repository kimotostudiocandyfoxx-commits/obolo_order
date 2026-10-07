'use client';

import { NEO_PITCH, parseTtsUrl } from '@obolo/shared';
import { getBlob } from './api/idb';

/**
 * One shared <audio> element for voice playback: starting a clip stops the previous one,
 * and reusing a single element keeps iOS Safari happy (it is "unlocked" by the first tap).
 * URL schemes: https:// (Bunny CDN / API), idb:<id> (demo recordings), tts:<text> / tts:<style>.<neo>:<text>
 * (speech synthesis: sample voices and the NEO voice).
 */
type Listener = (state: { url: string | null; playing: boolean; progress: number }) => void;

let el: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
/** what the <audio> element holds (its events only count while that is the current clip) */
let elUrl: string | null = null;
let objectUrl: string | null = null;
const listeners = new Set<Listener>();
let ttsTimer: ReturnType<typeof setInterval> | null = null;
let ttsWatchdog: ReturnType<typeof setTimeout> | null = null;
let ttsSeq = 0;

function emit(playing: boolean, progress = 0) {
  for (const l of listeners) l({ url: currentUrl, playing, progress });
}

function audio(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
    const mine = () => elUrl !== null && elUrl === currentUrl;
    el.addEventListener('timeupdate', () => el && mine() && emit(!el.paused, el.duration ? el.currentTime / el.duration : 0));
    el.addEventListener('ended', () => mine() && emit(false, 1));
    el.addEventListener('pause', () => el && mine() && emit(false, el.duration ? el.currentTime / el.duration : 0));
    el.addEventListener('play', () => mine() && emit(true, 0));
  }
  return el;
}

export function subscribeAudio(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function stopAudio() {
  if (el && !el.paused) el.pause();
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  if (ttsTimer) clearInterval(ttsTimer);
  if (ttsWatchdog) clearTimeout(ttsWatchdog);
  ttsTimer = null;
  ttsWatchdog = null;
  emit(false);
}

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
let primed = { el: false, tts: false };
/**
 * iPad Safari only lets sound start inside a tap. Call this from a tap (pointerup) to unlock
 * the channel a chain of voices may need later from a timer: `keep` is the one about to play now.
 */
export function primeAudio(keep: 'el' | 'tts') {
  if (keep !== 'el' && !primed.el) {
    primed.el = true;
    const a = audio();
    elUrl = null;
    a.src = SILENT_WAV;
    void a.play().catch(() => undefined);
  }
  if (keep !== 'tts' && !primed.tts && typeof speechSynthesis !== 'undefined') {
    primed.tts = true;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
  if (keep === 'el') primed.el = true;
  else primed.tts = true;
}

export async function toggleAudio(url: string): Promise<void> {
  if (currentUrl === url && el && !el.paused) {
    el.pause();
    return;
  }
  // Safari drops an utterance spoken right after cancel(): give it a moment when one was talking
  const wasSpeaking = typeof speechSynthesis !== 'undefined' && (speechSynthesis.speaking || speechSynthesis.pending);
  stopAudio();
  currentUrl = url;

  if (url.startsWith('tts:')) {
    const tts = parseTtsUrl(url)!;
    const text = tts.text;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = /[\u3040-\u30ff\u4e00-\u9faf]/.test(text) ? 'ja-JP' : 'en-US';
    const voice = speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-').startsWith(u.lang.slice(0, 2)));
    if (voice) u.voice = voice;
    u.rate = tts.style?.rate ?? 1.05;
    // NEO voice: the style's pitch × the NEO form's own pitch (P-VOICE-1)
    u.pitch = Math.min(2, Math.max(0, (tts.style?.pitch ?? 1) * (NEO_PITCH[tts.neo ?? ''] ?? 1)));
    u.volume = tts.style?.volume ?? 1;
    const started = Date.now();
    const est = Math.max(1500, (text.length * 140) / (u.rate || 1));
    const seq = ++ttsSeq;
    const finish = (progress = 1) => {
      if (seq !== ttsSeq || currentUrl !== url) return;
      if (ttsTimer) clearInterval(ttsTimer);
      if (ttsWatchdog) clearTimeout(ttsWatchdog);
      ttsTimer = null;
      ttsWatchdog = null;
      emit(false, progress);
    };
    u.onend = () => finish(1);
    // could not speak: move on without counting it as heard
    u.onerror = () => finish(0);
    ttsTimer = setInterval(() => emit(true, Math.min(0.98, (Date.now() - started) / est)), 150);
    // a voice that never starts or never reports its end must not hold up the next one
    ttsWatchdog = setTimeout(() => {
      speechSynthesis.cancel();
      finish(0);
    }, est * 1.8 + 2500);
    if (wasSpeaking) setTimeout(() => seq === ttsSeq && speechSynthesis.speak(u), 80);
    else speechSynthesis.speak(u);
    emit(true, 0);
    return;
  }

  const a = audio();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
  if (url.startsWith('idb:')) {
    const blob = await getBlob(url.slice(4));
    if (!blob) throw new Error('missing clip');
    objectUrl = URL.createObjectURL(blob);
    elUrl = url;
    a.src = objectUrl;
  } else {
    elUrl = url;
    a.src = url;
  }
  await a.play();
}

/** Plays a local blob (composer preview). */
export async function playBlob(blob: Blob, key: string): Promise<void> {
  stopAudio();
  currentUrl = key;
  elUrl = key;
  const a = audio();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(blob);
  a.src = objectUrl;
  await a.play();
}
