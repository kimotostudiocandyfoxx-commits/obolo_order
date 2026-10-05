/**
 * Venus — the planet of making things (client decision 2026-10-05, docs/venus.md; replaces spec's
 * reels). Make in-game goods and items, buy and sell them with the stars collected on the other
 * planets. No real money, no real products.
 * SAMPLE DATA (P-VENUS-2): makers reuse the avatars cut out of the Mercury mock; goods are emoji.
 */
export type ItemKind = 'ステッカー' | 'バッジ' | 'ぼうし' | 'おきもの' | 'アクセ';
export const ITEM_KINDS: ItemKind[] = ['ステッカー', 'バッジ', 'ぼうし', 'おきもの', 'アクセ'];

export interface Item {
  id: string;
  name: string;
  kind: ItemKind;
  emoji: string;
  hue: number;
  /** price in stars (★) */
  price: number;
  maker: string;
  avatar?: string;
  sold: number;
  /** put up in the last 88 hours */
  isNew?: boolean;
  friend?: boolean;
  follow?: boolean;
}

export interface Maker {
  handle: string;
  avatar: string;
  friend: boolean;
  follow: boolean;
}

export const MAKERS: Maker[] = [
  { handle: 'wani_queen', avatar: 'av-wani_queen', friend: true, follow: true },
  { handle: 'kaba_boss', avatar: 'av-kaba_boss', friend: true, follow: false },
  { handle: 'gori4545', avatar: 'av-gori4545', friend: true, follow: true },
  { handle: 'samurai806', avatar: 'av-samurai806', friend: false, follow: true },
  { handle: 'kong_dread', avatar: 'av-kong_dread', friend: true, follow: true },
  { handle: 'pen_lady', avatar: 'av-pen_lady', friend: false, follow: true },
  { handle: 'onigiri', avatar: 'av-onigiri', friend: true, follow: false },
  { handle: 'dj_kong', avatar: 'av-dj_kong', friend: false, follow: false },
];

let n = 0;
const it = (name: string, kind: ItemKind, emoji: string, hue: number, price: number, maker: string, sold: number, isNew = false): Item => {
  const m = MAKERS.find((x) => x.handle === maker)!;
  return { id: `i${++n}`, name, kind, emoji, hue, price, maker, avatar: m.avatar, sold, isNew, friend: m.friend, follow: m.follow };
};

export const ITEMS: Item[] = [
  it('女王のティアラ', 'ぼうし', '👑', 45, 20, 'wani_queen', 128, true),
  it('ボスの葉巻バッジ', 'バッジ', '🎖️', 30, 8, 'kaba_boss', 64, true),
  it('KINGスプレー缶', 'おきもの', '🥫', 300, 12, 'gori4545', 210),
  it('侍の刀キーホルダー', 'アクセ', '⚔️', 210, 10, 'samurai806', 88, true),
  it('レインボー・ドレッド', 'ぼうし', '🌈', 290, 15, 'kong_dread', 45),
  it('月夜のゴシックリボン', 'アクセ', '🎀', 270, 9, 'pen_lady', 33, true),
  it('おにぎりステッカー', 'ステッカー', '🍙', 95, 3, 'onigiri', 512, true),
  it('ミラーボールのおきもの', 'おきもの', '🪩', 250, 18, 'dj_kong', 76),
  it('ワニ皮の扇子', 'アクセ', '🪭', 120, 14, 'wani_queen', 20),
  it('バナナステッカー', 'ステッカー', '🍌', 52, 2, 'gori4545', 999),
  it('梅干しバッジ', 'バッジ', '🟥', 350, 4, 'onigiri', 140),
  it('ペンギンのぬいぐるみ', 'おきもの', '🐧', 195, 16, 'pen_lady', 58),
];
