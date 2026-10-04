'use client';

import { hasPlaybackSession, masterBus, unlockAudio } from './audio';
import { bgmLevel, bgmUrl } from './media';

/**
 * Background music for the story.
 *  - Where the Audio Session API exists (Safari 16.4+, Chrome…), it is routed through Web Audio so
 *    the level can be set and faded (iOS ignores HTMLMediaElement.volume).
 *  - Older iOS mutes Web Audio under the silent switch, so there the plain <audio> element plays
 *    directly (full, normalised level; fades are skipped where volume is read-only).
 * unlock() must be called from the visitor's first tap.
 */
export class Bgm {
  private ctx: AudioContext | null = null;
  private el: HTMLAudioElement | null = null;
  private gain: GainNode | null = null;
  private track: string | null = null;
  private muted = false;
  private swapTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;

  /** Call inside a user gesture. `track` = what should play right now (if anything). */
  unlock(track: string | null) {
    if (typeof window === 'undefined') return;
    if (!this.el) {
      this.el = new Audio();
      this.el.loop = true;
      this.el.preload = 'auto';
      this.ctx = hasPlaybackSession() ? unlockAudio() : null;
      if (this.ctx) {
        this.gain = this.ctx.createGain();
        this.gain.gain.value = 0;
        this.ctx.createMediaElementSource(this.el).connect(this.gain).connect(masterBus(this.ctx));
      }
    }
    unlockAudio();
    if (track) {
      this.play(track, 0.6);
    } else if (this.el) {
      // Prime the element inside the gesture so later play() calls are allowed on iOS.
      this.el.src = bgmUrl('video11');
      this.el.play().then(
        () => {
          if (!this.track) this.el?.pause();
        },
        () => undefined,
      );
    }
  }

  set(track: string | null) {
    if (track === this.track) return;
    if (this.swapTimer) clearTimeout(this.swapTimer);
    if (!this.track || !this.el) {
      if (track) this.play(track, 1.2);
      return;
    }
    this.fadeTo(0, 0.9);
    this.swapTimer = setTimeout(() => {
      if (track) this.play(track, 1.2);
      else {
        this.el?.pause();
        this.track = null;
      }
    }, 950);
  }

  fadeOut(seconds = 2.5) {
    this.fadeTo(0, seconds);
    this.track = null;
    if (this.swapTimer) clearTimeout(this.swapTimer);
    this.swapTimer = setTimeout(() => this.el?.pause(), seconds * 1000 + 100);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.el) this.el.muted = m && !this.gain;
    if (this.track) this.fadeTo(m ? 0 : bgmLevel(this.track), 0.3);
  }

  dispose() {
    if (this.swapTimer) clearTimeout(this.swapTimer);
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    this.el?.pause();
    this.gain?.disconnect(); // the shared AudioContext stays alive for the countdown sounds
    this.ctx = null;
    this.el = null;
    this.gain = null;
    this.track = null;
  }

  private play(track: string, fadeIn: number) {
    if (!this.el) return;
    this.track = track;
    this.el.src = bgmUrl(track);
    this.el.currentTime = 0;
    this.el.play().catch(() => undefined);
    if (this.gain && this.ctx) {
      this.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.gain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    if (!this.gain) this.el.volume = 0;
    this.fadeTo(this.muted ? 0 : bgmLevel(track), fadeIn);
  }

  private fadeTo(v: number, seconds: number) {
    if (!this.gain || !this.ctx) {
      // Plain element: step the volume (no-op on iOS where volume is fixed at 1).
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
      return;
    }
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(v, t + seconds);
  }
}
