import { describe, expect, it } from 'vitest';
import { cleanHeard, heardNoSpeech } from './heardText';

describe('cleanHeard (R21 playtest: 「00:00」 and noise stood in the answer)', () => {
  it.each([
    '00:00',
    '0:00',
    '00:00 ',
    '[00:00]',
    '00:00 - 00:04',
    '(0:00〜0:05)',
    '00:00:00.000',
    '[音楽]',
    '（ノイズ）',
    '【無音】',
    '(music)',
    '[inaudible]',
    '♪',
    '♪～',
    '[00:00] [ノイズ]',
    'ノイズ',
    '無音。',
    '音声なし',
    'No speech.',
    '何も話していません。',
    '音声が含まれていません',
    'ご視聴ありがとうございました',
    '...',
    '',
  ])('no speech: %j', (raw) => {
    expect(cleanHeard(raw)).toBe('');
  });

  it.each([
    ['おにぎり', 'おにぎり'],
    ['カレーライス！', 'カレーライス！'],
    ['[00:00] おにぎり', 'おにぎり'],
    ['00:00 おにぎりです', 'おにぎりです'],
    ['[音楽] いちごが好き', 'いちごが好き'],
    ['ラーメン（笑）', 'ラーメン'],
    ['朝の3:30に起きた', '朝の3:30に起きた'],
    // what someone may really say stays
    ['音楽', '音楽'],
    ['なし', 'なし'],
    ['ノイズキャンセリングのイヤホン', 'ノイズキャンセリングのイヤホン'],
  ])('keeps the words: %j → %j', (raw, want) => {
    expect(cleanHeard(raw)).toBe(want);
  });

  it('heardNoSpeech: something came back, none of it speech', () => {
    expect(heardNoSpeech('00:00')).toBe(true);
    expect(heardNoSpeech('')).toBe(false);
    expect(heardNoSpeech('おにぎり')).toBe(false);
  });
});
