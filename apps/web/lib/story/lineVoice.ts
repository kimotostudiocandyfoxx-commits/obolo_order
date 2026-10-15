'use client';

import { voiceKey, voiceable } from './voice';

/**
 * The story's spoken lines (production UI 5, 2026-10-15): every line that has a voice file plays it
 * (public/story/voices/manifest.json, made by .github/workflows/story-voices.yml, one file per line named
 * by voiceKey). While a line is spoken the music dips. The mixer's three volumes (music / sounds / voices)
 * are kept on this device.
 */
export interface Mix {
  bgm: number;
  se: number;
  voice: number;
}
export const DEFAULT_MIX: Mix = { bgm: 0.8, se: 0.8, voice: 1 };
const MIX_KEY = 'obolo.story.mix';

export function loadMix(): Mix {
  try {
    const raw = localStorage.getItem(MIX_KEY);
    if (raw) return { ...DEFAULT_MIX, ...(JSON.parse(raw) as Partial<Mix>) };
  } catch {
    /* private mode */
  }
  return DEFAULT_MIX;
}
export function saveMix(m: Mix) {
  try {
    localStorage.setItem(MIX_KEY, JSON.stringify(m));
  } catch {
    /* private mode */
  }
}

/** How much the music dips while someone speaks. */
export const VOICE_DIP = 0.35;

let manifest: Promise<Record<string, string>> | null = null;
function loadManifest() {
  manifest ??= fetch('/story/voices/manifest.json')
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : {}))
    .catch(() => ({}));
  return manifest;
}

export class LineVoice {
  private el: HTMLAudioElement | null = null;
  private volume = DEFAULT_MIX.voice;
  private muted = false;
  private token = 0;
  /** speaking (true) / quiet (false): the stage moves mouths and dips the music */
  onSpeaking: (on: boolean) => void = () => undefined;

  constructor() {
    void loadManifest();
  }

  /** Call inside the first tap so later plays are allowed on iOS. */
  unlock() {
    if (this.el || typeof window === 'undefined') return;
    const el = new Audio();
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    el.addEventListener('ended', () => this.onSpeaking(false));
    el.addEventListener('pause', () => this.onSpeaking(false));
    el.addEventListener('playing', () => this.onSpeaking(true));
    this.el = el;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.el) this.el.volume = v;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.el) this.el.muted = m;
  }

  /** Speak this line if it has a voice. `who` / `text` as written in the story (before names are filled in). */
  async say(who: string, text: string, act?: string) {
    this.stop();
    const t = ++this.token;
    if (!voiceable(text)) return;
    const url = (await loadManifest())[voiceKey(who, act, text)];
    if (!url || t !== this.token || !this.el) return;
    this.el.src = url;
    this.el.volume = this.volume;
    this.el.muted = this.muted;
    void this.el.play().catch(() => this.onSpeaking(false));
  }

  stop() {
    this.token++;
    if (this.el && !this.el.paused) this.el.pause();
  }

  dispose() {
    this.stop();
    this.el = null;
  }
}
