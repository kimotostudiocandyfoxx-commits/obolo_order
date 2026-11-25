import { describe, expect, it } from 'vitest';
import { compassSpellPrompt, compassTitlePrompt } from './prompts/compass';
import { MockProvider } from './providers';
import { BATI_CHARACTER } from './prompts/bati';

describe('R12: the Moon compass prompts', () => {
  it('a picture / a song read as spell tags (ja + en + group), never a name, the lyrics or the title', () => {
    for (const p of [compassSpellPrompt('art'), compassSpellPrompt('song'), compassTitlePrompt()]) {
      expect(p).toContain('COMPASS_SPELL');
      expect(p).toMatch(/"ja".*"en".*"group"/);
      expect(p).toMatch(/Never write a real person.*singer.*song title/);
      expect(p).toMatch(/No lyrics/);
    }
    expect(compassSpellPrompt('song')).toMatch(/genre, mood, tempo, instrument, voice/);
    expect(compassSpellPrompt('art')).toMatch(/style .*color, light, composition/);
  });
  it('the offline model answers the compass with its fixed reads', async () => {
    const m = new MockProvider();
    const art = JSON.parse(await m.perceive({ mime: 'image/png', data: Buffer.from('') }, compassSpellPrompt('art')));
    expect(art.tags.map((t: { ja: string }) => t.ja)).toContain('水彩');
    const song = JSON.parse(await m.perceive({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, compassSpellPrompt('song')));
    expect(song.tags.map((t: { group: string }) => t.group)).toEqual(expect.arrayContaining(['genre', 'tempo', 'voice']));
    const title = JSON.parse(await m.chat({ system: compassTitlePrompt(), history: [{ role: 'user', text: '{}' }] }));
    expect(title.tags.length).toBeGreaterThan(3);
  });
  it('Bati knows both tools, in Japanese and in English', () => {
    expect(BATI_CHARACTER.ja).toMatch(/コンパス.*スペルブック/s);
    expect(BATI_CHARACTER.ja).toContain('このスペル、スペルブックにしまっておく？');
    expect(BATI_CHARACTER.en).toMatch(/compass \(コンパス\).*spell book \(スペルブック\)/s);
  });
  it('R13: Bati takes プロンプト / 呪文 / 指示文 as the spell and answers with スペル, never correcting', () => {
    expect(BATI_CHARACTER.ja).toMatch(/「プロンプト」「呪文」「指示文」と呼んでも、スペルのこととして受けとめ/);
    expect(BATI_CHARACTER.ja).toContain('いつも「スペル」と言う');
    expect(BATI_CHARACTER.ja).toContain('言い直させない');
    expect(BATI_CHARACTER.en).toMatch(/プロンプト, 呪文, 指示文 or "prompt", take it as the spell and always answer with スペル, never correcting/);
  });
});
