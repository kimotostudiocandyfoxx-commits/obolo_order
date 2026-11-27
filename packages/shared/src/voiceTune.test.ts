import { describe, expect, it } from 'vitest';
import { clampVoiceTune, isDefaultVoiceTune, semitoneRatio, VOICE_TUNE_CHIPS, VOICE_TUNE_DEFAULT, VOICE_TUNE_KEY, VOICE_TUNE_LINES, VoiceTuneBody, voiceTuneOf, voiceTuneTalk, voiceTuneWords, type VoiceTune } from './voiceTune';

const D = VOICE_TUNE_DEFAULT;
const set = (said: string, now: VoiceTune = D, inTalk = false) => {
  const t = voiceTuneTalk(said, now, inTalk);
  return t?.do === 'set' ? t.next : (t?.do ?? null);
};

describe('the voice settings of a ダチ voice message (client 2026-11-27)', () => {
  it('the default is sample K with the key the client chose after trying it: +2 semitones (it was +6), 1.8×, autotune 0.6, the silences cut', () => {
    expect(D).toEqual({ key: 2, speed: 1.8, tune: 0.6, cut: true });
    expect(semitoneRatio(2)).toBe(1.122462);
    expect(semitoneRatio(6)).toBe(1.414214);
    expect(semitoneRatio(0)).toBe(1);
    expect(voiceTuneWords(D)).toBe('キー +2・はやさ 1.8倍・オートチューン 0.6・間をつめる');
    expect(voiceTuneWords({ key: -2, speed: 1, tune: 0, cut: false })).toBe('キー -2・はやさ 1.0倍・オートチューン なし・間はそのまま');
  });

  it('clamped: the key −6…+8 in whole semitones, the speed 1.0…2.0 and the strength 0…1 in tenths', () => {
    expect(clampVoiceTune({ key: 99, speed: 9, tune: 5, cut: false })).toEqual({ key: 8, speed: 2, tune: 1, cut: false });
    expect(clampVoiceTune({ key: -99, speed: -1, tune: -1 })).toEqual({ key: -6, speed: 1, tune: 0, cut: true });
    expect(clampVoiceTune({ key: 2.6, speed: 1.449, tune: 0.26 })).toEqual({ key: 3, speed: 1.4, tune: 0.3, cut: true });
    // what is missing or not a number is what it was
    expect(clampVoiceTune({ key: 'high', speed: NaN, tune: null, cut: 'yes' })).toEqual(D);
    expect(clampVoiceTune(null)).toEqual(D);
    expect(clampVoiceTune({ key: 1 }, { key: 0, speed: 1.2, tune: 0, cut: false })).toEqual({ key: 1, speed: 1.2, tune: 0, cut: false });
    expect(clampVoiceTune('x')).toEqual(D);
  });

  it('kept as a JSON string in onboarding_json; nothing, or something unreadable, is the default', () => {
    expect(voiceTuneOf({ [VOICE_TUNE_KEY]: JSON.stringify({ key: 0, speed: 1.2, tune: 0, cut: false }) })).toEqual({ key: 0, speed: 1.2, tune: 0, cut: false });
    expect(voiceTuneOf({ [VOICE_TUNE_KEY]: '{"key":40}' })).toEqual({ ...D, key: 8 });
    // a member who saved settings of their own before the default moved keeps them, whole (also the old default's key)
    expect(voiceTuneOf({ [VOICE_TUNE_KEY]: JSON.stringify({ key: 6, speed: 1.6, tune: 0.6, cut: true }) })).toEqual({ key: 6, speed: 1.6, tune: 0.6, cut: true });
    expect(isDefaultVoiceTune({ key: 6, speed: 1.8, tune: 0.6, cut: true })).toBe(false);
    for (const j of [{}, null, undefined, { [VOICE_TUNE_KEY]: 'not json' }, { [VOICE_TUNE_KEY]: '' }]) expect(voiceTuneOf(j)).toEqual(D);
    expect(isDefaultVoiceTune(voiceTuneOf({}))).toBe(true);
    expect(VoiceTuneBody.safeParse({ key: 3, reset: false }).success).toBe(true);
    expect(VoiceTuneBody.safeParse({ key: '3' }).success).toBe(false);
    expect(VoiceTuneBody.safeParse({ speed: Infinity }).success).toBe(false);
  });
});

describe('the words to {bati} about the voice settings', () => {
  it('「声の設定」 asks where they are', () => {
    for (const s of ['声の設定', '声の設定を変えたい', 'こえのせっていをひらいて', 'ボイスの設定', 'ボイスチェンジ']) expect(set(s)).toBe('open');
  });

  it('lower / higher: two semitones (a little: one, a lot: four)', () => {
    expect(set('声を低くして')).toEqual({ ...D, key: 0 });
    expect(set('こえをひくくして')).toEqual({ ...D, key: 0 });
    expect(set('声をもう少し低くして')).toEqual({ ...D, key: 1 });
    expect(set('声をすごく低くして')).toEqual({ ...D, key: -2 });
    expect(set('声を高くして')).toEqual({ ...D, key: 4 });
    expect(set('声のキーを+3にして')).toEqual({ ...D, key: 3 });
    expect(set('声のキーを－２にして')).toEqual({ ...D, key: -2 });
    expect(set('キーを0に', D, true)).toEqual({ ...D, key: 0 });
  });

  it('slower / faster: 0.2 at a time, or the number of times said', () => {
    expect(set('声をもっとゆっくりにして')).toEqual({ ...D, speed: 1.6 });
    expect(set('もっとゆっくり', D, true)).toEqual({ ...D, speed: 1.6 });
    expect(set('声を速くして', { ...D, speed: 1.4 })).toEqual({ ...D, speed: 1.6 });
    expect(set('声の速さを1.5倍にして')).toEqual({ ...D, speed: 1.5 });
    expect(set('声のスピードを１．２倍に')).toEqual({ ...D, speed: 1.2 });
    expect(set('声の速さをふつうにして')).toEqual({ ...D, speed: 1 });
  });

  it('the autotune: none, on again, stronger, weaker, a number', () => {
    expect(set('オートチューンをなしにして')).toEqual({ ...D, tune: 0 });
    expect(set('オートチューンはいらない')).toEqual({ ...D, tune: 0 });
    expect(set('オートチューンをオフ')).toEqual({ ...D, tune: 0 });
    expect(set('オートチューンを強くして')).toEqual({ ...D, tune: 0.8 });
    expect(set('オートチューンをもう少し弱く')).toEqual({ ...D, tune: 0.5 });
    expect(set('オートチューンを最大に')).toEqual({ ...D, tune: 1 });
    expect(set('オートチューンを0.3に')).toEqual({ ...D, tune: 0.3 });
    expect(set('オートチューンを80%にして')).toEqual({ ...D, tune: 0.8 });
    expect(set('オートチューンをつけて', { ...D, tune: 0 })).toEqual(D);
  });

  it('「間をつめる」 on / off', () => {
    expect(set('間をつめないで')).toEqual({ ...D, cut: false });
    expect(set('声の間はそのままにして')).toEqual({ ...D, cut: false });
    expect(set('間をつめて', { ...D, cut: false })).toEqual(D);
    // already so: {bati} says where the settings are
    expect(set('間をつめて')).toBe('open');
  });

  it('「もとの声に近づけて」: half-way back to the voice as recorded; 「もとの声のままで」: the voice as recorded', () => {
    expect(set('もとの声に近づけて')).toEqual({ key: 1, speed: 1.4, tune: 0.3, cut: true });
    expect(set('自分の声に近づけて', { key: 3, speed: 1.4, tune: 0.3, cut: true })).toEqual({ key: 1, speed: 1.2, tune: 0.2, cut: true });
    expect(set('もとの声のままで送りたい')).toEqual({ key: 0, speed: 1, tune: 0, cut: true });
    expect(set('声の加工をなしにして')).toEqual({ key: 0, speed: 1, tune: 0, cut: true });
  });

  it('several at once', () => {
    expect(set('声を低くして、もっとゆっくり、オートチューンはなしで')).toEqual({ key: 0, speed: 1.6, tune: 0, cut: true });
  });

  it('〔もとにもどす〕; 「きいてみる」 is answered in words (the sender never hears their own voice: no chip, nothing played)', () => {
    expect(set('声の設定をもとにもどして')).toBe('reset');
    expect(set('声をリセット')).toBe('reset');
    expect(set(VOICE_TUNE_CHIPS.reset, D, true)).toBe('reset');
    for (const s of ['きいてみる', '聞いてみたい', 'ためしてみて', 'どんな声？']) expect(set(s, D, true)).toBe('listen');
    expect(Object.keys(VOICE_TUNE_CHIPS)).toEqual(['reset']);
    expect(Object.keys(VOICE_TUNE_LINES)).not.toContain('preview');
    // outside the talk about them these short words are another matter
    expect(set(VOICE_TUNE_CHIPS.reset)).toBeNull();
    expect(set('きいてみる')).toBeNull();
  });

  it('already at the end of the range: nothing moves, {bati} says so', () => {
    expect(set('声を高くして', { ...D, key: 8 })).toBe('limit');
    expect(set('声をゆっくりにして', { ...D, speed: 1 })).toBe('limit');
    expect(set('声を低くして', { ...D, key: -5 })).toEqual({ ...D, key: -6 });
  });

  it('words that are not about the voice settings are left alone (a song’s 「もっとゆっくり」, a talk about a low voice …)', () => {
    for (const s of ['もっとゆっくり', '速くして', 'もとにもどす', 'この曲、テンポを速くして', 'タイトルは「声」にして', 'こんにちは', '大きな声で歌う曲を作って', '時間がない', 'キーを上げて', ''])
      expect(voiceTuneTalk(s, D)).toBeNull();
    // in the talk about them, words about something else are still something else
    for (const s of ['ありがとう', '曲を作って', 'それでいいよ']) expect(voiceTuneTalk(s, D, true)).toBeNull();
    expect(voiceTuneTalk('声'.repeat(80), D)).toBeNull();
  });

  it('{bati}’s lines carry the settings in words', () => {
    for (const k of ['open', 'changed', 'limit', 'reset', 'noListen'] as const) expect(VOICE_TUNE_LINES[k]).toContain('{now}');
  });
});
