'use client';

import { BATI_FIXED_VOICES, BATI_VOICE_DEFAULT_EGG, batiStoryVoice, type BatiEggKind } from '@obolo/shared';
import { masterBus, unlockAudio } from '@/lib/onboarding/audio';
import { nameParts, voiceKey, voiceable } from './voice';

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

/** the story's speaker name of {bati} */
const BATI = 'バティ';
/**
 * M-R342 (client 2026-11-27): {bati} speaks in the fixed voice of its egg (both eggs the same voice for now). Its
 * pre-made lines are kept once per distinct voice (story-voices.ts: under batiStoryVoice(egg) — the same key for eggs
 * that share a voice). Which egg: the one just chosen in the story playing
 * now (day 2 / SYS-S003: StoryPlayer, while it is on screen), else the account's {bati} in the chat (lib/auth).
 * null: not known.
 */
const eggs: { account: BatiEggKind | null; scene: BatiEggKind | null } = { account: null, scene: null };
const anEgg = (e: unknown): BatiEggKind | null => (e === 'moon' || e === 'sun' ? e : null);
export function setBatiVoiceEgg(egg: BatiEggKind | null | undefined) {
  eggs.account = anEgg(egg);
}
export function setSceneBatiVoiceEgg(egg: string | null | undefined) {
  eggs.scene = anEgg(egg);
}
export const batiVoiceEgg = (): BatiEggKind | null => eggs.scene ?? eggs.account;
/**
 * The pre-made file of a line: {bati}'s in its egg's voice; while that file is not made yet (or the egg is not known),
 * the line's old voice stands in rather than silence. Everyone else: their one file.
 */
export function storyVoiceFile(m: Record<string, string>, who: string, text: string, act?: string, egg: BatiEggKind | null = batiVoiceEgg(), voices: Readonly<Record<BatiEggKind, string>> = BATI_FIXED_VOICES): string | null {
  // the egg not known: when every egg has the same voice, that one set is right anyway
  const all = new Set(Object.values(voices)).size === 1;
  const as = who === BATI && (egg || all) ? batiStoryVoice(egg ?? BATI_VOICE_DEFAULT_EGG, voices) : null;
  const own = as ? (m[voiceKey(as, act, text)] ?? m[voiceKey(as, undefined, text)]) : undefined;
  return own ?? m[voiceKey(who, act, text)] ?? null;
}

/** seconds of quiet between the pieces of a line with a name (where the name would be said) */
const PIECE_GAP = 0.18;

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
  /** the voice's loudness, for the speaker's lip sync */
  private analyser: AnalyserNode | null = null;
  private wave: Float32Array<ArrayBuffer> | null = null;
  private src: AudioBufferSourceNode | null = null;
  /** the line's pieces scheduled one after another (a line with a name: its fixed words) */
  private queue: AudioBufferSourceNode[] = [];
  /** the line's own level (under the voices' gain): a line let go fades out on it without touching the next line */
  private lineGain: GainNode | null = null;
  private el: HTMLAudioElement | null = null;
  private volume = DEFAULT_MIX.voice;
  private muted = false;
  private token = 0;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  /** this member's own voices of the lines with names in them (voiceKey of the line as written → file) */
  private personal: Record<string, string> = {};
  /** speaking (true) / quiet (false): the stage moves mouths and dips the music */
  onSpeaking: (on: boolean) => void = () => undefined;
  /** a line's voice is on its way (fetched / decoded, not started yet): the story waits for it as for the voice itself */
  onLoading: (on: boolean) => void = () => undefined;
  /** how long the line playing now is (s; 0 while unknown) */
  duration(): number {
    if (this.src?.buffer) return this.src.buffer.duration;
    return this.el && Number.isFinite(this.el.duration) ? this.el.duration : 0;
  }

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
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.wave = new Float32Array(this.analyser.fftSize);
      this.gain.connect(this.analyser);
    }
    if (!this.ctx && !this.el) {
      const el = new Audio();
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.addEventListener('ended', () => this.onSpeaking(false));
      el.addEventListener('error', () => {
        this.onLoading(false);
        this.onSpeaking(false);
      });
      el.addEventListener('playing', () => {
        this.onLoading(false);
        this.onSpeaking(true);
      });
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

  /** How loud the line playing now is (0–1, RMS): the speaker's mouth opens above MOTION.lip.open. */
  level(): number {
    if (!this.analyser || !this.wave || !this.src) return 0;
    this.analyser.getFloatTimeDomainData(this.wave);
    let sum = 0;
    for (let k = 0; k < this.wave.length; k++) sum += this.wave[k] * this.wave[k];
    return Math.sqrt(sum / this.wave.length) / Math.max(0.05, this.volume);
  }

  setPersonal(voices: Record<string, string>) {
    this.personal = voices;
  }

  /**
   * The files a line is spoken from, played one after another: its own; for a line with names, the member's voice of the
   * whole line when it is made — until then (right after the name is given, or the server is slow) the line's fixed words
   * (nameParts) at once, so it is never silent (client playtest 2026-11-28). [] = no voice.
   */
  private async urlsOf(who: string, text: string, act?: string): Promise<string[]> {
    const m = await loadManifest();
    if (hasNames(text)) {
      const own = this.personal[voiceKey(who, act, text)] ?? this.personal[voiceKey(who, undefined, text)];
      if (own) return [own];
      return nameParts(text).flatMap((p) => storyVoiceFile(m, who, p) ?? []);
    }
    if (!voiceable(text)) return [];
    const f = storyVoiceFile(m, who, text, act);
    return f ? [f] : [];
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
    const urls = await this.urlsOf(who, text, act);
    if (this.ctx) for (const u of urls) void this.buffer(u);
  }

  /** Speak this line if it has a voice. `who` / `text` as written in the story (before names are filled in). */
  async say(who: string, text: string, act?: string) {
    this.stop();
    const t = ++this.token;
    const urls = await this.urlsOf(who, text, act);
    if (!urls.length || t !== this.token) return;
    this.onLoading(true);
    if (this.ctx && this.gain) {
      const bufs = await Promise.all(urls.map((u) => this.buffer(u)));
      if (t !== this.token) return;
      const list = bufs.filter((b): b is AudioBuffer => !!b);
      if (!list.length) return this.onLoading(false);
      if (this.ctx.state !== 'running') void this.ctx.resume();
      this.onLoading(false);
      this.onSpeaking(true);
      const line = this.ctx.createGain();
      line.connect(this.gain);
      this.lineGain = line;
      // the pieces of a line with a name: a short breath where the name would be
      let at = this.ctx.currentTime;
      list.forEach((buf, k) => {
        const src = this.ctx!.createBufferSource();
        src.buffer = buf;
        src.connect(line);
        const last = k === list.length - 1;
        src.onended = () => {
          if (t !== this.token) return;
          if (last) {
            this.src = null;
            this.queue = [];
            if (this.lineGain === line) this.lineGain = null;
            line.disconnect();
            this.onSpeaking(false);
          } else this.src = this.queue[k + 1] ?? null;
        };
        src.start(at);
        at += buf.duration + PIECE_GAP;
        this.queue.push(src);
      });
      this.src = this.queue[0];
      return;
    }
    if (!this.el) return this.onLoading(false);
    // the <audio> fallback plays the pieces in turn
    const el = this.el;
    let k = 0;
    const next = () => {
      if (t !== this.token || ++k >= urls.length) return;
      el.removeEventListener('ended', next);
      el.src = urls[k];
      if (k < urls.length - 1) el.addEventListener('ended', next, { once: true });
      void el.play().catch(() => undefined);
    };
    if (urls.length > 1) el.addEventListener('ended', next, { once: true });
    el.src = urls[0];
    this.applyLevel();
    void el.play().catch(() => {
      this.onLoading(false);
      this.onSpeaking(false);
    });
  }

  /**
   * Stop the line now. `fade` seconds (default a few ms, no click): the voice fades out on its own level and the speaking
   * state ends at once, so the music comes back up while it fades — a tap that goes on mid-line (client 2026-11-28) uses
   * 0.2 s. The next line can start meanwhile: it has its own level.
   */
  stop(fade = 0.03) {
    this.token++;
    this.onLoading(false);
    if (this.src || this.queue.length) {
      const list = this.queue.length ? this.queue : [this.src!];
      const g = this.lineGain;
      const end = this.ctx ? this.ctx.currentTime + fade : 0;
      if (g && this.ctx) {
        g.gain.cancelScheduledValues(this.ctx.currentTime);
        g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, end);
      }
      for (const s of list) {
        s.onended = null;
        try {
          if (g && this.ctx) s.stop(end + 0.02);
          else s.stop();
        } catch {
          /* already ended, or not started yet */
          try {
            s.stop();
          } catch {
            /* already ended */
          }
        }
      }
      if (g) setTimeout(() => g.disconnect(), (fade + 0.1) * 1000);
      this.lineGain = null;
      this.queue = [];
      this.src = null;
      this.onSpeaking(false);
    }
    if (this.el && !this.el.paused) {
      this.el.pause();
      // the <audio> fallback: a line cut short never fires 'ended' — without this the music stayed dipped
      this.onSpeaking(false);
    }
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
  return storyVoiceFile(m, who, text, act) ?? m[voiceKey(who, undefined, text)] ?? null;
}
