import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The player with a fake AudioContext (no sound here): nothing before the first tap, nothing when muted, the music
 * starts / stops with its scope, and it ducks under a work's own sound.
 */
class Param {
  value = 1;
  calls: [string, number][] = [];
  setValueAtTime(v: number) {
    this.calls.push(['set', v]);
    this.value = v;
  }
  setTargetAtTime(v: number) {
    this.calls.push(['target', v]);
    this.value = v;
  }
  exponentialRampToValueAtTime(v: number) {
    this.calls.push(['exp', v]);
  }
  linearRampToValueAtTime(v: number) {
    this.calls.push(['lin', v]);
  }
  cancelScheduledValues() {}
}
class Node {
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  type = '';
  buffer: unknown = null;
  constructor(public ctx: FakeCtx) {}
  get context() {
    return this.ctx;
  }
  connect() {}
  disconnect() {}
  start() {
    this.ctx.started++;
  }
  stop() {}
}
class FakeCtx {
  state = 'running';
  currentTime = 0;
  sampleRate = 8000;
  started = 0;
  destination = {};
  resume() {
    return Promise.resolve();
  }
  gains: Node[] = [];
  createGain() {
    const g = new Node(this);
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    return new Node(this);
  }
  createBiquadFilter() {
    return new Node(this);
  }
  createBufferSource() {
    return new Node(this);
  }
  createDynamicsCompressor() {
    const n = new Node(this) as Node & Record<string, Param>;
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param();
    return n;
  }
  createBuffer(_c: number, len: number) {
    const d = new Float32Array(len);
    return { getChannelData: () => d };
  }
}

const store = new Map<string, string>();
let ctx: FakeCtx;
let gestureListeners: (() => void)[] = [];

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  store.clear();
  gestureListeners = [];
  ctx = new FakeCtx();
  vi.stubGlobal('window', {
    AudioContext: function () {
      return ctx;
    },
    addEventListener: (t: string, f: () => void) => t === 'click' && gestureListeners.push(f),
    removeEventListener: () => undefined,
  });
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('document', { addEventListener: () => undefined, removeEventListener: () => undefined, visibilityState: 'visible' });
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const load = () => import('./sfx');
const tap = () => gestureListeners.forEach((f) => f());

describe('the planet sound player', () => {
  it('plays nothing before the first tap (no sound on page load), then plays', async () => {
    const s = await load();
    s.armPlanetSound();
    s.playSfx('chime');
    expect(ctx.started).toBe(0);
    tap();
    s.playSfx('chime');
    expect(ctx.started).toBe(3);
  });
  it('plays nothing while the talk’s 声を消す is on', async () => {
    store.set('obolo.talk.muted', '1');
    const s = await load();
    s.armPlanetSound();
    tap();
    s.playSfx('pop');
    s.startMusic('club');
    expect(ctx.started).toBe(0);
    expect(s.clubBeat()).toBeNull();
  });
  it('a scope plays the later cues on timers and stops them (and its music) when it ends', async () => {
    const s = await load();
    s.armPlanetSound();
    tap();
    const sc = s.soundScope();
    // Jupiter's tap (M-R337): the wings at once — six beats and three notes — and the scroll's pop 120 ms later (stopped below)
    sc.cue('jupiter', 'tap');
    const afterChime = ctx.started;
    expect(afterChime).toBe(9);
    sc.stop();
    vi.advanceTimersByTime(500);
    expect(ctx.started).toBe(afterChime);
    sc.music('club');
    expect(s.clubBeat()).toBeNull();
    ctx.currentTime = 0.06;
    expect(s.clubBeat()).toBe(0);
    ctx.currentTime = 0.05 + 60 / 120 + 0.001; // the slowest club (120 BPM): one beat on whichever style was picked
    expect(s.clubBeat()).toBeGreaterThanOrEqual(1);
    sc.stop();
    expect(s.clubBeat()).toBeNull();
  });
  it('the festival is not a club (no beat for the kororins)', async () => {
    const s = await load();
    s.armPlanetSound();
    tap();
    s.startMusic('festival');
    expect(s.clubBeat()).toBeNull();
    s.stopMusic();
  });
  it('the music dips under a voice, goes quiet under a song and comes back after', async () => {
    class Media {
      muted = false;
      volume = 1;
      paused = true;
      ended = false;
      loop = false;
      duration = 2;
      h = new Map<string, (e: unknown) => void>();
      addEventListener(t: string, f: (e: unknown) => void) {
        this.h.set(t, f);
      }
      fire(t: string) {
        this.h.get(t)?.({ type: t, target: this });
      }
    }
    vi.stubGlobal('HTMLMediaElement', Media);
    const s = await load();
    s.armPlanetSound();
    tap();
    s.startMusic('club');
    const out = ctx.gains.find((g) => g.gain.value === 0.5)!;
    expect(out).toBeTruthy();
    const voice = s.trackMedia(new Media() as unknown as HTMLMediaElement) as unknown as Media;
    voice.paused = false;
    voice.fire('playing');
    expect(out.gain.value).toBeCloseTo(0.16);
    const song = s.trackMedia(new Media() as unknown as HTMLMediaElement) as unknown as Media;
    song.loop = true;
    song.paused = false;
    song.fire('playing');
    expect(out.gain.value).toBe(0);
    song.paused = true;
    song.fire('pause');
    voice.paused = true;
    voice.fire('ended');
    expect(out.gain.value).toBe(0.5);
    s.stopMusic();
  });
});
