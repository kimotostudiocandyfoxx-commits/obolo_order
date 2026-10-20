'use client';

import { masterBus, unlockAudio } from '@/lib/onboarding/audio';
import { nameRest, voiceKey, voiceable } from './voice';

/** a line with a member's name in it ({name} {neo} {bati} …) */
export const hasNames = (text: string) => /\{[a-z_]+\}/.test(text);

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

/**
 * A spoken line. Played through Web Audio (decoded buffers), not an <audio> element: on iOS a motion
 * with sound that starts or loops (an unmuted <video>) takes over the media session and silenced an
 * element mid-line (2026-10-20: voices cut off at loop seams and under motion 17). An element is only
 * the fallback where Web Audio is missing.
 */
export class LineVoice {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private src: AudioBufferSourceNode | null = null;
  private el: HTMLAudioElement | null = null;
  private volume = DEFAULT_MIX.voice;
  private muted = false;
  private token = 0;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  /** this member's own voices of the lines with names in them (voiceKey of the line as written → file) */
  private personal: Record<string, string> = {};
  /** speaking (true) / quiet (false): the stage moves mouths and dips the music */
  onSpeaking: (on: boolean) => void = () => undefined;

  constructor() {
    void loadManifest();
  }

  /** Call inside the first tap so later plays are allowed on iOS. */
  unlock() {
    if (typeof window === 'undefined') return;
    this.ctx = unlockAudio();
    if (this.ctx && !this.gain) {
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.muted ? 0 : this.volume;
      this.gain.connect(masterBus(this.ctx));
    }
    if (!this.ctx && !this.el) {
      const el = new Audio();
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.addEventListener('ended', () => this.onSpeaking(false));
      el.addEventListener('playing', () => this.onSpeaking(true));
      this.el = el;
    }
  }

  setVolume(v: number) {
    this.volume = v;
    this.applyLevel();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyLevel();
  }

  private applyLevel() {
    if (this.gain && this.ctx) this.gain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    if (this.el) {
      this.el.volume = this.volume;
      this.el.muted = this.muted;
    }
  }

  setPersonal(voices: Record<string, string>) {
    this.personal = voices;
  }

  /** The file a line is spoken from: its own; for a line with names, the member's voice of it, else the part after the name. */
  private async urlOf(who: string, text: string, act?: string): Promise<string | null> {
    const m = await loadManifest();
    if (hasNames(text)) {
      const own = this.personal[voiceKey(who, act, text)] ?? this.personal[voiceKey(who, undefined, text)];
      if (own) return own;
      // not made yet (e.g. right after the name is given): say the words after the name at least
      const rest = nameRest(text);
      return rest ? (m[voiceKey(who, act, rest)] ?? m[voiceKey(who, undefined, rest)] ?? null) : null;
    }
    if (!voiceable(text)) return null;
    return m[voiceKey(who, act, text)] ?? null;
  }

  private buffer(url: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(url);
    if (!p && this.ctx) {
      const ctx = this.ctx;
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      this.buffers.set(url, p);
      // keep memory low: only the last few lines stay decoded
      if (this.buffers.size > 12) this.buffers.delete(this.buffers.keys().next().value!);
    }
    return p ?? Promise.resolve(null);
  }

  /** Fetch and decode a line ahead of time, so it starts the moment it is shown. */
  async prefetch(who: string, text: string, act?: string) {
    const url = await this.urlOf(who, text, act);
    if (url && this.ctx) void this.buffer(url);
  }

  /** Speak this line if it has a voice. `who` / `text` as written in the story (before names are filled in). */
  async say(who: string, text: string, act?: string) {
    this.stop();
    const t = ++this.token;
    const url = await this.urlOf(who, text, act);
    if (!url || t !== this.token) return;
    if (this.ctx && this.gain) {
      const buf = await this.buffer(url);
      if (!buf || t !== this.token) return;
      if (this.ctx.state !== 'running') void this.ctx.resume();
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.gain);
      src.onended = () => {
        if (this.src === src) {
          this.src = null;
          this.onSpeaking(false);
        }
      };
      src.start();
      this.src = src;
      this.onSpeaking(true);
      return;
    }
    if (!this.el) return;
    this.el.src = url;
    this.applyLevel();
    void this.el.play().catch(() => this.onSpeaking(false));
  }

  stop() {
    this.token++;
    if (this.src) {
      const s = this.src;
      this.src = null;
      try {
        s.stop();
      } catch {
        /* already ended */
      }
      this.onSpeaking(false);
    }
    if (this.el && !this.el.paused) this.el.pause();
  }

  dispose() {
    this.stop();
    this.gain?.disconnect();
    this.gain = null;
    this.el = null;
    this.buffers.clear();
  }
}

/** The voice file of a story line (who + words as written), or null. For kororins the story drops in. */
export async function lineVoiceUrl(who: string, text: string, act?: string): Promise<string | null> {
  if (!voiceable(text)) return null;
  const m = await loadManifest();
  return m[voiceKey(who, act, text)] ?? m[voiceKey(who, undefined, text)] ?? null;
}
