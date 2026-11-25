import 'reflect-metadata';
import { lyricsFallback, lyricsSections, LyricsBody, songSpellKey, spellFrom, type SongLyrics } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { LyricsService } from './lyrics.service';

const tags = spellFrom('song', '夏の海の明るい曲');
const base = lyricsFallback(tags);
const writer = (answer: string | (() => Promise<string>)) => {
  const calls: string[] = [];
  return {
    calls,
    llm: { name: 'test', chat: async (r: { history: { text: string }[] }) => (calls.push(r.history[0].text), typeof answer === 'string' ? answer : answer()) },
  };
};
const svc = (w: { llm: unknown }) => new LyricsService(w.llm as never, { name: 'mock', chat: async () => 'OK' } as never);
const answer = (l: SongLyrics, copy = false) => JSON.stringify({ title: l.title, copy, blocks: l.blocks.map((b) => ({ tag: b.section, hints: b.hints, lines: b.lines })) });

describe('R13: POST /moon/lyrics', () => {
  it('a fresh song: the writer’s lyrics (its JSON read with the engine’s tags only)', async () => {
    const w = writer(JSON.stringify({ title: '夏のうた', blocks: [{ tag: 'Intro', lines: [] }, { tag: 'Verse', lines: ['あさのひかり', 'まどをあけて'] }, { tag: 'Chorus - harmonies', lines: ['ひかれ'] }, { tag: 'Outro - fade out', lines: [] }] }));
    const v = await svc(w).lyrics({ tags, said: '夏の海の明るい曲' });
    expect(v.how).toBe('new');
    expect(v.lyrics.blocks.map((b) => b.section)).toEqual(['intro', 'verse', 'chorus', 'outro']);
    expect(w.calls[0]).toContain('夏の海の明るい曲');
  });
  it('the writer failing is no failure: Bati’s lyrics by rule', async () => {
    const v = await svc(writer(() => Promise.reject(new Error('down')))).lyrics({ tags, said: '夏の海の明るい曲' });
    expect(v).toMatchObject({ how: 'new' });
    expect(v.lyrics.blocks.length).toBeGreaterThan(3);
  });
  it('a change by rule needs no writer (ささやきを外して)', async () => {
    const w = writer(() => Promise.reject(new Error('must not be asked')));
    const v = await svc(w).lyrics({ tags, said: 'ささやきを外して', lyrics: base });
    expect(v.how).toBe('edit');
    expect(v.lyrics.blocks.some((b) => b.hints.includes('whispered'))).toBe(false);
    expect(w.calls).toHaveLength(0);
  });
  it('new words are the writer’s, with the lyrics as context; failing, the lyrics stay (kept); 2番 by rule', async () => {
    const brighter = { ...base, blocks: base.blocks.map((b) => (b.section === 'chorus' ? { ...b, lines: ['はじけて　夏のうた', 'わらって'] } : b)) };
    const w = writer(answer(brighter));
    const v = await svc(w).lyrics({ tags, said: 'サビをもっと明るく', lyrics: base });
    expect(v.how).toBe('edit');
    expect(v.lyrics.blocks[3].lines[0]).toBe('はじけて　夏のうた');
    expect(w.calls[0]).toContain('[Chorus - harmonies]');
    const k = await svc(writer(() => Promise.reject(new Error('down')))).lyrics({ tags, said: 'サビをもっと明るく', lyrics: base });
    expect(k).toMatchObject({ how: 'kept', lyrics: base });
    const two = await svc(writer(() => Promise.reject(new Error('down')))).lyrics({ tags, said: '2番を足して', lyrics: base });
    expect(two.lyrics.blocks.filter((b) => b.section === 'verse')).toHaveLength(2);
  });
  it('「歌詞はこれで：…」: the member’s own words structured; a real song’s lyrics → declined, original ones in that mood', async () => {
    const own = await svc(writer(() => Promise.reject(new Error('down')))).lyrics({ tags, said: '歌詞はこれで：あさのひかり\nまどをあけて\n\nラーメン ラーメン\nおいしいな' });
    expect(own.how).toBe('own');
    expect(own.lyrics.blocks.flatMap((b) => b.lines)).toEqual(['あさのひかり', 'まどをあけて', 'ラーメン ラーメン', 'おいしいな']);
    const copy = await svc(writer(answer(base, true))).lyrics({ tags, said: '歌詞はこれで：（ある有名な曲の歌詞）' });
    expect(copy.declined).toBe('copy');
    expect(copy.how).toBe('new');
  });
  it('words that cannot be sung are not written from', async () => {
    const v = await svc(writer(() => Promise.reject(new Error('x')))).lyrics({ tags, said: '死ねって歌詞にして', lyrics: base });
    expect(v).toMatchObject({ how: 'kept', declined: 'flagged', lyrics: base });
  });
  it('the body: style tags + words (+ lyrics); the sections sung come from the lyrics', () => {
    expect(LyricsBody.safeParse({ tags, said: 'x', lyrics: base }).success).toBe(true);
    expect(LyricsBody.safeParse({ tags: [], said: 'x' }).success).toBe(false);
    expect(lyricsSections(base).flatMap((s) => s.lines).length).toBe(base.blocks.reduce((a, b) => a + b.lines.length, 0));
    expect(songSpellKey(tags, base)).toMatch(/^song-\d+-[0-9a-f]{8}~L\d+-[0-9a-f]{8}$/);
  });
});
