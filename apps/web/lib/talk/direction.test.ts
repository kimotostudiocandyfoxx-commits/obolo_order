import { describe, expect, it } from 'vitest';
import { directLines, lineKind } from './direction';

describe('the directed scene (M-R251 review)', () => {
  it('reads a line', () => {
    expect(lineKind('何の用だZE!!')).toBe('shout');
    expect(lineKind('……やっぱり、ゴリラでしたか。')).toBe('muse');
    expect(lineKind('え？そうなの？')).toBe('question');
    expect(lineKind('ネオか。')).toBe('plain');
  });
  it('picks shots: wide first, cut on a new speaker, a reaction after a question, never three alike', () => {
    const d = directLines([
      { id: '1', who: 'A', text: 'こんにちは。' },
      { id: '2', who: 'B', text: 'はい。' },
      { id: '3', who: 'B', text: 'そうです。' },
      { id: '4', who: 'A', text: 'あなたは誰ですか？' },
      { id: '5', who: 'B', text: 'ネオだ!!' },
      { id: '6', who: 'A', text: 'ふむ。' },
      { id: '7', who: 'B', text: 'うむ。' },
      { id: '8', who: 'A', text: 'なるほど。' },
    ]);
    expect(d.get('1')!.shot).toBe('wide');
    expect(d.get('2')).toMatchObject({ shot: 'mcu', cut: true });
    expect(d.get('3')).toMatchObject({ shot: 'two', cut: false, on: 'A' });
    expect(d.get('4')).toMatchObject({ shot: 'mcu', after: 'reaction', afterOn: 'B', move: 'lean' });
    expect(d.get('5')).toMatchObject({ shot: 'punch', stir: true });
    // mcu, mcu, then not a third
    expect(d.get('6')!.shot).toBe('mcu');
    expect(d.get('7')!.shot).toBe('mcu');
    expect(d.get('8')!.shot).toBe('two');
  });
  it('takes the script override', () => {
    const d = directLines([
      { id: '1', who: 'A', text: 'やあ。' },
      { id: '2', who: 'B', text: 'よう。', override: { shot: 'reaction:A', move: 'enter-left:C' } },
    ]);
    expect(d.get('2')).toMatchObject({ shot: 'reaction', on: 'A', moves: { C: 'enter-left' } });
  });
});
