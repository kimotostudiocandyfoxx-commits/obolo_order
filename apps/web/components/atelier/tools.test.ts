import { SPELL_TOOL_MEMORY_EMPTY } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { cueOf, cues } from './story';
import { bookAt, bookKindOf, compassAt, toolStep, type ToolCtx } from './tools';

const ctx = (c: Partial<ToolCtx> = {}): ToolCtx => ({ asked: null, plan: false, bookOpen: false, cast: false, castDone: false, kept: false, mem: { ...SPELL_TOOL_MEMORY_EMPTY }, ...c });

describe('R12: the Moon chat’s words for bati’s tools', () => {
  it('a YouTube link pasted → the compass reads it (even with a spell waiting)', () => {
    expect(toolStep('これ好き https://youtu.be/dQw4w9WgXcQ', ctx({ plan: true }))).toEqual({ do: 'compassLink', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  });
  it('「コンパス出して」 / 「スペルブック出して」 / its pages and 「とじて」 while open', () => {
    expect(toolStep('コンパス出して', ctx())).toEqual({ do: 'compassOpen' });
    expect(toolStep('スペルブック出して', ctx())).toEqual({ do: 'bookOpen' });
    expect(toolStep('次のページ', ctx({ bookOpen: true }))).toEqual({ do: 'page', step: 1 });
    expect(toolStep('とじて', ctx({ bookOpen: true }))).toEqual({ do: 'bookClose' });
    expect(toolStep('夏の海のやつ使って', ctx({ bookOpen: true }))).toEqual({ do: 'use', query: '夏の海', named: true });
    // other words close the open book quietly (the talk goes on)
    expect(toolStep('明日は晴れるかな', ctx({ bookOpen: true }))).toEqual({ do: 'bookClose', quiet: true });
  });
  it('a happy word after a work is done → the offer, only when the rule allows it', () => {
    const done = ctx({ cast: true, castDone: true, mem: { ...SPELL_TOOL_MEMORY_EMPTY, works: 1 } });
    expect(toolStep('最高！', done)).toEqual({ do: 'offer' });
    // not while the work is being made, not for a spell kept already, not while a spell waits for its yes
    expect(toolStep('最高！', { ...done, castDone: false })).toBeNull();
    expect(toolStep('最高！', { ...done, kept: true })).toBeNull();
    expect(toolStep('いいね', { ...done, plan: true })).toBeNull();
    // offered at the last work: not again for the next ones
    expect(toolStep('最高！', { ...done, mem: { ...done.mem, works: 2, offeredAt: 1 } })).toBeNull();
    expect(toolStep('もっと明るく', done)).toBeNull();
  });
  it('the answers to bati’s questions: しまっておく？ / 捨てていい？ / もとにする？', () => {
    expect(toolStep('うん！', ctx({ asked: 'save' }))).toEqual({ do: 'yes', to: 'save' });
    expect(toolStep('しまって', ctx({ asked: 'save' }))).toEqual({ do: 'yes', to: 'save' });
    expect(toolStep('いや、いい', ctx({ asked: 'save' }))).toEqual({ do: 'no', to: 'save' });
    expect(toolStep('捨てて', ctx({ asked: 'drop' }))).toEqual({ do: 'yes', to: 'drop' });
    expect(toolStep('やっぱやめとく', ctx({ asked: 'drop' }))).toEqual({ do: 'no', to: 'drop' });
    expect(toolStep('お願い', ctx({ asked: 'base' }))).toEqual({ do: 'yes', to: 'base' });
    expect(toolStep('ううん、新しく', ctx({ asked: 'base' }))).toEqual({ do: 'no', to: 'base' });
    expect(toolStep('「夏のうた」って名前にして', ctx())).toEqual({ do: 'rename', name: '夏のうた' });
  });
  it('ordinary words are nothing for the tools', () => {
    for (const t of ['夏の海の曲つくって', 'ピアノも足して', 'OK', 'おはよう']) expect(toolStep(t, ctx()), t).toBeNull();
  });
  it('a chapter’s small spell is not kept; the other kinds are', () => {
    expect(bookKindOf('chapter')).toBeNull();
    expect(bookKindOf('song')).toBe('song');
    expect(bookKindOf(null)).toBeNull();
  });
  it('the compass and the book float over the bowl, inside the room left by the talk', () => {
    const c = compassAt({ x: 195, y: 620 }, 600, 1, 300);
    expect(c.x).toBe(195);
    expect(c.y + c.size / 2).toBeLessThanOrEqual(600);
    expect(c.y - c.size / 2).toBeGreaterThanOrEqual(300);
    const b = bookAt(390, 600, 300);
    expect(b.w).toBeLessThanOrEqual(390 - 32);
    expect(b.top).toBeGreaterThanOrEqual(300);
    expect(b.top + b.h).toBeLessThanOrEqual(600);
  });
});

describe('R12 (day 4): the story’s compass and spell book lines have their moments', () => {
  it('a line with コンパス is said as the talk opens; one with スペルブック once the art is made', () => {
    expect(cueOf({ who: 'バティ', text: 'そうだ、好きな絵の写真があったら、見せてね。ボクのコンパスで、どんなスペルか読めるんだ！' } as never)).toBe('compass');
    expect(cueOf({ who: 'バティ', text: 'いまのスペルは、スペルブックにしまっておくね。また使いたくなったら、「スペルブック出して」って言ってね！' } as never)).toBe('book');
    const c = cues([{ who: 'バティ', text: 'じゃあ、話してみて！' }, { who: 'バティ', text: 'ボクのコンパスで、読めるんだ！' }] as never);
    expect(c.open?.[0].text).toBe('じゃあ、話してみて！');
    expect(c.compass?.[0].text).toContain('コンパス');
  });
});

describe('R13: プロンプト / 呪文 / 指示文 are the spell (typed or said)', () => {
  const table: [string, Partial<ToolCtx>, ReturnType<typeof toolStep>][] = [
    ['プロンプト見せて', { plan: true }, { do: 'show' }],
    ['プロンプト見せて', { cast: true, castDone: true, spell: true }, { do: 'show' }],
    ['プロンプト見せて', {}, { do: 'noSpell' }],
    ['プロンプト出して', {}, { do: 'bookOpen' }],
    ['プロンプト出して', { plan: true }, { do: 'show' }],
    ['ぷろんぷと見せて', { plan: true }, { do: 'show' }],
    ['このプロンプト保存して', { cast: true, castDone: true, spell: true }, { do: 'save' }],
    ['プロンプト集見せて', { plan: true }, { do: 'bookOpen' }],
    ['この画像のプロンプト読んで', {}, { do: 'compassOpen' }],
    ['夏の海のプロンプト使って', {}, { do: 'use', query: '夏の海', named: true }],
    ['プロンプトにピアノ足して', { plan: true }, null],
  ];
  it.each(table)('%s %o', (said, c, want) => expect(toolStep(said, ctx(c))).toEqual(want));
});
