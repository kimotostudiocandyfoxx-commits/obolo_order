import { describe, expect, it } from 'vitest';
import { SendDachiMessageBody } from './dachiVoice';
import { isVoiceVersion, VOICE_VERSION_DEFAULT, VOICE_VERSION_KEY, VOICE_VERSION_WORDS, VOICE_VERSIONS, VoiceVersionBody, voiceVersionOf } from './voiceVersion';

describe('the two versions of a ダチ voice message (client 2026-11-27)', () => {
  it('「そのまま」 and 「きれい」; the default is the cheap one', () => {
    expect(VOICE_VERSIONS).toEqual(['asis', 'clean']);
    expect(VOICE_VERSION_DEFAULT).toBe('asis');
    expect(VOICE_VERSION_WORDS.label).toEqual({ asis: 'そのまま', clean: 'きれい' });
  });

  it('remembered per member in onboarding_json; nothing, or anything else, is the default', () => {
    expect(voiceVersionOf({ [VOICE_VERSION_KEY]: 'clean' })).toBe('clean');
    expect(voiceVersionOf({ [VOICE_VERSION_KEY]: 'asis' })).toBe('asis');
    for (const j of [{}, null, undefined, { [VOICE_VERSION_KEY]: 'loud' }, { [VOICE_VERSION_KEY]: 1 }]) expect(voiceVersionOf(j)).toBe('asis');
    expect(isVoiceVersion('clean')).toBe(true);
    expect(isVoiceVersion('preview')).toBe(false);
    expect(VoiceVersionBody.safeParse({ version: 'clean' }).success).toBe(true);
    expect(VoiceVersionBody.safeParse({ version: 'best' }).success).toBe(false);
    expect(VoiceVersionBody.safeParse({}).success).toBe(false);
  });

  it('「きれい」 is sent as words to be read: the sound chosen and the draft to drop ride along', () => {
    const b = SendDachiMessageBody.parse({ text: ' あした、あそぼう ', spoken: true, sound: 'oyasumi', soft: false, drop: 'a1111111-1111-4111-8111-111111111111' });
    expect(b).toEqual({ text: 'あした、あそぼう', spoken: true, sound: 'oyasumi', soft: false, drop: 'a1111111-1111-4111-8111-111111111111' });
    expect(SendDachiMessageBody.safeParse({ text: 'うん', spoken: true, sound: 'loud' }).success).toBe(false);
    expect(SendDachiMessageBody.safeParse({ text: 'うん', spoken: true, drop: 'not-an-id' }).success).toBe(false);
    // plain words as ever
    expect(SendDachiMessageBody.parse({ text: 'うん' })).toEqual({ text: 'うん' });
  });
});
