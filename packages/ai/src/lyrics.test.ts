import { describe, expect, it } from 'vitest';
import { lyricsFallback, spellFrom } from '@obolo/shared';
import { lyricsRequest, lyricsSystem, parseLyricsAnswer } from './prompts/lyrics';
import { parseModelSpec, TASK_MODEL_DEFAULTS } from './task';

const tags = spellFrom('song', '夏の海の明るい曲');

describe('R13: the lyrics writer (LYRICS_MODEL)', () => {
  it('a Flash-class chain by default', () => {
    expect(parseModelSpec(TASK_MODEL_DEFAULTS.lyrics)[0]).toEqual({ provider: 'gemini', model: 'gemini-2.5-flash' });
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
