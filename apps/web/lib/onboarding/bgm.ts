'use client';

import { hasPlaybackSession, masterBus, unlockAudio } from './audio';
import { bgmLevel, bgmUrl } from './media';

/**
 * Background music for the story.
 *
 * Mode "element" (default): a plain <audio> element, played exactly like the motion videos, which
 * are known to be audible on iPad. It is NOT routed through Web Audio (on some iOS versions a
 * MediaElementSource comes out silent). Level = the file's own loudness (−16 LUFS) × the per-track
 * level where the browser allows element volume; on iOS (fixed volume) it plays at full level.
 *
 * Mode "buffer" (automatic fallback): if iOS refuses or interrupts the element (e.g. while a video
 * with sound plays), the track is decoded and looped with Web Audio instead.
 *
 * unlock() must be called from the visitor's first tap.
 */
type Mode = 'element' | 'buffer';

export class Bgm {
  private mode: Mode = 'element';
  private el: HTMLAudioElement | null = null;
  private track: string | null = null;
  private muted = false;
  /** Pauses we cause ourselves (incl. src changes, whose events arrive later) are ignored. */
  private ignorePauseUntil = 0;
  private swapTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  // buffer mode
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private disposed = false;

  /** Call inside a user gesture. `track` = what should play right now (if anything). */
  unlock(track: string | null) {
    if (typeof window === 'undefined') return;
    // Web Audio is only needed for the fallback, but unlock it now while we have a gesture.
    hasPlaybackSession();
    this.ctx = unlockAudio();
    if (!this.el) {
      const el = new Audio();
      el.loop = true;
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.addEventListener('pause', () => {
        // iOS paused the music on its own (another media session took over) → fall back.
        if (Date.now() > this.ignorePauseUntil && this.track && this.mode === 'element' && !this.disposed) this.toBuffer();
      });
      el.addEventListener('error', () => {
        if (this.track && this.mode === 'element') this.toBuffer();
      });
      this.el = el;
    }
    if (track) this.play(track, 0.6);
    else {
      // Prime the element inside the gesture so later play() calls are allowed on iOS.
      this.quiet();
      this.el.src = bgmUrl('video11');
      this.el.play().then(
        () => {
          if (!this.track) {
            this.quiet();
            this.el?.pause();
          }
        },
        () => undefined,
      );
    }
  }

  set(track: string | null) {
    if (track === this.track) return;
    if (this.swapTimer) clearTimeout(this.swapTimer);
    if (!this.track) {
      if (track) this.play(track, 1.2);
      return;
    }
    this.fadeTo(0, 0.9);
    this.swapTimer = setTimeout(() => {
      if (track) this.play(track, 1.2);
      else this.stopNow();
    }, 950);
  }

  fadeOut(seconds = 2.5) {
    this.fadeTo(0, seconds);
    if (this.swapTimer) clearTimeout(this.swapTimer);
    this.swapTimer = setTimeout(() => this.stopNow(), seconds * 1000 + 100);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.el) this.el.muted = m;
    if (this.gain && this.ctx) this.gain.gain.setTargetAtTime(m ? 0 : this.level(), this.ctx.currentTime, 0.05);
  }

  dispose() {
    this.disposed = true;
    if (this.swapTimer) clearTimeout(this.swapTimer);
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    this.stopNow();
    this.gain?.disconnect(); // the shared AudioContext stays alive for the countdown sounds
    this.buffers.clear();
  }

  // ------------------------------------------------------------------

  private quiet() {
    this.ignorePauseUntil = Date.now() + 800;
  }

  private level() {
    return this.track ? bgmLevel(this.track) : 0;
  }

  private stopNow() {
    this.track = null;
    this.quiet();
    this.el?.pause();
    try {
      this.source?.stop();
    } catch {
      /* already stopped */
    }
    this.source = null;
  }

  private play(track: string, fadeIn: number) {
    this.track = track;
    if (this.mode === 'buffer') {
      void this.playBuffer(track, 0, fadeIn);
      return;
    }
    const el = this.el;
    if (!el) return;
    this.quiet();
    el.src = bgmUrl(track);
    el.muted = this.muted;
    el.volume = 0;
    const p = el.play();
    p?.catch(() => {
      if (this.track === track) this.toBuffer();
    });
    this.fadeTo(this.level(), fadeIn);
  }

  /** Switch to Web Audio playback, continuing from where the element was. */
  private toBuffer() {
    if (this.mode === 'buffer' || !this.track) return;
    this.mode = 'buffer';
    const at = this.el?.currentTime ?? 0;
    this.quiet();
    this.el?.pause();
    void this.playBuffer(this.track, at, 0.4);
  }

  private load(track: string): Promise<AudioBuffer> {
    let p = this.buffers.get(track);
    if (!p) {
      const ctx = this.ctx;
      if (!ctx) return Promise.reject(new Error('no audio context'));
      p = fetch(bgmUrl(track))
        .then((r) => r.arrayBuffer())
        .then((b) => new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(b, res, rej)));
      // keep memory low: only the current track stays decoded
      this.buffers.clear();
      this.buffers.set(track, p);
    }
    return p;
  }

  private async playBuffer(track: string, offset: number, fadeIn: number) {
    const ctx = this.ctx ?? unlockAudio();
    if (!ctx) return;
    this.ctx = ctx;
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.connect(masterBus(ctx));
    }
    let buf: AudioBuffer;
    try {
      buf = await this.load(track);
    } catch {
      return;
    }
    if (this.track !== track || this.disposed) return;
    try {
      this.source?.stop();
    } catch {
      /* ignore */
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.gain);
    const t = ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(0, t);
    this.gain.gain.linearRampToValueAtTime(this.muted ? 0 : bgmLevel(track), t + fadeIn);
    src.start(t, offset % buf.duration);
    this.source = src;
  }

  private fadeTo(v: number, seconds: number) {
    if (this.mode === 'buffer') {
      if (!this.gain || !this.ctx) return;
      const t = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(this.gain.gain.value, t);
      this.gain.gain.linearRampToValueAtTime(this.muted ? 0 : v, t + seconds);
      return;
    }
    // Element volume steps (ignored on iOS, where the element always plays at full level).
    const el = this.el;
    if (!el) return;
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    const from = el.volume;
    const steps = Math.max(1, Math.round((seconds * 1000) / 50));
    let k = 0;
    this.fadeTimer = setInterval(() => {
      k++;
      el.volume = Math.min(1, Math.max(0, from + ((v - from) * k) / steps));
      if (k >= steps && this.fadeTimer) clearInterval(this.fadeTimer);
    }, 50);
  }
}
