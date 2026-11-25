import { describe, expect, it } from 'vitest';
import type { AtelierKind } from '@/lib/atelier/unlock';
import { historyOf, recentRequest } from './carry';
import { contentOf, detect, isBare } from './intent';
import type { Msg } from './work';

/** R12 (client, production R11 on day 2): what each phrasing asks for */
const MAKE_TABLE: [string, AtelierKind][] = [
  // art / a picture to MAKE (never a search)
  ['ヤッホー画像を作って欲しいんだけど空飛ぶクジラが光々しく舞い降りるような', 'art'],
  ['画像を作って', 'art'],
  ['画像つくって', 'art'],
  ['画像作りたい', 'art'],
  ['画像を作りたい', 'art'],
  ['絵を描いて', 'art'],
  ['絵を作って', 'art'],
  ['アート作って', 'art'],
  ['イラストほしい', 'art'],
  ['イラスト描いて欲しい', 'art'],
  ['え、かいて', 'art'],
  ['えかいて', 'art'],
  ['夜の海の絵を描いて', 'art'],
  ['猫の写真みたいな絵を作って', 'art'],
  ['ネコのがぞうつくって', 'art'],
  ['描いてほしいな、星の王子さま', 'art'],
  ['お絵かきしたい', 'art'],
  ['空飛ぶクジラの絵', 'art'],
  // songs
  ['曲を作って', 'song'],
  ['歌つくって', 'song'],
  ['音楽を作りたい', 'song'],
  ['おんがくつくって', 'song'],
  ['夏の海のうたを作ってほしい', 'song'],
  // videos
  ['動画を作って', 'video'],
  ['MV作りたい', 'video'],
  ['ムービーつくって', 'video'],
  ['この曲のMVを作って', 'video'],
  // books, games, kororin, radio
  ['本を作りたい', 'novel'],
  ['小説を書いて', 'novel'],
  ['物語つくって', 'novel'],
  ['お話をかいて', 'novel'],
  ['ゲーム作って', 'game'],
  ['ゲームつくりたい', 'game'],
  ['コロリンで「今日はいい日」', 'voice'],
  ['ころりん作って', 'voice'],
  ['ラジオ番組を作りたい', 'radio'],
];

/** a picture to SEE: only with a clear search word */
const SEE_TABLE: string[] = ['夜の海の絵を見せて', '絵を見せて', 'パンダの画像ある？', 'パンダの写真を探して', '土星の画像を見たい', 'ブラックホールの画像を調べて', 'クジラの写真みせて'];

describe('R12: art and other making requests are understood (client table)', () => {
  it.each(MAKE_TABLE)('%s → %s', (text, kind) => {
    expect(detect(text, false)).toMatchObject({ kind: 'make', what: kind });
  });
  it.each(SEE_TABLE)('%s → a picture search', (text) => {
    expect(detect(text, false)).toMatchObject({ kind: 'make', what: 'image' });
  });
  it('a request with no kind named is still a making request', () => {
    expect(detect('魔法で作って欲しい', false).kind).toBe('makeAny');
    expect(detect('魔法で作って欲しい', true).kind).toBe('makeAny');
    expect(detect('なにか作って', false).kind).toBe('makeAny');
  });
  it('questions and talk are still what they were', () => {
    expect(detect('絵の描き方を教えて', false)).toMatchObject({ kind: 'make', what: 'lookup' });
    expect(detect('ブラックホールってなに？', false)).toMatchObject({ kind: 'make', what: 'lookup' });
    expect(detect('こんにちは', false)).toEqual({ kind: 'talk', content: 'こんにちは' });
    expect(detect('もっと明るく', true)).toEqual({ kind: 'refine', content: 'もっと明るく' });
  });
  it('what to make is the description, wherever it is in the sentence', () => {
    expect(contentOf('ヤッホー画像を作って欲しいんだけど空飛ぶクジラが光々しく舞い降りるような')).toBe('空飛ぶクジラが光々しく舞い降りるような');
    expect(contentOf('夏の海の曲を作って')).toBe('夏の海の曲');
    expect(isBare(contentOf('画像を作りたい'))).toBe(true);
    expect(isBare(contentOf('イラストほしい'))).toBe(true);
    expect(isBare(contentOf('魔法で作って欲しい'))).toBe(true);
    expect(isBare(contentOf('ヤッホー画像を作って欲しいんだけど空飛ぶクジラが光々しく舞い降りるような'))).toBe(false);
  });
});

const me = (text: string): Msg => ({ id: text, who: 'me', text });
const bati = (text: string): Msg => ({ id: `b-${text}`, who: 'bati', text });

describe('R12: the talk is {bati}’s memory', () => {
  const transcript: Msg[] = [
    bati('やっほー！'),
    me('ヤッホー画像を作って欲しいんだけど空飛ぶクジラが光々しく舞い降りるような'),
    bati('絵は、4日目から作れるようになるよ。'),
    me('魔法で作って欲しい'),
  ];
  it('the making request two turns ago carries over (「魔法で作って欲しい」, 「画像を作りたい」)', () => {
    expect(recentRequest(transcript)).toEqual({ what: 'art', content: '空飛ぶクジラが光々しく舞い降りるような' });
    expect(recentRequest([...transcript, bati('どんな絵にする？'), me('画像を作りたい')])).toEqual({ what: 'art', content: '空飛ぶクジラが光々しく舞い降りるような' });
  });
  it('a card made since ends the request', () => {
    const made: Msg = { id: 'w', who: 'work', work: { id: 'w', kind: 'art', prompt: 'クジラ', status: 'ready' } };
    expect(recentRequest([...transcript.slice(0, 2), made, me('魔法で作って欲しい')])).toBeNull();
  });
  it('the whole talk goes to {bati}: the opening greeting off, its own lines and the cards in it', () => {
    const made: Msg = { id: 'w', who: 'work', work: { id: 'w', kind: 'art', prompt: '空飛ぶクジラ', status: 'ready' } };
    const h = historyOf([...transcript, made]);
    expect(h[0]).toEqual({ role: 'user', text: 'ヤッホー画像を作って欲しいんだけど空飛ぶクジラが光々しく舞い降りるような' });
    expect(h.map((t) => t.role)).toEqual(['user', 'buddy', 'user', 'buddy']);
    expect(h[3].text).toContain('空飛ぶクジラ');
  });
  it('the last 20 turns (40 messages) of a long talk', () => {
    const long: Msg[] = Array.from({ length: 100 }, (_, i) => (i % 2 ? bati(`b${i}`) : me(`m${i}`)));
    const h = historyOf(long);
    expect(h).toHaveLength(40);
    expect(h[h.length - 1].text).toBe('b99');
  });
});
