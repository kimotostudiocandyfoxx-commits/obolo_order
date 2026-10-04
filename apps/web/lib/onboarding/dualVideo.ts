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
}

export class DualVideo {
  private front = 0;
  private token = 0;
  private loop = false;
  private url: string | null = null;
  private muted = false;
  private pending: HTMLVideoElement | null = null;

  constructor(
    private readonly els: [HTMLVideoElement, HTMLVideoElement],
    private readonly cb: DualVideoCallbacks,
  ) {
    for (const el of els) {
      el.loop = false;
      el.playsInline = true;
      el.addEventListener('ended', () => this.handleEnded(el));
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
    for (const el of this.els) el.muted = m;
  }

  /** Show a motion. freeze = show its last frame without playing (resuming mid-story). */
  show(url: string, loop: boolean, freeze = false) {
    const t = ++this.token;
    this.loop = loop;
    this.url = url;
    const el = this.backEl;
    this.pending = el;
    el.muted = this.muted;
    this.setSrc(el, url);

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

  /** Retry after onBlocked (call from a tap). Returns false if the file itself is broken. */
  retry(): boolean {
    const el = this.pending ?? this.frontEl;
    if (el.error) return false;
    this.startIn(el, this.token);
    return true;
  }

  pauseAll() {
    this.token++;
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
      this.applyLayers();
      old.pause();
    }
    this.pending = null;
    if (this.url) this.cb.onShown(this.url);
    // Pre-load the same motion at 0:00 in the hidden element for a seamless loop restart.
    if (this.loop && this.url) {
      this.setSrc(old, this.url);
      try {
        old.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }

  private handleEnded(el: HTMLVideoElement) {
    if (el !== this.frontEl) return;
    if (this.loop && this.url) {
      const next = this.backEl;
      this.pending = next;
      this.setSrc(next, this.url);
      this.startIn(next, this.token);
      return;
    }
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
