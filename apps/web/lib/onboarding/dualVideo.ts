'use client';

/**
 * Two stacked <video> elements used as a double buffer so the screen never goes black and never
 * flashes a stale frame:
 *  - the next motion loads and starts in the hidden element while the current one stays on screen;
 *  - the elements swap only once the new one has actually rendered a frame;
 *  - loops restart in the other element (pre-loaded at 0:00) instead of using the `loop` attribute,
 *    which on iOS Safari shows a black frame at the seam.
 */
type VideoWithRvfc = HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };

export interface DualVideoCallbacks {
  /** A play-once motion reached its end (the last frame stays on screen). */
  onEnded: () => void;
  /** play() was refused or the file failed (show a "tap to continue"). */
  onBlocked: () => void;
  /** A new motion is now visible. */
  onShown: (url: string) => void;
  /**
   * A play-once motion is about to end (NEAR_END seconds left): the next background motion of a chain starts now, under
   * its last frames, and dissolves in (client 2026-11-28: OBOLON's universe froze at each join).
   */
  onNearEnd?: () => void;
}

/** how long before a play-once motion's end onNearEnd is told (s) — a little more than the dissolve */
export const NEAR_END = 0.9;

export class DualVideo {
  private front = 0;
  private token = 0;
  private loop = false;
  private url: string | null = null;
  private muted = false;
  private pending: HTMLVideoElement | null = null;
  /** the motion coming up (preload) */
  private next: string | null = null;
  /** the watch over a play-once motion (story chat 2026-10-29: a load that stalls must never stop the story) */
  private watch: ReturnType<typeof setTimeout> | undefined;
  private endedFor = -1;
  /** the dissolve of the motion being shown (s; 0 = a cut) */
  private xfade = 0;
  private fadeTimer: ReturnType<typeof setTimeout> | undefined;
  private nearFor = -1;

  constructor(
    private readonly els: [HTMLVideoElement, HTMLVideoElement],
    private readonly cb: DualVideoCallbacks,
  ) {
    for (const el of els) {
      el.loop = false;
      el.playsInline = true;
      el.addEventListener('ended', () => this.handleEnded(el));
      el.addEventListener('timeupdate', () => {
        if (el !== this.frontEl || this.loop || this.pending || this.nearFor === this.token || !this.cb.onNearEnd) return;
        if (el.dataset.src !== this.url || !isFinite(el.duration) || el.duration <= 0) return;
        if (el.duration - el.currentTime <= NEAR_END) {
          this.nearFor = this.token;
          this.cb.onNearEnd();
        }
      });
      el.addEventListener('error', () => {
        if (el === this.pending || el === this.frontEl) this.cb.onBlocked();
      });
    }
    this.applyLayers();
  }

  private get frontEl() {
    return this.els[this.front];
  }
  private get backEl() {
    return this.els[1 - this.front];
  }

  /** Must run inside the first user gesture: lets both elements play with sound later (iOS). */
  unlock(firstUrl: string) {
    for (const el of this.els) {
      if (!el.dataset.src) this.setSrc(el, firstUrl);
      const p = el.play();
      el.pause();
      p?.catch(() => undefined);
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    for (const el of this.els) el.muted = m || (this.loop && el === this.frontEl);
  }

  /**
   * Show a motion. freeze = show its last frame without playing (resuming mid-story). xfade = seconds the new motion
   * dissolves in over the one on screen, which plays on under it (consecutive background motions, 2026-11-28).
   */
  show(url: string, loop: boolean, freeze = false, xfade = 0) {
    const t = ++this.token;
    this.loop = loop;
    this.xfade = freeze ? 0 : xfade;
    this.url = url;
    const el = this.backEl;
    this.pending = el;
    // a loop's own sound repeating every few seconds stood out (the HQ gate, client 2026-10-26): loops are silent
    el.muted = this.muted || loop;
    this.setSrc(el, url);

    clearTimeout(this.watch);
    // not on screen 8 s after asked: offer 〔タップして続ける〕
    if (!loop && !freeze)
      this.watch = setTimeout(() => {
        if (t === this.token && this.pending === el) this.cb.onBlocked();
      }, 8000);
    if (freeze) {
      const seek = () => {
        el.currentTime = Math.max(0, (el.duration || 0) - 0.05);
      };
      el.addEventListener('seeked', () => t === this.token && this.swapTo(el), { once: true });
      if (el.readyState >= 1) seek();
      else el.addEventListener('loadedmetadata', seek, { once: true });
      return;
    }
    this.startIn(el, t);
  }

  /**
   * Start loading the motion that comes next in the hidden element while a play-once motion is on screen,
   * so the next one starts the instant this one ends (the crane's flight stalled between its clips while
   * each file was fetched — client 2026-10-22). Not during a loop: the hidden element holds its restart.
   */
  preload(url: string) {
    this.next = url;
    this.loadNext();
  }

  private loadNext() {
    // not while the motion before dissolves out in the hidden element: after (the fade's timer)
    if (!this.next || this.loop || this.pending || this.next === this.url || this.fadeTimer !== undefined) return;
    this.setSrc(this.backEl, this.next);
  }

  /** Retry after onBlocked (call from a tap). Returns false if the file itself is broken. */
  retry(): boolean {
    const el = this.pending ?? this.frontEl;
    // broken, or still nothing loaded after the wait: the caller goes past it
    if (el.error || el.readyState < 2) return false;
    this.startIn(el, this.token);
    return true;
  }

  pauseAll() {
    this.token++;
    clearTimeout(this.watch);
    this.endFade();
    for (const el of this.els) el.pause();
  }

  dispose() {
    this.pauseAll();
    for (const el of this.els) {
      el.removeAttribute('src');
      el.load();
    }
  }

  private setSrc(el: HTMLVideoElement, url: string) {
    if (el.dataset.src !== url) {
      el.src = url;
      el.dataset.src = url;
      el.preload = 'auto';
    }
  }

  private startIn(el: HTMLVideoElement, t: number) {
    try {
      el.currentTime = 0;
    } catch {
      /* not seekable yet — it starts at 0 anyway */
    }
    const p = el.play();
    const go = () => this.whenFrame(el, () => t === this.token && this.swapTo(el));
    if (p) p.then(go, () => t === this.token && this.cb.onBlocked());
    else go();
  }

  /** Wait until the element has really painted a frame of the new source. */
  private whenFrame(el: VideoWithRvfc, done: () => void) {
    if (el.requestVideoFrameCallback) {
      el.requestVideoFrameCallback(() => done());
      return;
    }
    const check = () => {
      if (el.currentTime > 0 && el.readyState >= 2) done();
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  private swapTo(el: HTMLVideoElement) {
    const idx = this.els.indexOf(el);
    if (idx < 0) return;
    const old = this.els[1 - idx];
    if (idx !== this.front) {
      this.front = idx;
      this.endFade(false);
      if (this.xfade > 0 && old.dataset.src) {
        // the dissolve: the new motion fades in on top while the one before plays out its last frames beneath
        el.style.transition = 'none';
        el.style.opacity = '0';
        this.applyLayers();
        void el.offsetWidth;
        el.style.transition = `opacity ${this.xfade}s linear`;
        el.style.opacity = '1';
        this.fadeTimer = setTimeout(() => {
          this.fadeTimer = undefined;
          el.style.transition = '';
          if (el === this.frontEl) old.pause();
          this.loadNext();
          if (this.loop && this.url && el === this.frontEl) this.primeLoop(old);
        }, this.xfade * 1000 + 50);
      } else {
        el.style.opacity = '1';
        this.applyLayers();
        old.pause();
      }
    }
    this.pending = null;
    if (this.url) this.cb.onShown(this.url);
    // playing, but stalled before its end: the story goes on 6 s after it should have ended
    if (!this.loop) {
      const t = this.token;
      clearTimeout(this.watch);
      const left = isFinite(el.duration) && el.duration > 0 ? el.duration - el.currentTime : 20;
      this.watch = setTimeout(() => t === this.token && this.finish(), (left + 6) * 1000);
    }
    this.loadNext();
    // Pre-load the same motion at 0:00 in the hidden element for a seamless loop restart (after a dissolve: at its end).
    if (this.loop && this.url && this.fadeTimer === undefined) this.primeLoop(old);
  }

  private primeLoop(old: HTMLVideoElement) {
    if (!this.url) return;
    this.setSrc(old, this.url);
    // a loop never sounds: the hidden element may still carry the sound of the motion it played before
    old.muted = this.muted || this.loop;
    try {
      old.currentTime = 0;
    } catch {
      /* ignore */
    }
  }

  private handleEnded(el: HTMLVideoElement) {
    if (el !== this.frontEl) return;
    // the motion before, still on screen while the next one loads, came to its end (a loop at its seam): that is
    // not the end of the new one — keep its last frame (Day 1: MONBAN's arrival was skipped when the gate's loop
    // ended before his film had loaded, client 2026-10-29)
    if (this.pending && this.pending !== el && el.dataset.src !== this.url) return;
    if (this.loop && this.url) {
      this.xfade = 0; // a loop restarts with a cut on the same frame
      const next = this.backEl;
      this.pending = next;
      this.setSrc(next, this.url);
      next.muted = this.muted || this.loop;
      this.startIn(next, this.token);
      return;
    }
    this.finish();
  }

  /** a dissolve in progress ends at once (the next motion is coming, or everything stops) */
  private endFade(pauseBack = true) {
    if (this.fadeTimer === undefined) return;
    clearTimeout(this.fadeTimer);
    this.fadeTimer = undefined;
    for (const el of this.els) {
      el.style.transition = '';
      el.style.opacity = '1';
      if (pauseBack && el !== this.frontEl && el !== this.pending) el.pause();
    }
  }

  /** a play-once motion is over (its end, or the watch): told once */
  private finish() {
    if (this.endedFor === this.token) return;
    this.endedFor = this.token;
    clearTimeout(this.watch);
    this.cb.onEnded();
  }

  private applyLayers() {
    // Only the stacking order changes: a hidden (visibility/display) video may not be decoded or
    // painted by iOS Safari, which would bring back the black flash. Both share the same frame, so
    // the front one fully covers the one behind it.
    this.els.forEach((el, i) => {
      el.style.zIndex = i === this.front ? '2' : '1';
    });
  }
}
