import { describe, expect, it } from 'vitest';
import { buildSongDesign, chordName, lineMelody, mockSongDesign, morae, parseComposeChat } from './song';

describe('morae', () => {
  it('joins small kana, keeps っ ん ー as their own, katakana becomes hiragana', () => {
    expect(morae('きょうは ラーメン')).toEqual(['きょ', 'う', 'は', null, 'ら', 'ー', 'め', 'ん']);
    expect(morae('がっこう')).toEqual(['が', 'っ', 'こ', 'う']);
  });
});

describe('melody', () => {
  it('one note per mora, fills exactly 2 bars, stays in key and range', () => {
    const notes = lineMelody('きょうも いちにち はじまるよ', { root: 0, scale: 'major', progression: [0, 4, 5, 3], barOffset: 0, section: 'verse', seed: 'x' });
    expect(notes.reduce((a, n) => a + n.beats, 0)).toBe(8);
    expect(notes.filter((n) => n.kana).map((n) => n.kana).join('')).toBe('きょうもいちにちはじまるよ');
    for (const n of notes) if (n.midi !== null) {
      expect([0, 2, 4, 5, 7, 9, 11]).toContain(n.midi % 12);
      expect(n.midi).toBeGreaterThanOrEqual(59);
      expect(n.midi).toBeLessThanOrEqual(69);
    }
  });
  it('long lines get 4 bars', () => {
    const notes = lineMelody('あいうえおかきくけこさしすせそたちつ', { root: 9, scale: 'minor', progression: [0, 5, 2, 6], barOffset: 0, section: 'chorus', seed: 'y' });
    expect(notes.reduce((a, n) => a + n.beats, 0)).toBe(16);
  });
});

describe('song design', () => {
  it('builds a full design from a model answer', () => {
    const d = buildSongDesign(mockSongDesign('今日はラーメンを食べた'), { name: 'KIMORIN', isBati: false }, 'auto');
    expect(d.title).toContain('のうた');
    expect(d.chords).toEqual(['C', 'G', 'Am', 'F']);
    expect(d.sections.map((s) => s.name)).toEqual(['verse', 'chorus']);
    expect(d.seconds).toBeGreaterThan(20);
  });
  it('rejects an answer without lyrics', () => {
    expect(() => buildSongDesign('{"title":"x"}', { name: 'KIMORIN', isBati: false }, 'pop')).toThrow();
  });
  it('chord names', () => {
    expect(chordName(9, 'minor', 0)).toBe('Am');
    expect(chordName(0, 'major', 6)).toBe('Bdim');
  });
  it('chat answer parsing tolerates fences and plain text', () => {
    expect(parseComposeChat('```json\n{"reply":"いいね！","ready":true}\n```')).toEqual({ reply: 'いいね！', ready: true });
    expect(parseComposeChat('ふつうの返事')).toEqual({ reply: 'ふつうの返事', ready: false });
  });
});

import { geminiContents } from './providers';
describe('gemini contents', () => {
  it('moves the leading greeting into the system text and merges same-side lines', () => {
    const r = geminiContents({
      system: 'S',
      history: [
        { role: 'assistant', text: 'やあ' },
        { role: 'user', text: 'a' },
        { role: 'user', text: 'b' },
        { role: 'assistant', text: 'c' },
      ],
    });
    expect(r.system).toContain('やあ');
    expect(r.contents).toEqual([
      { role: 'user', parts: [{ text: 'a\nb' }] },
      { role: 'model', parts: [{ text: 'c' }] },
    ]);
  });
});
