import { describe, expect, it } from 'vitest';
import {
  BATI_PERSONALITIES,
  BATI_ORDINARY_IDS,
  BATI_PERSONALITY_IDS,
  BATI_RARE_IDS,
  isBatiRare,
  BATI_SPEECH_RULES,
  hasBannedBatiWord,
  isBatiGal,
  BATI_COMMON_IDS,
  BATI_GAL_IDS,
  batiPersonaByRules,
  batiStyleWeights,
  drawBatiStyle,
  normalizeBatiPersonality,
  pickBatiTrait,
  BATI_TRAITS,
  batiDaysLeftLine,
  batiDefaultCall,
  batiPersonalityFromSeed,
  batiRuleTransform,
  batiSelf,
  pickBatiPersonality,
  resolveBatiSpeech,
} from './batiPersona';

describe("{bati}'s way of speaking (M-R225 / M-R226)", () => {
  it('six common, five gal and six rare styles (17), none of the retired ones', () => {
    expect(BATI_COMMON_IDS).toEqual(['genki', 'teinei', 'kansai', 'cool', 'mellow', 'amae']);
    expect(BATI_GAL_IDS).toEqual(['gal', 'galfuwa', 'galane', 'galcool', 'galkansai']);
    expect(BATI_RARE_IDS).toEqual(['hakata', 'tohoku', 'okinawa', 'bushi', 'butler', 'king']);
    expect(BATI_PERSONALITY_IDS).toHaveLength(17);
    for (const gone of ['keigo', 'baby', 'clumsy', 'poet', 'rapper', 'nekketsu', 'philosopher', 'alien', 'ninja']) expect((BATI_PERSONALITY_IDS as readonly string[]).includes(gone)).toBe(false);
    expect(isBatiRare('gal')).toBe(false);
    expect(isBatiGal('galane')).toBe(true);
    expect(isBatiRare('bushi')).toBe(true);
    expect(batiDefaultCall('galfuwa')).toBe('{neo}ちゃん');
  });

  it('the first {bati}: gal about 35 %, the other common about 50 %, rare about 15 % (the rule path, many seeds)', () => {
    const n = 4000;
    const c = { gal: 0, common: 0, rare: 0 };
    for (let k = 0; k < n; k++) {
      const p = batiPersonaByRules(`種${k}`, 'sun', (k * 0.6180339887) % 1).personality;
      c[isBatiGal(p) ? 'gal' : isBatiRare(p) ? 'rare' : 'common']++;
    }
    expect(Math.abs(c.gal / n - 0.35)).toBeLessThan(0.04);
    expect(Math.abs(c.common / n - 0.5)).toBeLessThan(0.04);
    expect(Math.abs(c.rare / n - 0.15)).toBeLessThan(0.04);
    // a regional food keeps its dialect (関西: now and then 関西ギャル); a sweet leans to the gal family
    expect(['kansai', 'galkansai']).toContain(batiPersonaByRules('たこ焼き', 'sun', 0.9).personality);
    expect(batiPersonaByRules('明太子', 'sun', 0.5).personality).toBe('hakata');
    expect(isBatiGal(batiPersonaByRules('タピオカ', 'sun', 0.2).personality)).toBe(true);
  });

  it('never the same style twice among the three (different gal kinds are fine)', () => {
    for (let k = 0; k < 300; k++) {
      const p = batiPersonaByRules('たこ焼き', 'sun', k / 300, { exclude: ['kansai', 'galkansai'] }).personality;
      expect(['kansai', 'galkansai']).not.toContain(p);
      expect(drawBatiStyle(k / 300, { exclude: ['gal'] })).not.toBe('gal');
    }
    expect(batiStyleWeights({ exclude: ['gal'] }).some(([id]) => id === 'galfuwa')).toBe(true);
  });

  it('a 仕事・勉強 {bati} leans to 姉御ギャル / クールギャル', () => {
    const w = (role?: 'work') => Object.fromEntries(batiStyleWeights({ role }));
    expect(w('work').galane).toBeGreaterThan(w().galane * 1.5);
    expect(w('work').galcool).toBeGreaterThan(w('work').gal * 2);
    expect(w('work').genki).toBeCloseTo(w().genki);
  });

  it('an old style is read as the nearest new one', () => {
    expect(normalizeBatiPersonality('keigo')).toBe('teinei');
    expect(normalizeBatiPersonality('baby')).toBe('genki');
    expect(normalizeBatiPersonality('clumsy')).toBe('genki');
    expect(normalizeBatiPersonality('kansai')).toBe('kansai');
    expect(normalizeBatiPersonality('ninja')).toBe('bushi');
    expect(normalizeBatiPersonality('???')).toBe('genki');
  });

  it('a seed always gives the same style (old {bati} keep theirs)', () => {
    expect(batiPersonalityFromSeed('user-1:b1')).toBe(batiPersonalityFromSeed('user-1:b1'));
  });

  it('the 一人称 by the egg (sun / moon), a custom one wins; the 呼び方', () => {
    expect(batiSelf('teinei', 'sun')).toBe('僕');
    expect(batiSelf('kansai', 'moon')).toBe('ウチ');
    expect(batiSelf('kansai', 'sun')).toBe('オレ');
    expect(batiSelf('king', 'moon')).toBe('わらわ');
    expect(batiSelf('gal', 'moon')).toBe('ウチ');
    expect(batiSelf('galcool', 'moon')).toBe('あたし');
    expect(batiSelf('cool', 'moon', 'ぼくちん')).toBe('ぼくちん');
    expect(batiDefaultCall('teinei')).toBe('{neo}さん');
    expect(batiDefaultCall('bushi')).toBe('{neo}殿');
    expect(batiDefaultCall('butler')).toBe('{neo}さま');
    expect(batiDefaultCall('gal')).toBe('{neo}っち');
    expect(BATI_PERSONALITIES.teinei.example).toBe('{neo}さん、すごいデス！');
  });

  it('resolves {self} and a custom 呼び方 (the honorific goes with the name)', () => {
    expect(resolveBatiSpeech('{self}が、{neo}さんを手伝いマス', { personality: 'teinei' })).toBe('僕が、{neo}さんを手伝いマス');
    expect(resolveBatiSpeech('いきます、{neo}さん！', { personality: 'teinei', call: 'たっくん' })).toBe('いきます、たっくん！');
    expect(resolveBatiSpeech('お見事でございます、{neo}さま。', { personality: 'butler', call: '{neo}お嬢さま' })).toBe('お見事でございます、{neo}お嬢さま。');
    expect(resolveBatiSpeech('ボク、調べてみる！', { personality: 'genki', self: 'わたし' })).toBe('わたし、調べてみる！');
  });

  it('the rule fallback: the 一人称, the honorific, an ending in at most half the sentences (deterministic)', () => {
    expect(batiRuleTransform('いくよ、{neo}！', 'genki')).toBe('いくよ、{neo}！');
    expect(batiRuleTransform('ボクが描くよ！', 'teinei')).toContain('{self}');
    const two = batiRuleTransform('工房は、逃げないよ！　ぜんぶ、しまってあるよ！', 'kansai');
    const changed = two.split('！').filter((x, k) => x.trim() && x.trim() !== ['工房は、逃げないよ', '　ぜんぶ、しまってあるよ'][k]?.trim()).length;
    expect(changed).toBeLessThanOrEqual(1);
    for (const p of BATI_PERSONALITY_IDS) expect(batiRuleTransform('いくよ、{neo}！', p)).toBe(batiRuleTransform('いくよ、{neo}！', p));
  });

  it("the atelier's days-left line in each style", () => {
    expect(batiDaysLeftLine('genki', 2)).toBe('それは、あと2日で作れるようになるよ。');
    expect(batiDaysLeftLine('teinei', 2)).toContain('マス');
    for (const p of BATI_PERSONALITY_IDS) expect(batiDaysLeftLine(p, 5)).toMatch(/5/);
  });

  it('the card\'s trait is one word from the list', () => {
    expect(BATI_TRAITS).toContain(pickBatiTrait(0.3));
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

import { BATI_VARIANTS } from './batiVariants';

describe('M-R229: 「あーし」 nowhere', () => {
  it('no style, example, rule or written line has it', () => {
    expect(JSON.stringify(BATI_PERSONALITIES)).not.toContain('あーし');
    expect(JSON.stringify(BATI_VARIANTS)).not.toContain('あーし');
    expect(BATI_SPEECH_RULES.join('')).toContain('「あーし」は使わない');
    expect(hasBannedBatiWord('あーしが行く')).toBe(true);
  });
});
