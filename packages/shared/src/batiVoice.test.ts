import { describe, expect, it } from 'vitest';
import { batiDefaultVoice, BATI_DEFAULT_VOICES, BATI_PERSONALITY_IDS, BATI_VOICE_GROUP, mediaAge, mediaAllowed } from './index';

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
});

describe('M-R250: the prepared {bati} voices by egg × personality', () => {
  it('every personality has a group, every egg × group a voice', () => {
    for (const p of BATI_PERSONALITY_IDS) expect(BATI_VOICE_GROUP[p]).toBeTruthy();
    for (const egg of ['moon', 'sun'] as const) for (const g of ['bright', 'calm', 'rare'] as const) expect(BATI_DEFAULT_VOICES[egg][g].gemini).toBeTruthy();
    expect(batiDefaultVoice()).toEqual({ gemini: 'Leda', pitch: 3, fish: null });
    expect(batiDefaultVoice('sun', 'king').gemini).toBe('Orus');
  });
});
