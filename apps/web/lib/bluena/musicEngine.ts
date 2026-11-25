'use client';

import { useEffect, useState } from 'react';
import { audioCtx, masterBus, unlockAudio } from '@/lib/onboarding/audio';
import { stopAudio, subscribeAudio } from '@/lib/audio';
import { synth, type SynthPreset } from '@/lib/synth';
import { loadClip } from '@/lib/voice/webVoice';
import { onMic, onVoice } from '@/lib/voice/barge';
import { createMusic, IDLE, type MusicEngine, type MusicState, type Track } from './music';

/**
 * R16: Bluena's music in the browser — a decoded buffer on the shared AudioContext with a gain of its own (so it can go
 * low under {bati}'s voice, which plays through webVoice's one clip and never stops it), or the demo's song sketch on
 * lib/synth. One music app-wide (the module keeps it across the Moon's screens); hooked to the barge-in mic, to the
 * voices and to lib/audio's other sounds.
 */
function browserEngine(): MusicEngine {
  let node: { src: AudioBufferSourceNode; gain: GainNode; t0: number; from: number } | null = null;
  let demo: { t0: number; from: number; dur: number } | null = null;
  let el: HTMLAudioElement | null = null;
  let level = 1;
  const stop = () => {
    if (node) {
      const n = node;
      node = null;
      n.src.onended = null;
      try {
        n.src.stop();
      } catch {
        /* not started */
      }
    }
    if (demo) {
      demo = null;
      synth.stop(true);
    }
    if (el && !el.paused) el.pause();
  };
  return {
    async start(t: Track, from, g, onEnd) {
      stop();
      level = g;
      stopAudio();
      if (t.demo) {
        synth.play(t.demo as SynthPreset, undefined, { mine: true, level: g });
        synth.claim(() => {
          // someone else started the synth (a card's ▶)
          demo = null;
          music.other();
        });
        const dur = t.seconds ?? 120;
        demo = { t0: performance.now(), from: from % dur, dur };
        return dur;
      }
      if (!t.url) return null;
      const c = unlockAudio() ?? audioCtx();
      const buf = c ? await loadClip(t.url) : null;
      if (c && buf) {
        if (c.state !== 'running') await c.resume().catch(() => undefined);
        const src = c.createBufferSource();
        src.buffer = buf;
        const gain = c.createGain();
        gain.gain.value = g;
        src.connect(gain);
        gain.connect(masterBus(c));
        const at = Math.max(0, Math.min(buf.duration - 0.05, from));
        node = { src, gain, t0: c.currentTime, from: at };
        src.onended = () => {
          if (node?.src !== src) return;
          node = null;
          onEnd();
        };
        src.start(0, at);
        return buf.duration;
      }
      // no Web Audio (or the file could not be decoded): the element
      if (!el) el = new Audio();
      el.src = t.url;
      el.volume = g;
      el.currentTime = from;
      el.onended = onEnd;
      try {
        await el.play();
      } catch {
        return null;
      }
      return Number.isFinite(el.duration) ? el.duration : (t.seconds ?? 0);
    },
    stop,
    pos() {
      if (node) return node.from + (node.src.context.currentTime - node.t0);
      if (demo) return (demo.from + (performance.now() - demo.t0) / 1000) % demo.dur;
      if (el) return el.currentTime;
      return 0;
    },
    gain(g) {
      level = g;
      if (node) {
        const c = node.src.context;
        node.gain.gain.cancelScheduledValues(c.currentTime);
        node.gain.gain.setValueAtTime(node.gain.gain.value, c.currentTime);
        node.gain.gain.linearRampToValueAtTime(level, c.currentTime + 0.25);
      }
      if (demo) synth.setLevel(level);
      if (el) el.volume = level;
    },
  };
}

const noop: MusicEngine = { start: async () => null, stop: () => undefined, pos: () => 0, gain: () => undefined };
export const music = createMusic(typeof window === 'undefined' ? noop : browserEngine());

if (typeof window !== 'undefined') {
  // {bati}'s (or a ダチ's) voice speaks: the music low, then back
  onVoice((on) => music.duck(on));
  // one mic: the mic pressed pauses the music
  onMic(() => music.mic());
  // another sound started through lib/audio (a card's ▶, a voice message)
  subscribeAudio((st) => {
    if (st.playing && st.progress === 0) music.other();
  });
}

/** the music's state in a component */
export function useMusic(): MusicState {
  const [s, setS] = useState<MusicState>(() => (typeof window === 'undefined' ? IDLE : music.get()));
  useEffect(() => {
    setS(music.get());
    return music.subscribe(setS);
  }, []);
  return s;
}
