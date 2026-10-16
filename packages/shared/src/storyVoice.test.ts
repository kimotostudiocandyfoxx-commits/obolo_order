import { describe, expect, it } from 'vitest';
import { fillNames, nameCharsOk, storyVoiceFilter } from './storyVoice';

describe('story lines with names', () => {
  it('fills the names, or waits for a missing one', () => {
    expect(fillNames('{neo}、待ってた。', { neo: 'ミルク' })).toBe('ミルク、待ってた。');
    expect(fillNames('{neo}と{bati}', { neo: 'ミルク' })).toBeNull();
    expect(fillNames('{name}か、いいな。', { name: '  ' })).toBeNull();
  });
  it('takes hiragana, katakana and English only', () => {
    for (const ok of ['たろう', 'タロウ', 'Taro', 'ミルク・ティー', 'john smith', 'はなちゃん☆']) expect(nameCharsOk(ok)).toBe(true);
    for (const ng of ['太郎', '大翔', 'たろう😀', '']) expect(nameCharsOk(ng)).toBe(false);
  });
  it('pads and trims around a pitch shift, then sets the tempo', () => {
    const f = storyVoiceFilter({ voice: 'Leda', pitch: 3 }, 1.3);
    expect(f).toMatch(/apad=pad_dur=1,rubberband=pitch=1\.1892.*areverse.*atempo=1\.3000,loudnorm/);
    expect(storyVoiceFilter({ voice: 'Kore' }, 1)).not.toMatch(/rubberband|atempo/);
  });
});
