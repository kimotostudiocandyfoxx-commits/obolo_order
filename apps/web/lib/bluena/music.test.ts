import { describe, expect, it, vi } from 'vitest';
import { createMusic, DUCK_GAIN, IDLE, miniShown, musicStep, type MusicEngine, type Track } from './music';
import { bargeIn, onMic, onVoice, setSpeaking } from '@/lib/voice/barge';

const song: Track = { id: 'song:1', title: '夏の海のうた', url: 'https://x/a.mp3' };
const other: Track = { id: 'song:2', title: '夜のドライブ', url: 'https://x/b.mp3' };

/** a stand-in engine: plays from where it was told, its clock moved by hand */
function fake() {
  const e = { playing: null as Track | null, from: 0, clock: 0, g: 1, starts: 0, end: null as null | (() => void) };
  const engine: MusicEngine = {
    async start(t, from, g, onEnd) {
      e.playing = t;
      e.from = from;
      e.clock = 0;
      e.g = g;
      e.starts++;
      e.end = onEnd;
      return 120;
    },
    stop: () => void (e.playing = null),
    pos: () => e.from + e.clock,
    gain: (g) => void (e.g = g),
  };
  return { e, engine };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('R16: the music state machine', () => {
  it('play → playing; pause; resume; close', () => {
    let s = musicStep(IDLE, { t: 'play', track: song });
    expect(s.status).toBe('loading');
    s = musicStep(s, { t: 'loaded', dur: 120 });
    expect(s).toMatchObject({ status: 'playing', dur: 120 });
    s = musicStep(s, { t: 'tick', at: 30 });
    s = musicStep(s, { t: 'pause' });
    expect(s).toMatchObject({ status: 'paused', at: 30 });
    s = musicStep(s, { t: 'resume' });
    expect(s).toMatchObject({ status: 'loading', at: 30 });
    s = musicStep(s, { t: 'close' });
    expect(s).toEqual(IDLE);
  });
  it('the corner player shows while something plays or is paused, not over its own viewer', () => {
    let s = musicStep(musicStep(IDLE, { t: 'play', track: song }), { t: 'loaded', dur: 60 });
    expect(miniShown(s)).toBe(true);
    s = musicStep(s, { t: 'viewer', open: true });
    expect(miniShown(s)).toBe(false);
    s = musicStep(s, { t: 'viewer', open: false });
    s = musicStep(s, { t: 'pause' });
    expect(miniShown(s)).toBe(true);
    expect(miniShown(musicStep(s, { t: 'close' }))).toBe(false);
  });
  it('the mic and another sound pause it; a voice only ducks it', () => {
    const on = musicStep(musicStep(IDLE, { t: 'play', track: song }), { t: 'loaded', dur: 60 });
    expect(musicStep(on, { t: 'mic' }).status).toBe('paused');
    expect(musicStep(on, { t: 'other' }).status).toBe('paused');
    const d = musicStep(on, { t: 'duck', on: true });
    expect(d).toMatchObject({ status: 'playing', ducked: true });
    // the end: paused at the start, ▶ plays it again
    expect(musicStep(on, { t: 'ended' })).toMatchObject({ status: 'paused', at: 0 });
  });
});

describe('R16: the music driver over its engine', () => {
  it('plays, pauses where it is, goes on from there, closes', async () => {
    const { e, engine } = fake();
    const m = createMusic(engine);
    m.play(song);
    await flush();
    expect(m.get().status).toBe('playing');
    expect(e.playing?.id).toBe('song:1');
    e.clock = 42;
    m.pause();
    expect(m.get()).toMatchObject({ status: 'paused', at: 42 });
    expect(e.playing).toBeNull();
    m.toggle();
    await flush();
    expect(e.from).toBe(42);
    expect(m.get().status).toBe('playing');
    // the same track again does not start over
    m.play(song);
    expect(e.starts).toBe(2);
    // another track replaces it
    m.play(other);
    await flush();
    expect(e.playing?.id).toBe('song:2');
    m.close();
    expect(m.get().track).toBeNull();
    expect(e.playing).toBeNull();
  });
  it('ducks under a voice and comes back; a track started while a voice speaks starts low', async () => {
    const { e, engine } = fake();
    const m = createMusic(engine);
    m.play(song);
    await flush();
    m.duck(true);
    expect(e.g).toBe(DUCK_GAIN);
    m.duck(false);
    expect(e.g).toBe(1);
    m.duck(true);
    m.play(other);
    await flush();
    expect(e.g).toBe(DUCK_GAIN);
  });
  it('the end of the song: paused at its start', async () => {
    const { e, engine } = fake();
    const m = createMusic(engine);
    m.play(song);
    await flush();
    e.end?.();
    expect(m.get()).toMatchObject({ status: 'paused', at: 0 });
  });
  it("barge-in: {bati}'s voice starting / ending is told (duck), the mic is told (pause), typing is not", async () => {
    const { engine } = fake();
    const m = createMusic(engine);
    const offV = onVoice((on) => m.duck(on));
    const offM = onMic(() => m.mic());
    m.play(song);
    await flush();
    setSpeaking({ stop: vi.fn() });
    expect(m.get().ducked).toBe(true);
    setSpeaking(null);
    expect(m.get().ducked).toBe(false);
    setSpeaking({ stop: vi.fn() });
    // typing takes the turn: the voice stops (the music comes back up), the music plays on
    bargeIn();
    expect(m.get()).toMatchObject({ status: 'playing', ducked: false });
    // the mic: one mic — the music pauses
    bargeIn({ mic: true });
    expect(m.get().status).toBe('paused');
    offV();
    offM();
  });
});
