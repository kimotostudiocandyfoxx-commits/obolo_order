import { describe, expect, it } from 'vitest';
import { presetFor } from './sfx';

describe('story sound presets', () => {
  it('guesses a synthesised sound from the SE text, none for realistic sounds', () => {
    expect(presetFor('KIMORINがピンポンボタンを押す')).toBe('ding');
    expect(presetFor('星がキラキラ光る')).toBe('sparkle');
    expect(presetFor('魔法陣が光る')).toBe('magic');
    expect(presetFor('扉をコンコンとノック')).toBe('knock');
    expect(presetFor('遠くで鐘が鳴る')).toBe('bell');
    expect(presetFor('波が岸に寄せる')).toBeNull();
  });
});
