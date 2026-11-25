import { describe, expect, it } from 'vitest';
import { continentsOf, PLANET_VOICE_MOODS, PLANET_VOICE_TOPICS, voiceTags, voiceTagsOfWords, type ContinentRule } from './planetWorks';

/** the prototype's Saturn plazas (design/home/template.html RULE.saturn), the same as the 0057 seed */
const SATURN: { key: string; rule: ContinentRule }[] = [
  { key: 'chat', rule: { g: ['雑談'], m: ['ゆるい', '日常'] } },
  { key: 'koi', rule: { g: ['恋バナ'], m: ['好きな人', 'ドキドキ'] } },
  { key: 'oshi', rule: { g: ['推し'], m: ['アイドル', 'ライブ'] } },
  { key: 'school', rule: { g: ['学校'], m: ['部活', 'テスト'] } },
  { key: 'night', rule: { g: ['夜'], m: ['深夜', '眠れない'] } },
  { key: 'game', rule: { g: ['ゲーム'], m: ['対戦', '実況'] } },
  { key: 'warai', rule: { g: ['お笑い'], m: ['ボケ', 'ツッコミ'] } },
  { key: 'anime', rule: { g: ['アニメ'], m: ['名シーン', 'マンガ'] } },
  { key: 'asa', rule: { g: ['朝'], m: ['おはよう', '元気'] } },
  { key: 'nemui', rule: { g: ['眠い'], m: ['おやすみ'] } },
];

describe('planets 2-1 Saturn (M-R316): a voice kororin’s topic and moods', () => {
  it('keeps the model’s answer to the vocabulary (unknown topic → 雑談, unknown moods dropped, at most 4)', () => {
    expect(voiceTags('恋バナ', ['ドキドキ', '好きな人'])).toEqual({ main: '恋バナ', moods: ['ドキドキ', '好きな人'], bpm: null });
    expect(voiceTags('料理', ['おいしい', '日常'])).toEqual({ main: '雑談', moods: ['日常'], bpm: null });
    expect(voiceTags(null, 'x').moods).toEqual([]);
    expect(voiceTags('#推し', ['ライブ', 'ライブ', 'アイドル', '元気', 'ゆるい', '日常']).moods).toEqual(['ライブ', 'アイドル', '元気', 'ゆるい']);
    for (const t of PLANET_VOICE_TOPICS) expect(voiceTags(t, []).main).toBe(t);
    expect(PLANET_VOICE_MOODS.length).toBeGreaterThan(15);
  });

  it('the word rules read the prototype’s sample words into the plaza they were written for', () => {
    const cases: [string, string][] = [
      ['好きな人と目が合った…！', 'koi'],
      ['推しのライブ当たった！', 'oshi'],
      ['明日テストなの忘れてた', 'school'],
      ['眠れない人、いる？', 'night'],
      ['ランクやっと上がった！', 'game'],
      ['ツッコミ待ちです', 'warai'],
      ['最終回で泣いた', 'anime'],
      ['おはよう！今日もがんばろ', 'asa'],
      ['もう眠い…おやすみ', 'nemui'],
      ['コンビニの新作、当たりだった', 'chat'],
    ];
    for (const [words, key] of cases) expect(continentsOf(voiceTagsOfWords(words), SATURN), words).toContain(key);
  });

  it('the prototype’s tagged samples drift to their plazas (workScore ≥ 2)', () => {
    expect(continentsOf(voiceTags('雑談', ['ゆるい', '日常']), SATURN)).toEqual(['chat']);
    expect(continentsOf(voiceTags('学校', ['お笑い']), SATURN)).toEqual(['school']);
    // a mood alone brings a kororin to another plaza too (片思い3か月目: 恋バナ + 夜)
    expect(continentsOf(voiceTags('眠い', ['ゆるい']), SATURN).sort()).toEqual(['chat', 'nemui']);
  });
});
