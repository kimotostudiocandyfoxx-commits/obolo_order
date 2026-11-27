import { describe, expect, it } from 'vitest';
import {
  bookTags,
  gameTags,
  goodsTags,
  mvTags,
  PLANET_GAME_GENRES,
  PLANET_GAME_STYLES,
  PLANET_GOODS_KINDS,
  PLANET_RADIO_MOODS,
  PLANET_STORY_FEELINGS,
  PLANET_STORY_GENRES,
  PLANET_STORY_LENGTHS,
  PLANET_VOICE_TOPICS,
  radioTags,
  songTags,
  storyLength,
  workScore,
} from './planetWorks';
import { spellFrom } from './spell';
import type { SpellTag } from './spell';

const t = (ja: string, group: SpellTag['group']): SpellTag => ({ ja, en: ja, group });

describe('handoff 05 「作品のタグ」 (2-1 for Mars, Venus, Uranus, Pluto, Neptune)', () => {
  it('火星 MV: the song’s genre and moods, inherited (no tempo of its own)', () => {
    const design = { genre: 'ハウス', mood: '夜, おしゃれ', bpm: 124 };
    const mv = mvTags(design);
    expect(mv.main).toBe(songTags(design).main);
    expect(mv.main).toBe('EDM');
    expect(mv.moods).toEqual(songTags(design).moods);
    expect(mv.moods).toEqual(expect.arrayContaining(['ダンス', '夜', 'おしゃれ']));
    expect(mv.bpm).toBeNull();
    expect(mvTags(null)).toEqual({ main: null, moods: [], bpm: null });
  });

  it('金星 ラジオ: the topic in Saturn’s words, how it is spoken from the title, loop, hour and songs on air', () => {
    // 23:30 in Japan = 14:30 UTC
    const night = radioTags({ title: '推しのライブの話', loop: 'pulse', cues: 4, at: '2026-11-25T14:30:00Z' });
    expect(night.main).toBe('推し');
    expect(night.moods).toEqual(['にぎやか', '深夜', '音楽たっぷり']);
    const morning = radioTags({ title: 'おはようラジオ', loop: 'ripple', cues: 0, at: '2026-11-25T22:00:00Z' });
    expect(morning.main).toBe('朝');
    expect(morning.moods).toEqual(['朝', 'しっとり', 'トーク']);
    // nothing said: 雑談, and only what the settings tell
    expect(radioTags({ title: 'こんにちは', loop: 'drift' })).toEqual({ main: '雑談', moods: ['ゆったり'], bpm: null });
    for (const r of [night, morning]) {
      expect(PLANET_VOICE_TOPICS).toContain(r.main);
      for (const m of r.moods) expect(PLANET_RADIO_MOODS).toContain(m);
      expect(r.moods.length).toBeLessThanOrEqual(4);
    }
  });

  it('天王星 グッズ: the kind of goods, then the printed art’s style and moods (Jupiter’s vocabulary)', () => {
    const art = [t('水彩', 'style'), t('夕焼け', 'light'), t('ねこ', 'theme')];
    const g = goodsTags('トートバッグ', art);
    expect(g.main).toBe('トート');
    expect(g.moods[0]).toBe('水彩');
    expect(g.moods).toEqual(expect.arrayContaining(['あたたか', 'ねこ', 'どうぶつ']));
    expect(goodsTags('アクリルスタンド').main).toBe('アクスタ');
    expect(goodsTags('Tシャツ').main).toBe('Tシャツ');
    expect(goodsTags('缶バッジ').main).toBe('缶バッジ');
    expect(goodsTags('ステッカー').main).toBe('ステッカー');
    expect(PLANET_GOODS_KINDS).toEqual(expect.arrayContaining(['トート', 'Tシャツ', 'ステッカー', 'アクスタ']));
    expect(goodsTags(null)).toEqual({ main: null, moods: [], bpm: null });
  });

  it('冥王星 物語: the genre from the book’s spell, its length from what is written, its feeling', () => {
    const fantasy = bookTags(spellFrom('novel', '魔法の森で猫が冒険する、わくわくする話'), 1800);
    expect(fantasy.main).toBe('ファンタジー');
    expect(fantasy.moods[0]).toBe('短い');
    expect(fantasy.moods).toContain('わくわく');
    expect(bookTags([t('ちょっと怖い', 'genre')], 9000)).toEqual({ main: 'ホラー', moods: ['中くらい', 'こわい'], bpm: null });
    expect(bookTags([t('学園もの', 'genre'), t('おもしろい', 'mood')], 20000)).toEqual({ main: '日常', moods: ['長い', '笑える'], bpm: null });
    // no genre talisman: the words (a love story), else 日常; nothing written yet: the spell's length
    expect(bookTags([t('告白', 'theme'), t('切ない', 'mood'), t('長め', 'length')]).moods).toEqual(['長い', '泣ける']);
    expect(bookTags([t('告白', 'theme')]).main).toBe('恋愛');
    expect(bookTags([]).main).toBe('日常');
    expect(storyLength(0, '短め')).toBe('短い');
    expect(storyLength(0, null)).toBe('中くらい');
    for (const b of [fantasy, bookTags([t('SF', 'genre')]), bookTags([t('ミステリー', 'genre'), t('やさしい', 'mood')])]) {
      expect(PLANET_STORY_GENRES).toContain(b.main);
      expect(PLANET_STORY_LENGTHS).toContain(b.moods[0]);
      for (const m of b.moods.slice(1)) expect(PLANET_STORY_FEELINGS).toContain(m);
    }
  });

  it('海王星 ゲーム: the genre, then alone / together and quick / slow', () => {
    expect(gameTags(spellFrom('game', '集めるゲームで60秒、かんたん'))).toEqual({ main: 'アクション', moods: ['ひとりで', 'すぐ終わる'], bpm: null });
    expect(gameTags([t('パズル', 'genre'), t('ハイスコア', 'goal')])).toEqual({ main: 'パズル', moods: ['ひとりで', 'じっくり'], bpm: null });
    expect(gameTags([t('クイズ', 'genre')]).main).toBe('クイズ');
    expect(gameTags([t('シューティング', 'genre'), t('ライフ3つ', 'rule')]).moods).toEqual(['ひとりで', 'じっくり']);
    // words that name a race or a rhythm game win (the spell has no talisman for them); playing together
    expect(gameTags([t('ジャンプ', 'genre')], 'ねこレース').main).toBe('レース');
    expect(gameTags([t('タップ', 'genre'), t('リズム', 'theme')]).main).toBe('リズム');
    expect(gameTags([t('対戦', 'rule')]).moods[0]).toBe('みんなで');
    expect(gameTags([])).toEqual({ main: 'アクション', moods: ['ひとりで'], bpm: null });
    for (const g of [gameTags([t('よける', 'genre'), t('むずかしい', 'level')]), gameTags([t('ブロックくずし', 'genre')])]) {
      expect(PLANET_GAME_GENRES).toContain(g.main);
      for (const m of g.moods) expect(PLANET_GAME_STYLES).toContain(m);
    }
  });

  it('07: Pluto’s moods gather 魔法・宇宙・冒険, Neptune’s レトロ・ドット絵, Uranus’s 和モダン', () => {
    const fantasy = bookTags(spellFrom('novel', '魔法の森で猫が冒険する、わくわくする話'), 1800);
    expect(fantasy.moods).toEqual(expect.arrayContaining(['魔法', '冒険', 'わくわく']));
    expect(bookTags([t('SF', 'genre'), t('宇宙船', 'theme')]).moods).toContain('宇宙');
    expect(bookTags([t('冒険', 'genre')]).moods).toEqual(['中くらい', 'わくわく', '冒険']);
    expect(bookTags([t('切ない', 'mood'), t('おもしろい', 'mood'), t('やさしい', 'mood'), t('魔女', 'hero'), t('冒険', 'genre')]).moods.length).toBeLessThanOrEqual(5);
    expect(gameTags([t('シューティング', 'genre'), t('ドット絵', 'style'), t('レトロ', 'style')]).moods).toEqual(['ひとりで', 'レトロ', 'ドット絵']);
    expect(gameTags([t('ジャンプ', 'genre')], '8bitダンジョン').moods).toEqual(expect.arrayContaining(['レトロ', 'ドット絵']));
    expect(gameTags([t('パズル', 'genre')]).moods).not.toContain('レトロ');
    for (const m of ['レトロ', 'ドット絵']) expect(PLANET_GAME_STYLES).toContain(m);
    for (const m of ['魔法', '宇宙', '冒険']) expect(PLANET_STORY_FEELINGS).toContain(m);
    const wa = goodsTags('マグカップ', [t('和モダン', 'style'), t('花', 'theme')]);
    expect(wa.moods[0]).toBe('和モダン');
    // words alone (a theme, no style) bring 和モダン and 和風
    expect(goodsTags('トート', [t('和モダン', 'theme')]).moods).toEqual(expect.arrayContaining(['和モダン', '和風']));
    // Uranus's 和モダン堂 (rule m: 和風, 和モダン) and Neptune's retro dome take them
    expect(workScore(wa, { g: [], m: ['和風', '和モダン'] })).toBeGreaterThanOrEqual(2);
  });
});
