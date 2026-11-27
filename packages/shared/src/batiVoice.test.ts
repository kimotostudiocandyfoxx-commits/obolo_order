import { describe, expect, it } from 'vitest';
import { BATI_FIXED_VOICES, BATI_VOICE_SPEED, batiDefaultVoice, BATI_DEFAULT_VOICES, batiFixedVoice, BATI_PERSONALITY_IDS, batiSpeakSpeed, batiStoryVoice, BATI_VOICE_GROUP, mediaAge, mediaAllowed } from './index';

const now = new Date('2026-11-22T00:00:00Z');
describe('M-R248: the photo and the voice, by age', () => {
  it('under 13 or no birth year: never; 13〜15: with the guardian; 16+: own consent', () => {
    expect(mediaAge(null, now)).toBe('under13');
    expect(mediaAge(2014, now)).toBe('under13');
    expect(mediaAge(2013, now)).toBe('teen');
    expect(mediaAge(2011, now)).toBe('teen');
    expect(mediaAge(2010, now)).toBe('adult');
    expect(mediaAllowed({ birthYear: 2015, consent: true, guardian: true }, now)).toBe(false);
    expect(mediaAllowed({ birthYear: null, consent: true, guardian: true }, now)).toBe(false);
    expect(mediaAllowed({ birthYear: 2012, consent: true, guardian: false }, now)).toBe(false);
    expect(mediaAllowed({ birthYear: 2012, consent: true, guardian: true }, now)).toBe(true);
    expect(mediaAllowed({ birthYear: 1990, consent: true, guardian: false }, now)).toBe(true);
    expect(mediaAllowed({ birthYear: 1990, consent: false, guardian: true }, now)).toBe(false);
  });
  it('M-R252: the branch without the photo and voice stays so, whatever year comes later', () => {
    expect(mediaAllowed({ birthYear: 1990, consent: true, guardian: true, media: false }, now)).toBe(false);
    expect(mediaAllowed({ birthYear: 1990, consent: true, guardian: false, media: true }, now)).toBe(true);
  });
});

describe('M-R250: the fallback (Gemini) {bati} voices by egg × personality', () => {
  it('every personality has a group, every egg × group a voice', () => {
    for (const p of BATI_PERSONALITY_IDS) expect(BATI_VOICE_GROUP[p]).toBeTruthy();
    for (const egg of ['moon', 'sun'] as const) for (const g of ['bright', 'calm', 'rare'] as const) expect(BATI_DEFAULT_VOICES[egg][g].gemini).toBeTruthy();
    expect(batiDefaultVoice()).toEqual({ gemini: 'Leda', pitch: 3 });
    expect(batiDefaultVoice('sun', 'king').gemini).toBe('Orus');
  });
});

describe('M-R342: every {bati} speaks in the fixed voice of its egg, at 1.3×', () => {
  it('♀ the Moon egg: 活発なマスコットキャラ; ♂ the Sun egg: 元気な少年', () => {
    expect(BATI_FIXED_VOICES).toEqual({ moon: '270c409c18d14a60a81ad8c2f24007b9', sun: 'ed07fac0ac144ba6b7f6b208d57ace05' });
    expect(batiFixedVoice('moon')).toBe(BATI_FIXED_VOICES.moon);
    expect(batiFixedVoice('sun')).toBe(BATI_FIXED_VOICES.sun);
  });
  it('no egg known: the Moon egg’s voice', () => {
    expect(batiFixedVoice()).toBe(BATI_FIXED_VOICES.moon);
    expect(batiFixedVoice(null)).toBe(BATI_FIXED_VOICES.moon);
  });
  it('the server’s own ids win, each egg by itself; an empty one is the constant', () => {
    expect(batiFixedVoice('sun', { sun: 'x' })).toBe('x');
    expect(batiFixedVoice('moon', { sun: 'x', moon: '' })).toBe(BATI_FIXED_VOICES.moon);
  });
  it('1.3× (a reading style’s speed on top, within Fish’s 0.5–2)', () => {
    expect(BATI_VOICE_SPEED).toBe(1.3);
    expect(batiSpeakSpeed()).toBe(1.3);
    expect(batiSpeakSpeed(0.9)).toBe(1.17);
    expect(batiSpeakSpeed(1.8)).toBe(2);
  });
  it('the story’s pre-made lines are kept per egg', () => {
    expect(batiStoryVoice('moon')).toBe('バティ:moon');
    expect(batiStoryVoice('sun')).toBe('バティ:sun');
  });
});
