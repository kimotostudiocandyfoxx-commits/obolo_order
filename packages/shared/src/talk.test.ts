import { describe, expect, it } from 'vitest';
import { talkChunks, talkPlain, talkRuns } from './talk';

const LONG =
  'ビッグバンは、だいたい138億年前に起きたと考えられているよ。はじめは、とても小さくて、とても熱いところから、宇宙がいっきにふくらんだんだって。そのあと、だんだん冷えて、星や銀河ができていったんだ。いまも宇宙はふくらみつづけていて、遠くの銀河ほど、速く遠ざかっているんだよ。夜空の星の光は、何年も、何万年も前に出た光なんだ。だから、星を見るのは、むかしの宇宙を見ていることになるんだね。';

describe('M-R244 long utterances in several bubbles', () => {
  it('never changes the words: the bubbles joined are the utterance exactly', () => {
    for (const t of [LONG, `え、!!マジで！？!!　見てみたい！ ${LONG}`, `**ねえ**、聞いて。${LONG}\n${LONG}`, 'みじかい。ことば。']) {
      const c = talkChunks(t);
      expect(c.map((x) => x.text).join('')).toBe(t);
      expect(c.length).toBeLessThanOrEqual(5);
    }
  });
  it('keeps up to about 40 characters whole, and cuts only at a sentence end', () => {
    expect(talkChunks('やったー！　でも、ちょっと不安かも……')).toHaveLength(1);
    const c = talkChunks(LONG);
    expect(c.length).toBeGreaterThan(1);
    for (const x of c.slice(0, -1)) expect(x.text.trim()).toMatch(/[。！？!?]$/);
  });
  it('cuts where the call said (br), and keeps a mark whole', () => {
    const t = '一つめの話だよ。まだ一つめ。ここから!!二つめ!!の話。それで、おしまい。';
    const c = talkChunks(t + 'もう少しだけ、長くしておくね。', [{}, {}, { br: true }, {}, {}]);
    expect(c.map((x) => x.text)).toEqual(['一つめの話だよ。まだ一つめ。', 'ここから!!二つめ!!の話。それで、おしまい。もう少しだけ、長くしておくね。']);
    expect(talkRuns(c[1].text).some((r) => r.c === 'shout' && r.t === '二つめ')).toBe(true);
    expect(c.map((x) => talkPlain(x.text)).join('')).toBe(talkPlain(t + 'もう少しだけ、長くしておくね。'));
  });
});

describe('M-R245 special words', () => {
  it('reads the four special marks, and nothing else as markup', () => {
    expect(talkRuns('うん！　[[金:約束]]だよ')).toEqual([{ t: 'うん！　', c: '' }, { t: '約束', c: 'gold' }, { t: 'だよ', c: '' }]);
    expect(talkRuns('[[かわいい:えへへ]]……[[しんみり:こわい]][[赤:ドン]]').map((r) => r.c)).toEqual(['cute', '', 'eerie', 'red']);
    expect(talkRuns('[[青:ちがう]]<b>x</b>')).toEqual([{ t: '[[青:ちがう]]<b>x</b>', c: '' }]);
    const t = `[[金:おめでとう]]！ ${'とても長いお話をしておくね。'.repeat(8)}`;
    expect(talkChunks(t).map((c) => c.text).join('')).toBe(t);
  });
});
