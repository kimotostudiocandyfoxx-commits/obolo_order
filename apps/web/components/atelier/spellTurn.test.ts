import { describe, expect, it } from 'vitest';
import { spellPendingTurn } from './intent';

/**
 * R13 fix (client 2026-11-25): while a song's spell (talismans + lyric sheet) waited for its yes, 「曲を作るのをやめて画像を
 * 作りたい」 was taken as a change of the song's spell. A cancel drops the spell; another kind drops it and starts that kind.
 */
describe('R13 fix: words while a spell waits — cancel, another kind, or a change', () => {
  it("the client's exact sentence switches to a picture", () => {
    expect(spellPendingTurn('曲を作るのをやめて画像を作りたい', 'song')).toEqual({ switchTo: 'art', content: '画像' });
  });

  it('cancel words drop the spell', () => {
    for (const s of ['やめて', 'やっぱりやめる', '曲を作るのはやめて', 'キャンセル', 'キャンセルで', 'なしで', 'やっぱりいらない', 'もういい', 'この曲はいらない', 'スペルはやめておく', 'やめとく', '作るのやめる'])
      expect(spellPendingTurn(s, 'song'), s).toEqual({ cancel: true });
    expect(spellPendingTurn('この絵はやめて', 'art')).toEqual({ cancel: true });
  });

  it('another kind drops the spell and starts that kind (its words carried over)', () => {
    const cases: [string, string, string][] = [
      ['やっぱり画像', 'art', '画像'],
      ['画像にして', 'art', '画像'],
      ['やっぱり絵にしたい', 'art', '絵'],
      ['イラストがいい', 'art', 'イラスト'],
      ['やめて、夏の海の絵を描いて', 'art', '夏の海の絵'],
      ['曲はやめて動画を作りたい', 'video', '動画'],
      ['MVにして', 'video', 'MV'],
      ['やっぱり小説を書いてほしい', 'novel', ''],
      ['ゲームを作りたい', 'game', 'ゲーム'],
      ['曲はやめてゲームにしたい', 'game', 'ゲーム'],
      ['コロリンにしたい', 'voice', 'コロリン'],
      ['ラジオにして', 'radio', 'ラジオ'],
    ];
    for (const [s, k, content] of cases) {
      const r = spellPendingTurn(s, 'song');
      expect(r && 'switchTo' in r ? r.switchTo : r, s).toBe(k);
      if (content && r && 'switchTo' in r) expect(r.content, s).toContain(content);
    }
    const back = spellPendingTurn('やっぱり曲にして', 'art');
    expect(back && 'switchTo' in back ? back.switchTo : back).toBe('song');
  });

  it('a change of the spell stays a change (a talisman called off, a kind word as a touch)', () => {
    for (const s of ['ピアノはやめて', 'ピアノなしで', 'ささやきはいらない', 'プロンプトをピアノ系からEDM系にしてほしい', 'サビをもっと明るく', '話のままでのところを靴のままでにしてほしい', 'アニメの主題歌みたいに', '絵本みたいな雰囲気で', 'ゲーム音楽っぽく', 'もっと明るく', 'EDMにして'])
      expect(spellPendingTurn(s, 'song'), s).toBeNull();
    expect(spellPendingTurn('曲に合う絵にして', 'art')).toBeNull();
    expect(spellPendingTurn('写真みたいにリアルに', 'art')).toBeNull();
  });
});
