import { describe, expect, it } from 'vitest';
import { lyricsFallback, spellFrom } from '@obolo/shared';
import { lyricsRequest, lyricsSystem } from './prompts/lyrics';
import { parseSpellAnswer, spellRequest, spellSystem } from './prompts/spell';
import { parseModelSpec, TASK_MODEL_DEFAULTS } from './task';

describe('R14: the spell model (SPELL_MODEL)', () => {
  it('a Flash-class chain by default', () => {
    expect(parseModelSpec(TASK_MODEL_DEFAULTS.spell)[0]).toEqual({ provider: 'gemini', model: 'gemini-2.5-flash' });
  });
  it('knows the genres, keeps defaults from contradicting them, keeps the request words out, remakes on a correction', () => {
    const s = spellSystem('song');
    expect(s).toContain('サイケデリックトランス = psychedelic trance (psytrance)');
    expect(s).toMatch(/140-148 BPM/);
    expect(s).toMatch(/no ピアノ, ドラム, やさしい歌声, ふつうの速さ or ポップ for psytrance/);
    expect(s).toMatch(/作りたい/);
    expect(s).toMatch(/全然違う/);
    expect(s).toMatch(/"respelled": true/);
    expect(spellSystem('art')).toMatch(/subject/);
    const r = JSON.parse(spellRequest({ kind: 'song', said: '全然違うよ、サイケデリックトランスにして', tags: spellFrom('song', 'ノリのいい曲'), history: [{ who: 'me', text: 'サイトラの曲' }] }));
    expect(r.request).toBe('全然違うよ、サイケデリックトランスにして');
    expect(r.spell_now.length).toBeGreaterThan(3);
    expect(r.talk).toEqual(['user: サイトラの曲']);
  });
  it('reads the answer (fenced, or a bare list)', () => {
    expect(parseSpellAnswer('```json\n{"tags":[{"ja":"a","en":"b","group":"theme"}],"respelled":true}\n```')).toEqual({ tags: [{ ja: 'a', en: 'b', group: 'theme' }], respelled: true });
    expect(parseSpellAnswer('[{"ja":"a"}]').tags).toHaveLength(1);
    expect(parseSpellAnswer('nope').tags).toEqual([]);
  });
});

describe('R14: the lyrics follow the style spell', () => {
  it('the writer gets the style tags and the genre’s guidance (psytrance: sparse, mantra-like, Build / Drop)', () => {
    const psy = spellFrom('song', 'サイケデリックトランスの曲');
    const r = lyricsRequest({ mode: 'new', said: 'サイケデリックトランスの曲', tags: psy });
    expect(r).toContain('genre=psychedelic trance (psytrance)');
    expect(r).toContain('instrument=rolling 16th-note bassline');
    expect(r).toMatch(/SPARSE lyrics/);
    expect(r).toMatch(/mantra-like/);
    expect(r).toMatch(/Build, Drop/);
    const ballad = lyricsRequest({ mode: 'new', said: '泣けるバラード', tags: spellFrom('song', '泣けるバラード') });
    expect(ballad).toMatch(/full verses/);
    expect(ballad).not.toMatch(/SPARSE/);
    // an edit carries them too
    expect(lyricsRequest({ mode: 'edit', said: 'サビを変えて', tags: psy, lyrics: lyricsFallback(psy) })).toMatch(/SPARSE lyrics/);
    expect(lyricsSystem()).toMatch(/Build \(the rise before a drop/);
  });
  it('without the writer, a psytrance song gets few repeated phrases between instrumental parts', () => {
    const l = lyricsFallback(spellFrom('song', 'サイケデリックトランスの曲'));
    const sung = l.blocks.flatMap((b) => b.lines);
    expect(sung.length).toBeLessThanOrEqual(10);
    expect(l.blocks.map((b) => b.section)).toEqual(expect.arrayContaining(['build', 'drop', 'instrumental']));
    expect(new Set(sung).size).toBeLessThan(sung.length);
  });
});
