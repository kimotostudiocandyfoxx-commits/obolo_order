import { describe, expect, it } from 'vitest';
import {
  BATI_PERSONALITIES,
  BATI_ORDINARY_IDS,
  BATI_PERSONALITY_IDS,
  BATI_RARE_IDS,
  isBatiRare,
  batiDaysLeftLine,
  batiDefaultCall,
  batiPersonalityFromSeed,
  batiRuleTransform,
  batiSelf,
  pickBatiPersonality,
  resolveBatiSpeech,
} from './batiPersona';

describe("{bati}'s personality (M-R215 / M-R216)", () => {
  it('eight ordinary and twelve rare personalities; the fallback draw is among the ordinary ones', () => {
    expect(BATI_ORDINARY_IDS).toHaveLength(8);
    expect(BATI_RARE_IDS).toHaveLength(12);
    expect(BATI_PERSONALITY_IDS).toHaveLength(20);
    expect(isBatiRare('ninja')).toBe(true);
    expect(isBatiRare('kansai')).toBe(false);
    const seen = new Set<string>();
    for (let k = 0; k < 800; k++) seen.add(pickBatiPersonality(k / 800));
    expect(seen.size).toBe(8);
    expect(pickBatiPersonality(0)).toBe('genki');
    expect(pickBatiPersonality(0.9999)).toBe('king');
  });

  it('a seed always gives the same personality (old {bati} keep theirs)', () => {
    expect(batiPersonalityFromSeed('user-1:b1')).toBe(batiPersonalityFromSeed('user-1:b1'));
  });

  it('the default 一人称 follows the egg (moon → the second form), a custom one wins', () => {
    expect(batiSelf('baby', 'sun')).toBe('ぼく');
    expect(batiSelf('baby', 'moon')).toBe('あたち');
    expect(batiSelf('king', 'moon')).toBe('余');
    expect(batiSelf('cool', 'moon', 'ぼくちん')).toBe('ぼくちん');
  });

  it('resolves {self} and a custom 呼び方 (the honorific goes with the name, the calling tail stays)', () => {
    expect(resolveBatiSpeech('{self}が、{neo}さまをお守りします', { personality: 'keigo' })).toBe('わたくしが、{neo}さまをお守りします');
    expect(resolveBatiSpeech('はい！ 参ります、{neo}さま！', { personality: 'keigo', call: 'たっくん' })).toBe('はい！ 参ります、たっくん！');
    expect(resolveBatiSpeech('{neo}よ、見事であるぞ！', { personality: 'king', call: 'ひめ' })).toBe('ひめよ、見事であるぞ！');
    // a 呼び方 with the name in it keeps the name; the birth's 一人称 stands until the member changes it
    expect(resolveBatiSpeech('実に、お見事でございます、{neo}さま。', { personality: 'butler', call: '{neo}お嬢さま' })).toBe('実に、お見事でございます、{neo}お嬢さま。');
    expect(resolveBatiSpeech('{self}が参ります', { personality: 'gal', egg: 'moon', bornSelf: 'ウチ' })).toBe('ウチが参ります');
    expect(batiDefaultCall('gal')).toBe('{neo}っち');
    expect(batiDefaultCall('poet')).toBe('君');
    // 元気な子 is the script itself: its ボク is its 一人称
    expect(resolveBatiSpeech('ボク、調べてみる！', { personality: 'genki', self: 'わたし' })).toBe('わたし、調べてみる！');
  });

  it('the rule fallback changes only the manner (deterministic)', () => {
    expect(batiRuleTransform('いくよ、{neo}！', 'genki')).toBe('いくよ、{neo}！');
    expect(batiRuleTransform('作れるよ！', 'keigo')).toBe('作れます！');
    expect(batiRuleTransform('うん！ いくよ、{neo}！', 'keigo')).toBe('はい！ いきます、{neo}さま！');
    expect(batiRuleTransform('それは、すごいね！', 'baby')).toContain('しゅごい');
    expect(batiRuleTransform('いくよ、{neo}！', 'kansai')).toBe('いくで、{neo}！');
    expect(batiRuleTransform('いくよ、{neo}！', 'cool')).toBe('……いく、{neo}。');
    expect(batiRuleTransform('いくよ、{neo}！', 'king')).toBe('いくぞ、{neo}よ！');
    expect(batiRuleTransform('いくよ、{neo}！', 'mellow')).toBe('いくよぉ、{neo}〜。');
    expect(batiRuleTransform('すごいね！', 'clumsy')).toBe('すご……すごいね！');
    expect(batiRuleTransform('ボクが描くよ！', 'keigo')).toContain('{self}');
    for (const p of BATI_PERSONALITY_IDS) expect(batiRuleTransform('いくよ、{neo}！', p)).toBe(batiRuleTransform('いくよ、{neo}！', p));
  });

  it("the atelier's days-left line in each manner (M-R216's example)", () => {
    expect(batiDaysLeftLine('genki', 2)).toBe('それは、あと2日で作れるようになるよ。');
    expect(batiDaysLeftLine('keigo', 2)).toBe(BATI_PERSONALITIES.keigo.examples[2][1]);
    expect(batiDaysLeftLine('clumsy', 2)).toBe(BATI_PERSONALITIES.clumsy.examples[2][1]);
    for (const p of BATI_PERSONALITY_IDS) expect(batiDaysLeftLine(p, 5)).toMatch(/5/);
  });
});

import { callRequest, memoryRefusal, rememberRequest } from './batiMemory';

describe("what {bati} remembers (M-R222), and what is never kept", () => {
  const adult = { birthYear: 1990 };
  it('refuses an address, a phone, an email, a school or company, a password, money, others\' details, health details', () => {
    expect(memoryRefusal('東京都渋谷区に住んでる', adult)).toBe('address');
    expect(memoryRefusal('電話は090-1234-5678', adult)).toBe('phone');
    expect(memoryRefusal('neo@example.com に送って', adult)).toBe('email');
    expect(memoryRefusal('さくら小学校に通ってる', adult)).toBe('school_company');
    expect(memoryRefusal('パスワードは1234', adult)).toBe('secret');
    expect(memoryRefusal('口座の残高が少ない', adult)).toBe('money');
    expect(memoryRefusal('お母さんの電話を覚えて', adult)).not.toBeNull();
    expect(memoryRefusal('持病の薬を飲んでる', adult)).toBe('health');
  });
  it('lets the ordinary things through', () => {
    for (const t of ['ネオって呼んで', '金曜が曲の締め切り', '朝が弱い']) expect(memoryRefusal(t, adult)).toBeNull();
  });
  it('is stricter under 15 (and while the birth year is not known)', () => {
    expect(memoryRefusal('ゆうきくんと遊んだ', adult)).toBeNull();
    expect(memoryRefusal('ゆうきくんと遊んだ', { birthYear: new Date().getFullYear() - 10 })).toBe('other_person');
    expect(memoryRefusal('駅の近くが好き', { birthYear: null })).toBe('address');
    expect(memoryRefusal('学校のクラスが好き', { child: true })).toBe('school_company');
  });
  it('a memory only from the member\'s own 「覚えといて」; 「〇〇って呼んで」 changes the 呼び方', () => {
    expect(rememberRequest('金曜が曲の締め切りだから、覚えといて')).toBe('金曜が曲の締め切り');
    expect(callRequest('ネオっちって呼んで')).toBe('ネオっち');
    expect(callRequest('これからは「たっくん」って呼んでね')).toBe('たっくん');
    expect(callRequest('呼んでないよ')).toBeNull();
    expect(rememberRequest('金曜が曲の締め切り、覚えておいて')).toBe('金曜が曲の締め切り');
    expect(rememberRequest('金曜が締め切りって覚えといて！')).toBe('金曜が締め切り');
    expect(rememberRequest('これ、覚えといてね', '来週は発表会')).toBe('来週は発表会');
    expect(rememberRequest('金曜が締め切りなんだ')).toBeNull();
    expect(rememberRequest('覚えてる？')).toBeNull();
  });
});
