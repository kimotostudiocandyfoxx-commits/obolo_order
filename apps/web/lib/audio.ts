'use client';

import { getBlob } from './api/idb';

/**
 * One shared <audio> element for voice playback: starting a clip stops the previous one,
 * and reusing a single element keeps iOS Safari happy (it is "unlocked" by the first tap).
 * URL schemes: https:// (Bunny CDN / API), idb:<id> (demo recordings), tts:<text> (demo sample voice).
 */
type Listener = (state: { url: string | null; playing: boolean; progress: number }) => void;

let el: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let objectUrl: string | null = null;
const listeners = new Set<Listener>();
let ttsTimer: ReturnType<typeof setInterval> | null = null;

function emit(playing: boolean, progress = 0) {
  for (const l of listeners) l({ url: currentUrl, playing, progress });
}

function audio(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
    el.addEventListener('timeupdate', () => el && emit(!el.paused, el.duration ? el.currentTime / el.duration : 0));
    el.addEventListener('ended', () => emit(false, 1));
    el.addEventListener('pause', () => el && emit(false, el.duration ? el.currentTime / el.duration : 0));
    el.addEventListener('play', () => emit(true, 0));
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
  ttsTimer = null;
  emit(false);
}

export async function toggleAudio(url: string): Promise<void> {
  if (currentUrl === url && el && !el.paused) {
    el.pause();
    return;
  }
  stopAudio();
  currentUrl = url;

  if (url.startsWith('tts:')) {
    const text = url.slice(4);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = /[぀-ヿ一-龯]/.test(text) ? 'ja-JP' : 'en-US';
    u.rate = 1.05;
    const started = Date.now();
    const est = Math.max(1500, text.length * 140);
    u.onend = () => {
      if (ttsTimer) clearInterval(ttsTimer);
      emit(false, 1);
    };
    ttsTimer = setInterval(() => emit(true, Math.min(0.98, (Date.now() - started) / est)), 150);
    speechSynthesis.speak(u);
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
    a.src = objectUrl;
  } else {
    a.src = url;
  }
  await a.play();
}

/** Plays a local blob (composer preview). */
export async function playBlob(blob: Blob, key: string): Promise<void> {
  stopAudio();
  currentUrl = key;
  const a = audio();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(blob);
  a.src = objectUrl;
  await a.play();
}
