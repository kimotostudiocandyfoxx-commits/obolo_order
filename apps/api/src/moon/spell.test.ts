import { songGenreOf, spellFrom, type SpellTag } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { finishSpell, SpellService } from './spell.service';

const ja = (ts: { ja: string }[]) => ts.map((t) => t.ja);
const of = (ts: SpellTag[], g: string) => ts.filter((t) => t.group === g).map((t) => t.ja);
const t = (ja: string, en: string, group: string) => ({ ja, en, group });
/** a stand-in model: the answer for each request (the words), and what it was asked */
function model(answers: Record<string, unknown>, fail = false) {
  const asked: string[] = [];
  return {
    asked,
    llm: {
      name: 'test-model',
      chat: async (o: { history: { text: string }[] }) => {
        const req = JSON.parse(o.history[0].text) as { request: string };
        asked.push(req.request);
        if (fail) throw new Error('down');
        const a = answers[req.request];
        if (a === undefined) throw new Error(`no answer for ${req.request}`);
        return typeof a === 'string' ? a : JSON.stringify(a);
      },
    },
  };
}
const NOT_PSYTRANCE = ['ポップ', '明るい', 'ふつうの速さ', 'ピアノ', 'ドラム', 'やさしい歌声', 'おしゃれ', 'サイトラ'];

describe('R14: the spell is the model’s first, the rules stand under it', () => {
  it("「サイケデリックトランスの曲を作りたい」: a psytrance spell, nothing that goes against it", async () => {
    const m = model({
      サイケデリックトランスの曲を作りたい: {
        tags: [t('サイケデリックトランス', 'psytrance', 'genre'), t('催眠的', 'hypnotic', 'mood'), t('トリッピー', 'trippy', 'mood'), t('145BPM', '145 BPM', 'tempo'), t('うねるベース', 'rolling 16th bassline', 'instrument'), t('アシッドシンセ', 'acid 303', 'instrument'), t('サイケな効果音', 'trippy FX', 'instrument'), t('声すこしだけ', 'minimal vocals', 'voice')],
      },
    });
    const v = await new SpellService(m.llm as never).spell({ kind: 'song', said: 'サイケデリックトランスの曲を作りたい' });
    expect(v.how).toBe('model');
    expect(of(v.tags, 'genre')).toEqual(['サイケデリックトランス']);
    const bpm = Number(of(v.tags, 'tempo')[0].replace('BPM', ''));
    expect(bpm).toBeGreaterThanOrEqual(140);
    expect(bpm).toBeLessThanOrEqual(148);
    expect(of(v.tags, 'instrument')).toEqual(expect.arrayContaining(['うねるベース', 'アシッドシンセ']));
    for (const x of NOT_PSYTRANCE) expect(ja(v.tags)).not.toContain(x);
    // the English the engine gets is psytrance's
    expect(v.tags.find((x) => x.group === 'genre')?.en).toMatch(/psytrance|psychedelic trance/);
  });

  it('a poor answer is made whole: サイトラ reads サイケデリックトランス, contradicting defaults and request words go, empty groups get the genre’s own', () => {
    const tags = finishSpell('song', [t('サイトラ', 'psytrance', 'genre'), t('ピアノ', 'piano', 'instrument'), t('やさしい歌声', 'soft vocals', 'voice'), t('ふつうの速さ', 'mid tempo', 'tempo'), t('作りたい', 'want to make', 'theme'), t('曲', 'song', 'theme')], { said: 'サイトラの曲を作りたい', rules: spellFrom('song', 'サイトラの曲を作りたい'), fresh: true })!;
    expect(of(tags, 'genre')).toEqual(['サイケデリックトランス']);
    for (const x of NOT_PSYTRANCE) expect(ja(tags)).not.toContain(x);
    expect(ja(tags)).not.toContain('作りたい');
    expect(ja(tags)).not.toContain('曲');
    expect(of(tags, 'tempo')).toEqual(['145BPM']);
    expect(of(tags, 'voice')).toEqual(['声すこしだけ']);
    expect(of(tags, 'instrument')).toEqual(expect.arrayContaining(['うねるベース', 'アシッドシンセ', '四つ打ち']));
  });

  it('the model down: the rules’ spell is psytrance-coherent too', async () => {
    const m = model({}, true);
    const v = await new SpellService(m.llm as never).spell({ kind: 'song', said: 'サイケデリックトランスの曲を作りたい' });
    expect(v.how).toBe('rules');
    expect(of(v.tags, 'genre')).toEqual(['サイケデリックトランス']);
    for (const x of NOT_PSYTRANCE) expect(ja(v.tags)).not.toContain(x);
  });

  it("「全然違うよ、サイケデリックトランスにして」 makes the style spell again (model), and by rule when the model is down", async () => {
    const pop = spellFrom('song', 'ノリのいい曲を作って');
    expect(of(pop, 'genre')).toEqual(['ポップ']);
    const said = '全然違うよ、サイケデリックトランスにして';
    const m = model({ [said]: { respelled: true, tags: [t('サイケデリックトランス', 'psytrance', 'genre'), t('催眠的', 'hypnotic', 'mood'), t('145BPM', '145 BPM', 'tempo'), t('うねるベース', 'rolling bassline', 'instrument'), t('アシッドシンセ', 'acid 303', 'instrument'), t('声すこしだけ', 'minimal vocals', 'voice')] } });
    const v = await new SpellService(m.llm as never).spell({ kind: 'song', said, tags: pop, history: [{ who: 'me', text: 'サイトラの曲を作りたい' }, { who: 'bati', text: '曲調のスペルはこんなんだね。' }] });
    expect(v.respelled).toBe(true);
    expect(of(v.tags, 'genre')).toEqual(['サイケデリックトランス']);
    expect(ja(v.removed)).toEqual(expect.arrayContaining(['ポップ', 'ピアノ', 'やさしい歌声']));
    for (const x of NOT_PSYTRANCE) expect(ja(v.tags)).not.toContain(x);
    const r = await new SpellService(model({}, true).llm as never).spell({ kind: 'song', said, tags: pop });
    expect(r.how).toBe('rules');
    expect(r.respelled).toBe(true);
    expect(of(r.tags, 'genre')).toEqual(['サイケデリックトランス']);
    for (const x of NOT_PSYTRANCE) expect(ja(r.tags)).not.toContain(x);
  });

  it('what the member named wins over the model: their genre, and an instrument even one the genre does not use', async () => {
    const m = model({
      テクノの曲: { tags: [t('ハウス', 'house', 'genre'), t('シンセ', 'synth', 'instrument')] },
      ピアノ入りのサイケデリックトランス: { tags: [t('サイケデリックトランス', 'psytrance', 'genre'), t('アシッドシンセ', 'acid', 'instrument')] },
    });
    const s = new SpellService(m.llm as never);
    expect(of((await s.spell({ kind: 'song', said: 'テクノの曲' })).tags, 'genre')).toEqual(['テクノ']);
    const p = await s.spell({ kind: 'song', said: 'ピアノ入りのサイケデリックトランス' });
    expect(of(p.tags, 'instrument')).toEqual(expect.arrayContaining(['ピアノ', 'アシッドシンセ']));
  });

  it('a plain take-off needs no model', async () => {
    const m = model({});
    const s = new SpellService(m.llm as never);
    const v = await s.spell({ kind: 'art', said: '水彩は外して', tags: spellFrom('art', '夜の海とクジラの絵') });
    expect(ja(v.removed)).toEqual(['水彩']);
    expect(m.asked).toEqual([]);
  });

  it('pictures, books, games: the model’s understanding, request words kept out, the kind’s defaults only where empty', async () => {
    const m = model({
      'ヤッホー、かわいい猫が宇宙を飛んでる絵を作って欲しいんだけど': { tags: [t('猫', 'a cute cat', 'theme'), t('宇宙', 'outer space', 'theme'), t('空を飛ぶ', 'flying', 'theme'), t('絵', 'picture', 'theme'), t('ヤッホー', 'hello', 'theme'), t('かわいい', 'cute', 'mood'), t('ゆめみたいな光', 'dreamy glow', 'light')] },
      'メガネの少年が魔法学校で謎を解く話': { tags: [t('ふしぎな学校', 'a mysterious school', 'world'), t('メガネの少年', 'a boy with glasses', 'hero'), t('ミステリー', 'gentle mystery', 'genre'), t('魔法', 'magic', 'theme')] },
    });
    const s = new SpellService(m.llm as never);
    const art = await s.spell({ kind: 'art', said: 'ヤッホー、かわいい猫が宇宙を飛んでる絵を作って欲しいんだけど' });
    expect(ja(art.tags)).toEqual(expect.arrayContaining(['猫', '宇宙', '空を飛ぶ', 'ゆめみたいな光']));
    expect(ja(art.tags)).not.toContain('絵');
    expect(ja(art.tags)).not.toContain('ヤッホー');
    // the touch / colour / composition were not given: the picture's defaults fill them
    expect(of(art.tags, 'style')).toHaveLength(1);
    const book = await s.spell({ kind: 'novel', said: 'メガネの少年が魔法学校で謎を解く話' });
    expect(of(book.tags, 'hero')).toEqual(['メガネの少年']);
    expect(of(book.tags, 'genre')).toEqual(['ミステリー']);
    expect(book.tags.length).toBeLessThanOrEqual(8);
  });

  /** an eval-like table: tricky requests, a (mocked) model answer each, and what must hold */
  const TABLE: { said: string; answer: [string, string, string][]; genre: string; never?: string[]; voice?: string }[] = [
    { said: 'サイトラで踊りたい', answer: [['サイケデリックトランス', 'psytrance', 'genre'], ['トリッピー', 'trippy', 'mood']], genre: 'サイケデリックトランス', never: NOT_PSYTRANCE },
    { said: 'ゴアっぽいやつ', answer: [['ゴアトランス', 'goa trance', 'genre']], genre: 'ゴアトランス', never: ['ピアノ', 'やさしい歌声'] },
    { said: '勉強しながら聴けるローファイ', answer: [['ローファイヒップホップ', 'lo-fi hip hop', 'genre'], ['チル', 'chill', 'mood']], genre: 'ローファイヒップホップ', never: ['アップテンポ', '力強い歌声'] },
    { said: '深夜のディープハウス', answer: [['ディープハウス', 'deep house', 'genre'], ['夜', 'night', 'theme']], genre: 'ディープハウス', never: ['やさしい歌声', 'ギター'] },
    { said: 'ドラムンベースのかっこいい曲', answer: [['ドラムンベース', 'drum and bass', 'genre'], ['かっこいい', 'cool', 'mood']], genre: 'ドラムンベース', never: ['ドラム', 'ピアノ'] },
    { said: '泣けるバラード', answer: [['バラード', 'ballad', 'genre'], ['切ない', 'bittersweet', 'mood'], ['ピアノ', 'piano', 'instrument']], genre: 'バラード', never: ['四つ打ち', 'アップテンポ'] },
    { said: 'メタルで激しく', answer: [['メタル', 'heavy metal', 'genre'], ['ピアノ', 'piano', 'instrument'], ['やさしい歌声', 'soft vocals', 'voice']], genre: 'メタル', never: ['やさしい歌声', 'ピアノ'] },
    { said: 'K-POPみたいなダンス曲', answer: [['K-POP', 'k-pop', 'genre']], genre: 'K-POP' },
    { said: '80年代のシンセウェーブ', answer: [['シンセウェイブ', 'synthwave', 'genre']], genre: 'シンセウェイブ', never: ['ピアノ', 'やさしい歌声'] },
    { said: 'アンビエントで眠れる曲', answer: [['アンビエント', 'ambient', 'genre'], ['静か', 'calm', 'mood']], genre: 'アンビエント', never: ['ドラム', '四つ打ち', 'アップテンポ'], voice: '歌なし' },
    { said: 'ファミコンみたいなピコピコ', answer: [['チップチューン', 'chiptune', 'genre']], genre: 'チップチューン', never: ['ピアノ', 'やさしい歌声'] },
    { said: 'ハードスタイルでアゲアゲ', answer: [['ハードスタイル', 'hardstyle', 'genre'], ['高揚感', 'euphoric', 'mood']], genre: 'ハードスタイル', never: ['ピアノ', 'やさしい歌声', 'ふつうの速さ'] },
    { said: 'ゴスペルっぽい感動する歌', answer: [['ゴスペル', 'gospel', 'genre']], genre: 'ゴスペル', voice: 'ゴスペル合唱' },
    { said: 'ボサノバで海辺の午後', answer: [['ボサノバ', 'bossa nova', 'genre'], ['海辺', 'the seaside', 'theme']], genre: 'ボサノバ', never: ['エレキギター', '四つ打ち'] },
    { said: '演歌で港の別れ', answer: [['演歌', 'enka', 'genre'], ['港', 'a harbor', 'theme']], genre: '演歌', voice: 'こぶし' },
  ];
  it.each(TABLE)('$said → $genre, coherent', async ({ said, answer, genre, never, voice }) => {
    const m = model({ [said]: { tags: answer.map(([a, b, c]) => t(a, b, c)) } });
    const v = await new SpellService(m.llm as never).spell({ kind: 'song', said });
    expect(of(v.tags, 'genre')).toEqual([genre]);
    for (const g of ['tempo', 'voice']) expect(of(v.tags, g), g).toHaveLength(1);
    expect(of(v.tags, 'instrument').length).toBeGreaterThan(0);
    for (const x of never ?? []) expect(ja(v.tags), x).not.toContain(x);
    if (voice) expect(of(v.tags, 'voice')).toEqual([voice]);
    expect(songGenreOf(v.tags.find((x) => x.group === 'genre'))?.ja).toBe(genre);
    expect(v.tags.every((x) => !/[^\x20-\x7e]/.test(x.en) || x.en === x.ja)).toBe(true);
  });
});
