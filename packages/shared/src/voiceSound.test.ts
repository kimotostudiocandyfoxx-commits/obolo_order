import { describe, expect, it } from 'vitest';
import { SendDachiMessageBody } from './dachiVoice';
import { ABSORBED_FEATURES, USAGE_FEATURES } from './manaPrice';
import { moodByRules, parseMoodAnswer, pickVoiceSound, VOICE_MIX_DAILY_CAP, VOICE_MOODS, VOICE_SOUND_FALLBACK, VOICE_SOUND_LABEL, VOICE_SOUND_PARTS, VOICE_SOUNDS, voiceMixCapped } from './voiceSound';

describe('ダチの声のメッセージの「おと」 (client 2026-11-27)', () => {
  it('seven moods and なし, each with its chip; every mood has a part to play', () => {
    expect(VOICE_MOODS).toHaveLength(7);
    expect(VOICE_SOUNDS.at(-1)).toBe('none');
    expect(VOICE_SOUNDS.map((s) => VOICE_SOUND_LABEL[s])).toEqual(['うれしい', 'わくわく', 'おつかれ', 'びっくり', 'しんみり', 'おもしろ', 'おやすみ', 'なし']);
    for (const m of VOICE_MOODS) expect(Object.keys(VOICE_SOUND_PARTS[m]).length).toBeGreaterThan(0);
    // a bed never comes with accents on top (few notes)
    for (const m of VOICE_MOODS) if (VOICE_SOUND_PARTS[m].bed) expect(VOICE_SOUND_PARTS[m]).toEqual({ bed: true });
  });

  it('the word rules read the plain cases', () => {
    expect(moodByRules('やったー！テスト100点だった')).toBe('ureshii');
    expect(moodByRules('明日は遠足だね、楽しみ！')).toBe('wakuwaku');
    expect(moodByRules('今日もおつかれさま。ゆっくり休んでね')).toBe('otsukare');
    expect(moodByRules('えっ、まじで？！')).toBe('bikkuri');
    expect(moodByRules('ちょっと、さみしいな')).toBe('shinmiri');
    expect(moodByRules('それウケる、笑った')).toBe('omoshiro');
    expect(moodByRules('もう寝るね、おやすみ')).toBe('oyasumi');
    // a good night with a laugh in it is still a good night
    expect(moodByRules('笑った笑った。じゃあ、おやすみ')).toBe('oyasumi');
    expect(moodByRules('三時に駅の前で')).toBeNull();
  });

  it('the model’s answer counts only when it names one mood', () => {
    expect(parseMoodAnswer('wakuwaku')).toBe('wakuwaku');
    expect(parseMoodAnswer(' Shinmiri.\n')).toBe('shinmiri');
    expect(parseMoodAnswer('おもしろ')).toBe('omoshiro');
    expect(parseMoodAnswer('unknown')).toBeNull();
    expect(parseMoodAnswer('none')).toBeNull();
    expect(parseMoodAnswer('ureshii or wakuwaku')).toBeNull();
    expect(parseMoodAnswer('')).toBeNull();
    expect(parseMoodAnswer(null)).toBeNull();
  });

  it('undecidable words get the weakest うれしい — never なし', () => {
    expect(pickVoiceSound('三時に駅の前で')).toEqual({ sound: 'ureshii', soft: true });
    expect(pickVoiceSound('三時に駅の前で', 'unknown')).toEqual(VOICE_SOUND_FALLBACK);
    expect(pickVoiceSound('', 'none')).toEqual(VOICE_SOUND_FALLBACK);
    expect(pickVoiceSound('')).toEqual(VOICE_SOUND_FALLBACK);
    // the model first; the rules when it does not say; a decided うれしい is the full one
    expect(pickVoiceSound('おやすみ', 'bikkuri')).toEqual({ sound: 'bikkuri' });
    expect(pickVoiceSound('おやすみ', 'unknown')).toEqual({ sound: 'oyasumi' });
    expect(pickVoiceSound('やった！')).toEqual({ sound: 'ureshii' });
  });

  it('the daily cap: the cap-th still goes, the next does not', () => {
    expect(voiceMixCapped(1)).toBe(false);
    expect(voiceMixCapped(VOICE_MIX_DAILY_CAP)).toBe(false);
    expect(voiceMixCapped(VOICE_MIX_DAILY_CAP + 1)).toBe(true);
    expect(voiceMixCapped(3, 2)).toBe(true);
    expect(voiceMixCapped(2, 2)).toBe(false);
  });

  it('its cost is a small cost of the member (not absorbed like the ダチ talk)', () => {
    expect(USAGE_FEATURES).toContain('voiceMix');
    expect(ABSORBED_FEATURES).not.toContain('voiceMix');
  });

  it('a voice message may carry its caption and its sound; an old one (no caption, no sound) still parses', () => {
    const id = 'a0000000-0000-4000-8000-000000000001';
    expect(SendDachiMessageBody.parse({ mediaId: id, seconds: 4 })).toEqual({ mediaId: id, seconds: 4 });
    expect(SendDachiMessageBody.parse({ mediaId: id, seconds: 4, caption: ' やった ', sound: 'ureshii', soft: true })).toMatchObject({ caption: 'やった', sound: 'ureshii', soft: true });
    expect(SendDachiMessageBody.safeParse({ mediaId: id, seconds: 4, sound: 'loud' }).success).toBe(false);
    // typed words stay typed words
    expect(SendDachiMessageBody.parse({ text: 'こんにちは' })).toEqual({ text: 'こんにちは' });
  });
});
