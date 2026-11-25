import { describe, expect, it } from 'vitest';
import { isSpellWord, spellEdit, spellFrom, spellSaid, type SpellTag } from './spell';
import { spellQuery, spellToolIntent, SPELL_TOOL_LINES } from './spellTools';

/** R13 (client): プロンプト / 呪文 / 指示文 (any script, half-width, English) are the スペル */
describe('R13: プロンプト and the other words for a spell', () => {
  it('every way of writing it is said as スペル; a collection is the spell book', () => {
    for (const w of ['プロンプト', 'ぷろんぷと', 'ﾌﾟﾛﾝﾌﾟﾄ', 'prompt', 'Prompt', 'ｐｒｏｍｐｔ', '呪文', 'じゅもん', 'ジュモン', '指示文', 'プロンプト文']) expect(spellSaid(`${w}見せて`), w).toBe('スペル見せて');
    for (const w of ['プロンプト集', '呪文帳', 'プロンプト一覧', 'スペル集']) expect(spellSaid(`${w}見せて`), w).toBe('スペルブック見せて');
    expect(spellSaid('show me the prompt')).toBe('show me the スペル');
    expect(spellSaid('prompting')).toBe('prompting');
  });

  const table: [string, ReturnType<typeof spellToolIntent>][] = [
    ['プロンプト見せて', { tool: 'show', out: false }],
    ['いまのプロンプト見せて', { tool: 'show', out: false }],
    ['ﾌﾟﾛﾝﾌﾟﾄ見せて', { tool: 'show', out: false }],
    ['呪文は？', { tool: 'show', out: false }],
    ['prompt見せて', { tool: 'show', out: false }],
    ['プロンプト出して', { tool: 'show', out: true }],
    ['このプロンプト保存して', { tool: 'save' }],
    ['この呪文しまっておいて', { tool: 'save' }],
    ['プロンプト保存', { tool: 'save' }],
    ['プロンプト集見せて', { tool: 'book' }],
    ['呪文帳出して', { tool: 'book' }],
    ['この画像のプロンプト読んで', { tool: 'compass' }],
    ['この写真の呪文教えて', { tool: 'compass' }],
    ['夏の海のプロンプト使って', { tool: 'use', query: '夏の海', named: true }],
    ['プロンプト集の雨の街のジャズ使って', { tool: 'use', query: '雨の街のジャズ', named: true }],
    ['プロンプトにピアノ足して', null],
    ['この呪文、もっと明るく', null],
    ['プロンプト保存しないで', null],
  ];
  it.each(table)('%s', (said, want) => expect(spellToolIntent(said)).toEqual(want));

  it('the words for the spell never become talismans (a fresh spell, an edit)', () => {
    const words = (ts: SpellTag[]) => ts.map((t) => t.ja).join('・');
    const tags = spellFrom('song', '夏の海のポップ');
    for (const said of ['プロンプトにギター足して', 'このプロンプトにギター足して', '呪文にギターを入れて', 'prompt にギター足して', '指示文にギター足して', 'このスペルにギター足して']) {
      const v = spellEdit('song', tags, said);
      expect(words(v.added), said).not.toMatch(/プロンプト|呪文|指示|prompt|スペル/i);
      expect(v.added.map((t) => t.ja), said).toContain('ギター');
    }
    for (const said of ['このプロンプトに星空を足して', '呪文に星空も入れて']) expect(spellEdit('song', tags, said).added.map((t) => t.ja), said).toEqual(['星空']);
    for (const said of ['クジラのプロンプトで作って', '夜の海の呪文で絵を描いて']) expect(words(spellFrom('art', said)), said).not.toMatch(/プロンプト|呪文|スペル/);
    for (const w of ['プロンプト', 'このプロンプト', '呪文', 'スペル', 'ﾌﾟﾛﾝﾌﾟﾄ']) expect(isSpellWord(w), w).toBe(true);
    expect(isSpellWord('クジラ')).toBe(false);
    expect(spellQuery('夏の海のプロンプト使って')).toBe('夏の海');
  });

  it('bati answers with スペル, never correcting the word', () => {
    expect(SPELL_TOOL_LINES.spellShow).toContain('スペル');
    for (const l of Object.values(SPELL_TOOL_LINES)) expect(l).not.toMatch(/プロンプト|呪文|指示文|じゃなくて/);
  });
});
