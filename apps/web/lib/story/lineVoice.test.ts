import { batiStoryVoice } from '@obolo/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { batiVoiceEgg, setBatiVoiceEgg, setSceneBatiVoiceEgg, storyVoiceFile } from './lineVoice';
import { voiceKey } from './voice';

const LINE = 'いっしょに行こう！';
const manifest = (o: { old?: boolean; moon?: boolean; sun?: boolean }) => ({
  ...(o.old ? { [voiceKey('バティ', undefined, LINE)]: '/old.mp3' } : {}),
  ...(o.moon ? { [voiceKey(batiStoryVoice('moon'), undefined, LINE)]: '/moon.mp3' } : {}),
  ...(o.sun ? { [voiceKey(batiStoryVoice('sun'), undefined, LINE)]: '/sun.mp3' } : {}),
  [voiceKey('OBOLON', undefined, LINE)]: '/obolon.mp3',
});

afterEach(() => {
  setBatiVoiceEgg(null);
  setSceneBatiVoiceEgg(null);
});

describe('M-R342: {bati}’s pre-made story lines play in the voice of its egg', () => {
  it('the egg’s own file (♀ Moon / ♂ Sun)', () => {
    const m = manifest({ old: true, moon: true, sun: true });
    expect(storyVoiceFile(m, 'バティ', LINE, undefined, 'moon')).toBe('/moon.mp3');
    expect(storyVoiceFile(m, 'バティ', LINE, undefined, 'sun')).toBe('/sun.mp3');
  });

  it('not made yet (or the egg not known): the line’s old voice stands in — never silence because of the change', () => {
    expect(storyVoiceFile(manifest({ old: true }), 'バティ', LINE, undefined, 'sun')).toBe('/old.mp3');
    expect(storyVoiceFile(manifest({ old: true, moon: true }), 'バティ', LINE, undefined, 'sun')).toBe('/old.mp3');
    expect(storyVoiceFile(manifest({ old: true, moon: true, sun: true }), 'バティ', LINE, undefined, null)).toBe('/old.mp3');
    expect(storyVoiceFile(manifest({}), 'バティ', LINE, undefined, 'sun')).toBeNull();
  });

  it('a line made with a stage direction is found for the egg without it too', () => {
    const m = { [voiceKey(batiStoryVoice('sun'), undefined, LINE)]: '/sun.mp3' };
    expect(storyVoiceFile(m, 'バティ', LINE, 'にっこり', 'sun')).toBe('/sun.mp3');
  });

  it('everyone else keeps their one voice', () => {
    expect(storyVoiceFile(manifest({ moon: true, sun: true }), 'OBOLON', LINE, undefined, 'sun')).toBe('/obolon.mp3');
  });

  it('which egg: the one just chosen in the story playing now, else the account’s {bati} in the chat', () => {
    expect(batiVoiceEgg()).toBeNull();
    setBatiVoiceEgg('moon');
    expect(batiVoiceEgg()).toBe('moon');
    setSceneBatiVoiceEgg('sun');
    expect(batiVoiceEgg()).toBe('sun');
    expect(storyVoiceFile(manifest({ moon: true, sun: true }), 'バティ', LINE)).toBe('/sun.mp3');
    setSceneBatiVoiceEgg(undefined);
    expect(batiVoiceEgg()).toBe('moon');
  });
});
