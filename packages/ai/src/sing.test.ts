import { describe, expect, it } from 'vitest';
import { defaultSingDirection, parseSingDirection, singDirectionSystem, singText, type SingSong } from './sing';

const song: SingSong = {
  title: 'あさのうた',
  genre: 'pop',
  mood: 'わくわく',
  bpm: 120,
  sections: [
    { name: 'verse', lines: [{ text: 'あさのひかり' }, { text: 'まどをあけて' }] },
    { name: 'chorus', lines: [{ text: 'ラララ うたにしよう' }, { text: 'そらにとどけ' }] },
  ],
};

describe('sing direction', () => {
  it('asks with the lyrics and the marker', () => {
    const s = singDirectionSystem(song);
    expect(s.startsWith('SING_DIRECTION')).toBe(true);
    expect(s).toContain('ラララ うたにしよう');
  });

  it('clamps and cleans the model answer', () => {
    const d = parseSingDirection(
      '```json\n{"style":["Bright","[singing]","<b>x"],"sections":[{"name":"chorus","tags":["pitch up","energetic","sad","whisper"]}],"speed":3,"volume":-40,"breathEvery":9}\n```',
      song,
    );
    expect(d.style).toEqual(['bright']);
    expect(d.sections.find((s) => s.name === 'chorus')?.tags).toEqual(['pitch_up', 'energetic', 'sad']);
    // verse missing → default
    expect(d.sections.find((s) => s.name === 'verse')?.tags).toEqual([]);
    expect(d.speed).toBe(1.25);
    expect(d.volume).toBe(-6);
    expect(d.breathEvery).toBe(4);
  });

  it('falls back when the answer is not JSON', () => {
    expect(parseSingDirection('sorry', song)).toEqual(defaultSingDirection(song));
  });

  it('sends the instrumental key and tempo to Fish', () => {
    const t = singText({ ...song, keyRoot: 9, scale: 'minor' }, defaultSingDirection(song));
    expect(t.split('\n')[0]).toBe('[singing][key: A minor][tempo: 120 BPM][bright]');
    expect(singDirectionSystem({ ...song, keyRoot: 9, scale: 'minor' })).toContain('キー: A minor');
  });

  it('writes the text Fish sings', () => {
    const t = singText(song, { style: ['bright'], sections: [{ name: 'verse', tags: [] }, { name: 'chorus', tags: ['pitch_up', 'energetic'] }], speed: 1, volume: 0, breathEvery: 2 });
    expect(t).toBe('[singing][bright]\nあさのひかり\nまどをあけて [breath]\n[pitch_up][energetic] ラララ うたにしよう\nそらにとどけ [breath]');
  });
});
