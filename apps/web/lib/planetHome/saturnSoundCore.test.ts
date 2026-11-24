import { describe, expect, it } from 'vitest';
import { decodable, duck, MUSIC_DUCKED, MUSIC_GAIN, playBuffer, popSound, VOICE_DELAY_MS } from './saturnSoundCore';

/** a stand-in AudioContext: records the nodes made and started, and the scheduled gain values */
function fakeContext() {
  const log = { started: [] as { kind: string; duration?: number; at?: number }[], sched: [] as [string, number, number][], freq: [] as [string, number, number][] };
  const param = (name: string, value = 1) => ({
    value,
    setValueAtTime: (v: number, t: number) => void log.sched.push([`${name}.set`, v, t]),
    exponentialRampToValueAtTime: (v: number, t: number) => void log.sched.push([`${name}.exp`, v, t]),
    setTargetAtTime: (v: number, t: number) => void log.sched.push([`${name}.target`, v, t]),
    cancelScheduledValues: (t: number) => void log.sched.push([`${name}.cancel`, 0, t]),
  });
  const node = () => ({ connect: () => undefined });
  const c = {
    currentTime: 10,
    sampleRate: 48000,
    destination: node(),
    createOscillator: () => {
      const f = param('freq', 440);
      const o = {
        ...node(),
        type: 'sine',
        frequency: { ...f, setValueAtTime: (v: number, t: number) => void log.freq.push(['set', v, t]), exponentialRampToValueAtTime: (v: number, t: number) => void log.freq.push(['exp', v, t]) },
        start: (at: number) => void log.started.push({ kind: 'osc', at }),
        stop: () => undefined,
      };
      return o;
    },
    createGain: () => ({ ...node(), gain: param('gain') }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param('f'), Q: param('q') }),
    createBuffer: (_ch: number, len: number, rate: number) => ({ duration: len / rate, getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => {
      const s: { buffer: { duration: number } | null; connect: () => void; start: (at?: number) => void } = {
        buffer: null,
        connect: () => undefined,
        start: (at?: number) => void log.started.push({ kind: 'buffer', duration: s.buffer?.duration, at }),
      };
      return s;
    },
  };
  return { c: c as unknown as BaseAudioContext, log };
}

describe('M-R275: Saturn’s sounds (mocked Web Audio)', () => {
  it('the pop: a sine 520→1900 Hz over 45 ms and 30 ms of noise through a 4200 Hz band', () => {
    const { c, log } = fakeContext();
    popSound(c);
    expect(log.freq[0]).toEqual(['set', 520, 10.005]);
    expect(log.freq[1][1]).toBe(1900);
    expect(log.freq[1][2]).toBeCloseTo(10.05, 5);
    const noise = log.started.find((s) => s.kind === 'buffer');
    expect(noise?.duration).toBeCloseTo(0.03, 3);
  });
  it('club mode: 7 pops give 7 voices, 300 ms after each pop; the music dips to 0.16 and comes back to 0.5 after each', () => {
    const { c, log } = fakeContext();
    const music = (c as unknown as { createGain: () => { gain: AudioParam } }).createGain().gain;
    const voice = { duration: 1.8 } as AudioBuffer;
    const pops: number[] = [];
    // the club's timer: the first at 2.2 s, then every 3.7 s — each pop sounds, then its voice after VOICE_DELAY_MS
    for (let k = 0; k < 7; k++) {
      pops.push(2200 + k * 3700);
      popSound(c);
      playBuffer(c, voice, c.destination, music);
    }
    const voices = log.started.filter((s) => s.kind === 'buffer' && (s.duration ?? 0) > 0.2);
    expect(voices).toHaveLength(7);
    expect(VOICE_DELAY_MS).toBe(300);
    const targets = log.sched.filter(([n]) => n === 'gain.target');
    expect(targets.filter(([, v]) => v === MUSIC_DUCKED)).toHaveLength(7);
    expect(targets.filter(([, v]) => v === MUSIC_GAIN)).toHaveLength(7);
    // back up after the voice's length + 0.1 s
    expect(targets.find(([, v]) => v === MUSIC_GAIN)![2]).toBeCloseTo(10 + 1.8 + 0.1, 5);
  });
  it('a dip on its own; the read-aloud words of the lab are not decodable', () => {
    const { c, log } = fakeContext();
    const g = (c as unknown as { createGain: () => { gain: AudioParam } }).createGain().gain;
    duck(c, g, 2);
    expect(log.sched.map(([n, v]) => [n, v])).toEqual([
      ['gain.cancel', 0],
      ['gain.target', 0.16],
      ['gain.target', 0.5],
    ]);
    expect(decodable('tts:こんにちは')).toBe(false);
    expect(decodable('https://cdn.example/voice.mp3')).toBe(true);
    expect(decodable(null)).toBe(false);
  });
});
