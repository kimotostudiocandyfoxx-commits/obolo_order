import { describe, expect, it } from 'vitest';
import { spellEdit, spellFrom } from './spell';

const ja = (ts: { ja: string }[]) => ts.map((t) => t.ja);
const NOISE = /魔法|まほう|欲しい|ほしい|作って|つくって|ヤッホー|やっほー|画像|なんだけど|んだけど|けど|お願い|ください|スペル/;

describe('R12 (client): request words never become talismans', () => {
  it('「ヤッホー画像を作って欲しいんだけど空飛ぶクジラが光々しく舞い降りるような」', () => {
    const tags = spellFrom('art', 'ヤッホー画像を作って欲しいんだけど空飛ぶクジラが光々しく舞い降りるような');
    expect(ja(tags)).toEqual(expect.arrayContaining(['空飛ぶクジラ', '神々しい', '舞い降りる', '水彩', 'やわらかい色', '正方形']));
    for (const t of tags) expect(t.ja).not.toMatch(NOISE);
  });
  it('the client\'s follow-ups change nothing (「魔法で作って欲しい」「画像を作りたい」)', () => {
    const tags = spellFrom('art', '空飛ぶクジラが光々しく舞い降りるような');
    for (const said of ['魔法で作って欲しい', '画像を作りたい', 'ヤッホー、作って欲しいんだけど']) {
      const v = spellEdit('art', tags, said);
      expect(v.added).toEqual([]);
      expect(ja(v.tags)).toEqual(ja(tags));
    }
  });
  it('other kinds and phrasings: only content', () => {
    for (const [kind, said] of [
      ['art', 'イラストほしい、夜の海とクジラ'],
      ['art', '魔法で星空の街を描いて欲しいです'],
      ['song', 'やっほー、夏の海の曲を作ってほしいんだけど'],
      ['video', 'ねえバティ、猫が踊る動画をつくってください'],
    ] as const) {
      const tags = spellFrom(kind, said);
      for (const t of tags) expect(t.ja, `${said} → ${ja(tags).join('・')}`).not.toMatch(NOISE);
      expect(tags.some((t) => t.group === 'theme')).toBe(true);
    }
  });
  it('magic as the subject stays (a book of magic)', () => {
    expect(ja(spellFrom('novel', '魔法の森のお話'))).toContain('魔法の森');
  });
});
