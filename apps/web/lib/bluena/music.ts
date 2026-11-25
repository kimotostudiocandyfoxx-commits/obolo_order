/**
 * R16 (client 2026-11-25): a song from Bluena keeps playing. The viewer plays it; when the viewer closes (or you go back
 * to a talk) a small player stays in the corner (▶/❚❚, its title, ✕) and the song goes on across the Moon's screens.
 * It lives beside {bati}'s voice: while a voice speaks the music is turned down (ducked) and comes back after; the mic
 * pressed (barge-in, one mic) pauses it, so the mic hears only you; any other sound started (a card's ▶, lib/audio)
 * pauses it too (one music at a time). The state machine is plain (musicStep); the driver (createMusic) runs it over an
 * engine — the browser's (musicEngine.ts) or the tests' stand-in. No DOM here.
 */
export type Track = {
  /** the work's key (its kind and id): the viewer of this track shows the big player, not the corner one */
  id: string;
  title: string;
  /** a sound file (https:, idb:, blob:) */
  url?: string;
  /** the demo's song sketch (lib/synth's preset) */
  demo?: unknown;
  image?: string | null;
  /** its length when known before it is loaded (the demo's sketch loops: its nominal length) */
  seconds?: number;
};

export type MusicStatus = 'idle' | 'loading' | 'playing' | 'paused';
export type MusicState = {
  track: Track | null;
  status: MusicStatus;
  /** where it is (seconds) and how long it is */
  at: number;
  dur: number;
  /** a voice is speaking: the music is low */
  ducked: boolean;
  /** the viewer of this track is open (the corner player hides) */
  viewer: boolean;
};

export type MusicEvent =
  | { t: 'play'; track: Track }
  | { t: 'loaded'; dur: number }
  | { t: 'failed' }
  | { t: 'pause' }
  | { t: 'resume' }
  | { t: 'close' }
  | { t: 'ended' }
  | { t: 'tick'; at: number }
  | { t: 'seek'; at: number }
  | { t: 'duck'; on: boolean }
  /** the mic was pressed (barge-in): one mic — the music pauses */
  | { t: 'mic' }
  /** another sound started (lib/audio, a card's ▶) */
  | { t: 'other' }
  | { t: 'viewer'; open: boolean };

export const IDLE: MusicState = { track: null, status: 'idle', at: 0, dur: 0, ducked: false, viewer: false };
/** how low the music goes while {bati} speaks */
export const DUCK_GAIN = 0.22;
export const gainOf = (s: Pick<MusicState, 'ducked'>) => (s.ducked ? DUCK_GAIN : 1);
/** the corner player shows: something is playing or paused, and its own viewer is not open */
export const miniShown = (s: MusicState) => !!s.track && s.status !== 'idle' && !s.viewer;
export const isOn = (s: MusicState) => s.status === 'playing' || s.status === 'loading';

export function musicStep(s: MusicState, e: MusicEvent): MusicState {
  switch (e.t) {
    case 'play':
      return { ...s, track: e.track, status: 'loading', at: 0, dur: e.track.seconds ?? 0 };
    case 'loaded':
      return s.status === 'loading' ? { ...s, status: 'playing', dur: e.dur || s.dur } : s;
    case 'failed':
      return s.track ? { ...s, status: 'paused', at: 0 } : s;
    case 'pause':
      return s.status === 'playing' || s.status === 'loading' ? { ...s, status: 'paused' } : s;
    case 'resume':
      return s.track && s.status === 'paused' ? { ...s, status: 'loading', at: s.dur && s.at >= s.dur - 0.25 ? 0 : s.at } : s;
    case 'close':
      return { ...IDLE, ducked: s.ducked };
    case 'ended':
      return s.track ? { ...s, status: 'paused', at: 0 } : s;
    case 'tick':
      return s.status === 'playing' ? { ...s, at: Math.max(0, s.dur ? Math.min(s.dur, e.at) : e.at) } : s;
    case 'seek':
      return s.track ? { ...s, at: Math.max(0, s.dur ? Math.min(s.dur, e.at) : e.at) } : s;
    case 'duck':
      return { ...s, ducked: e.on };
    case 'mic':
    case 'other':
      return isOn(s) ? { ...s, status: 'paused' } : s;
    case 'viewer':
      return { ...s, viewer: e.open };
  }
}

/** what plays the sound (the browser's Web Audio / synth, or a stand-in) */
export interface MusicEngine {
  /** start the track at `from` seconds with the gain; its length (seconds), or null when it cannot play */
  start(track: Track, from: number, gain: number, onEnd: () => void): Promise<number | null>;
  /** stop it where it is */
  stop(): void;
  /** where it is now (seconds) */
  pos(): number;
  gain(g: number): void;
}

export type Music = ReturnType<typeof createMusic>;

/** the driver: the state, its listeners, and the engine kept in step with it */
export function createMusic(engine: MusicEngine) {
  let s: MusicState = IDLE;
  let seq = 0;
  const ls = new Set<(s: MusicState) => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  const set = (e: MusicEvent) => {
    const next = musicStep(s, e);
    if (next === s) return s;
    s = next;
    for (const l of [...ls]) l(s);
    return s;
  };
  const tickOn = (on: boolean) => {
    if (timer) clearInterval(timer);
    timer = null;
    if (on) timer = setInterval(() => set({ t: 'tick', at: engine.pos() }), 250);
  };
  const begin = async (from: number) => {
    const g = ++seq;
    const t = s.track;
    if (!t) return;
    const dur = await engine.start(t, from, gainOf(s), () => {
      if (g !== seq) return;
      tickOn(false);
      set({ t: 'ended' });
    });
    if (g !== seq) return;
    if (dur == null) {
      tickOn(false);
      set({ t: 'failed' });
      return;
    }
    set({ t: 'loaded', dur });
    if (s.status === 'playing') tickOn(true);
  };
  const halt = () => {
    seq++;
    tickOn(false);
    engine.stop();
  };
  const pauseHere = (e: MusicEvent) => {
    if (!isOn(s)) return;
    const at = engine.pos();
    halt();
    set({ t: 'tick', at });
    set(e);
  };
  return {
    get: () => s,
    subscribe(l: (s: MusicState) => void) {
      ls.add(l);
      return () => void ls.delete(l);
    },
    /** play a track (the same one paused: on from where it was) */
    play(track: Track) {
      if (s.track?.id === track.id && s.status === 'paused') return this.resume();
      if (s.track?.id === track.id && isOn(s)) return;
      halt();
      set({ t: 'play', track });
      void begin(0);
    },
    pause: () => pauseHere({ t: 'pause' }),
    resume() {
      if (!s.track || s.status !== 'paused') return;
      set({ t: 'resume' });
      void begin(s.at);
    },
    toggle() {
      if (isOn(s)) this.pause();
      else this.resume();
    },
    seek(at: number) {
      if (!s.track) return;
      const on = isOn(s);
      if (on) halt();
      set({ t: 'seek', at });
      if (on) {
        // (the status goes back through loading)
        s = { ...s, status: 'paused' };
        this.resume();
      }
    },
    close() {
      halt();
      set({ t: 'close' });
    },
    /** a voice speaks / stopped: the music goes low / back */
    duck(on: boolean) {
      set({ t: 'duck', on });
      engine.gain(gainOf(s));
    },
    /** the mic was pressed (one mic) */
    mic: () => pauseHere({ t: 'mic' }),
    /** another sound started */
    other: () => pauseHere({ t: 'other' }),
    viewer: (open: boolean) => void set({ t: 'viewer', open }),
  };
}
