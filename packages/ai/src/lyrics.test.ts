import { describe, expect, it } from 'vitest';
import { lyricsFallback, spellFrom } from '@obolo/shared';
import { lyricsRequest, lyricsSystem, parseLyricsAnswer } from './prompts/lyrics';
import { parseModelSpec, TASK_MODEL_DEFAULTS } from './task';

const tags = spellFrom('song', '夏の海の明るい曲');

describe('R13: the lyrics writer (LYRICS_MODEL)', () => {
  it('a Flash-class chain by default', () => {
    expect(parseModelSpec(TASK_MODEL_DEFAULTS.lyrics)[0]).toEqual({ provider: 'gemini', model: 'gemini-2.5-flash', think: 0 });
  });
  it('offers only the engine’s tags, original lyrics only, JSON', () => {
    const s = lyricsSystem();
    expect(s).toMatch(/Pre-Chorus/);
    expect(s).toMatch(/whispered/);
    expect(s).toMatch(/Guitar Solo \(instrumental, no lines\)/);
    expect(s).toMatch(/Original lyrics only/);
    expect(s).toMatch(/"copy": true/);
    expect(s).not.toMatch(/\[Verse 1\]/);
  });
  it('an edit carries the lyrics as the engine reads them and the words', () => {
    const r = lyricsRequest({ mode: 'edit', said: 'サビをもっと明るく', tags, lyrics: lyricsFallback(tags) });
    expect(r).toContain('[Chorus - harmonies]');
    expect(r).toContain('サビをもっと明るく');
    expect(lyricsRequest({ mode: 'own', said: 'あさのひかり', tags })).toMatch(/keep their words/);
  });
  it('reads the answer (fenced JSON too) and the copy flag', () => {
    const a = parseLyricsAnswer('```json\n{"title":"夏","copy":false,"blocks":[{"tag":"Intro","lines":[]},{"tag":"Verse","lines":["あさ","ひかり"]},{"tag":"Chorus","hints":["harmonies","shiny"],"lines":["うた"]}]}\n```');
    expect(a.copy).toBe(false);
    expect(a.lyrics?.blocks.map((b) => b.section)).toEqual(['intro', 'verse', 'chorus']);
    expect(a.lyrics?.blocks[2].hints).toEqual(['harmonies']);
    expect(parseLyricsAnswer('{"copy":true,"blocks":[{"tag":"Verse","lines":["あたらしい"]}]}').copy).toBe(true);
    expect(parseLyricsAnswer('nonsense').lyrics).toBeNull();
  });
});

import { parseSongTweak, songTweakSystem } from './prompts/songTweak';
describe('R13: free song changes by the model (when the rules did not understand)', () => {
  it('reads valid ops only; a studio change is paid', () => {
    expect(songTweakSystem()).toMatch(/karaoke = instrumental/);
    expect(parseSongTweak('{"ops":[{"op":"tempo","factor":1.1},{"op":"tempo","factor":9},{"op":"cut","part":{"cycle":2}}],"paid":null}').ops).toEqual([{ op: 'tempo', factor: 1.1 }, { op: 'cut', part: { cycle: 2 } }]);
    expect(parseSongTweak('{"ops":[],"paid":"voice"}')).toEqual({ ops: [], paid: 'voice' });
    expect(parseSongTweak('nope')).toEqual({ ops: [] });
  });
});

describe('R17: the writer writes one verse (about 60 s) unless more is asked', () => {
  it('asks for ONE verse by default, in English and Japanese; 2番 / Cメロ / 大サビ only when asked', () => {
    const s = lyricsSystem();
    expect(s).toMatch(/about 60 seconds/);
    expect(s).toMatch(/ONLY ONE VERSE \(1番\): Intro, Verse, Pre-Chorus, Chorus, Outro/);
    expect(s).toMatch(/「1番」だけ/);
    expect(s).toMatch(/Do NOT write a second verse \(2番\), a Bridge \(Cメロ\) or a Final Chorus \(大サビ\) unless the user asks/);
    expect(s).toMatch(/2番も作って/);
    expect(s).toMatch(/sparse Build \/ Drop shape/);
    expect(s).not.toMatch(/A usual song: Intro, Verse, Pre-Chorus, Chorus, Bridge, Final Chorus/);
  });
  it('the request carries the words that ask for more (「2番も作って」) and a length talisman', () => {
    const t = spellFrom('song', '夏の曲をフルで作って');
    expect(t.some((x) => x.group === 'length' && x.ja === 'フルコーラス')).toBe(true);
    const r = lyricsRequest({ mode: 'new', said: '夏の曲、2番も作って', tags: t });
    expect(r).toMatch(/2番も作って/);
    expect(r).toMatch(/length=the full song/);
  });
});
