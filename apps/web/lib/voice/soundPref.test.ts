import { describe, expect, it } from 'vitest';
import { setSoundOff, soundOff, voiceUrlFor } from './soundPref';

describe('〔おとをけす〕 (client 2026-11-27): the voice alone', () => {
  const mixed = { url: 'https://r2/mix.mp3', plainUrl: 'https://r2/voice.mp3' };
  it('plays the mix until the sound is turned off, then the clean voice; an old voice message has one file', () => {
    expect(voiceUrlFor(mixed, false)).toBe('https://r2/mix.mp3');
    expect(voiceUrlFor(mixed, true)).toBe('https://r2/voice.mp3');
    expect(voiceUrlFor({ url: 'https://r2/old.webm' }, true)).toBe('https://r2/old.webm');
    expect(voiceUrlFor({ url: null, plainUrl: null }, true)).toBeNull();
  });

  it('the choice holds for the visit even where nothing can be stored', () => {
    expect(soundOff()).toBe(false);
    setSoundOff(true);
    expect(soundOff()).toBe(true);
    expect(voiceUrlFor(mixed)).toBe('https://r2/voice.mp3');
    setSoundOff(false);
    expect(voiceUrlFor(mixed)).toBe('https://r2/mix.mp3');
  });
});
