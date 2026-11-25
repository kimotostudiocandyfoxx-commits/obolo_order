import { describe, expect, it } from 'vitest';
import { BATI_VARIANTS } from './batiVariants';
import { coverTalk, GAME_COVER_LINES, GOODS_KINDS, GOODS_LINES, GoodsMakeBody, goodsKindOf, goodsTitle, pickArt } from './goods';
import { atelierMakeCost } from './makeConfirm';

describe('グッズ (story 2026-11-25): a kind and one of your arts, made in words', () => {
  const arts = [
    { id: 'a3', title: '夕焼けの猫', url: 'u3' },
    { id: 'a2', title: '星の森', url: 'u2' },
    { id: 'a1', title: null, url: 'u1' },
  ];
  it('the kind from the words', () => {
    expect(goodsKindOf('トートにして')).toBe('トート');
    expect(goodsKindOf('マグで')).toBe('マグカップ');
    expect(goodsKindOf('シールがいい')).toBe('ステッカー');
    expect(goodsKindOf('アクリルスタンド！')).toBe('アクスタ');
    expect(goodsKindOf('バッジ')).toBe('缶バッジ');
    expect(goodsKindOf('Tシャツ')).toBe('Tシャツ');
    expect(goodsKindOf('うーん')).toBeNull();
    expect(GOODS_KINDS).toHaveLength(6);
  });
  it('the art by its title, by order, or the newest / the oldest; unknown words → null', () => {
    expect(pickArt(arts, '星の森で')?.id).toBe('a2');
    expect(pickArt(arts, '夕焼け')?.id).toBe('a3');
    expect(pickArt(arts, 'いちばん新しいの')?.id).toBe('a3');
    expect(pickArt(arts, 'おまかせ')?.id).toBe('a3');
    expect(pickArt(arts, '2番目の')?.id).toBe('a2');
    expect(pickArt(arts, 'みっつめ')?.id).toBe('a1');
    expect(pickArt(arts, 'いちばん古いの')?.id).toBe('a1');
    expect(pickArt(arts, 'ドラゴン')).toBeNull();
    expect(pickArt([], 'おまかせ')).toBeNull();
  });
  it('its name: the art’s title + the kind', () => {
    expect(goodsTitle('トート', '夕焼け')).toBe('夕焼けトート');
    expect(goodsTitle('マグカップ', null)).toBe('わたしのマグカップ');
    expect(goodsTitle('缶バッジ', 'あ'.repeat(40)).length).toBeLessThanOrEqual(24);
  });
  it('free: no confirm, no mana (nothing is painted)', () => {
    expect(atelierMakeCost('goods', null)).toBeNull();
    expect(GoodsMakeBody.safeParse({ kind: 'トート', rootId: '00000000-0000-4000-8000-000000000001' }).success).toBe(true);
    expect(GoodsMakeBody.safeParse({ kind: 'うちわ', rootId: '00000000-0000-4000-8000-000000000001' }).success).toBe(false);
  });
  it('a game case: 「描いて」 paints, 「いらない」 keeps the neon face, other words are an art’s name', () => {
    expect(coverTalk('バティが描いて')).toBe('paint');
    expect(coverTalk('いらない')).toBe('none');
    expect(coverTalk('ネオンのままで')).toBe('none');
    expect(coverTalk('星の森')).toBeNull();
  });
  it('{bati}’s lines (PROVISIONAL) are in every style, with the same placeholders', () => {
    for (const line of [...Object.values(GOODS_LINES), ...Object.values(GAME_COVER_LINES)]) {
      const v = BATI_VARIANTS[line];
      expect(v, line).toBeDefined();
      const holes = (t: string) => [...t.matchAll(/\{[a-z]+\}/g)].map((m) => m[0]).filter((h) => h !== '{self}').sort();
      for (const s of Object.values(v)) expect(holes(s), s).toEqual(holes(line));
    }
  });
});
