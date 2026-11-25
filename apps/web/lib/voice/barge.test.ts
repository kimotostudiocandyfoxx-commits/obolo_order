import { describe, expect, it, vi } from 'vitest';
import { BARGE_FADE_MS, bargeIn, isSpeaking, onBargeIn, setSpeaking } from './barge';

/** a stand-in audio element: plays until stopped, remembers how (a fade or a cut) */
function fakeAudio() {
  const a = { playing: true, fadedMs: null as number | null, stop: (ms?: number) => ((a.playing = false), (a.fadedMs = ms ?? 0)) };
  return a;
}
/** a stand-in talk: one line being said (its words partly out), lines queued after it */
function fakeTalk(line: string) {
  const t = { shown: line.slice(0, 3), queued: ['つぎの言葉', 'そのつぎ'], spoken: [] as string[], history: [] as string[] };
  const off = onBargeIn(() => {
    t.shown = line;
    t.history.push(...t.queued);
    t.queued = [];
  });
  return { t, off };
}

describe('R14 (client 2026-11-25): barge-in — the mic takes the turn while a voice speaks', () => {
  it('the voice fades out in 80 ms, the line shows whole, the queued lines stay as words (unspoken)', () => {
    const audio = fakeAudio();
    setSpeaking(audio);
    const { t, off } = fakeTalk('こんにちは、今日はなにを作る？');
    expect(isSpeaking()).toBe(true);
    bargeIn();
    expect(audio.playing).toBe(false);
    expect(audio.fadedMs).toBe(BARGE_FADE_MS);
    expect(BARGE_FADE_MS).toBe(80);
    expect(t.shown).toBe('こんにちは、今日はなにを作る？');
    expect(t.queued).toEqual([]);
    expect(t.history).toEqual(['つぎの言葉', 'そのつぎ']);
    expect(t.spoken).toEqual([]);
    expect(isSpeaking()).toBe(false);
    off();
  });

  it('the next reply’s voice plays as usual (the stop does not stick)', () => {
    bargeIn();
    const next = fakeAudio();
    setSpeaking(next);
    expect(isSpeaking()).toBe(true);
    expect(next.playing).toBe(true);
    // a second barge-in stops only that one
    bargeIn();
    expect(next.fadedMs).toBe(80);
  });

  it('nothing playing: the talks still drop what was queued; a talk that is gone is not called', () => {
    const fn = vi.fn();
    const off = onBargeIn(fn);
    bargeIn();
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    bargeIn();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
