import { spellFrom } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { artTitleRequest, artTitleSystem, parseArtTitle } from './prompts/artTitle';

describe('story 2026-11-25: {bati} names a picture (one title from its spell)', () => {
  it('asks for ONE short title in JSON, with the spell, the request and (asked again) the title now', () => {
    expect(artTitleSystem()).toMatch(/ONE short/);
    expect(artTitleSystem()).toMatch(/\{"title"/);
    const r = artTitleRequest({ tags: spellFrom('art', '月と海を水彩で'), said: '月と海を水彩で', before: '月の海' });
    expect(r).toContain('月と海を水彩で');
    expect(r).toContain('「月の海」');
    expect(artTitleRequest({ tags: [], said: '' })).toBe('Name the picture.');
  });
  it('reads the answer: JSON (fenced or not), quotes and 「〜の絵」 taken off; nothing usable is null', () => {
    expect(parseArtTitle('{"title":"月と海"}')).toBe('月と海');
    expect(parseArtTitle('```json\n{"title":"「夜のねこ」"}\n```')).toBe('夜のねこ');
    expect(parseArtTitle('{"title":"さくら通りの絵"}')).toBe('さくら通り');
    expect(parseArtTitle('here: "title": "星の町" ok')).toBe('星の町');
    expect(parseArtTitle('{"title":""}')).toBeNull();
    expect(parseArtTitle('nope')).toBeNull();
  });
});
