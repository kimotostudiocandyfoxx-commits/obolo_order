import type { AtelierItem, AtelierKind } from '@obolo/shared';

/**
 * Uranus atelier (client 2026-10-15): the decorations, wallpapers and floors. Decorations are painted
 * pictures (design/atelier-art-queue.json → public/atelier/<id>.webp); until a picture is there the emoji
 * stands in.
 */
export interface Deco {
  id: string;
  label: string;
  emoji: string;
  /** width as a fraction of the room */
  size: number;
  /** where it lands when added: on the wall or on the floor */
  on: 'wall' | 'floor';
  /** lies flat: goes behind everything when added */
  back?: boolean;
}

export const DECOS: Deco[] = [
  { id: 'window', label: '星の窓', emoji: '🪟', size: 0.34, on: 'wall' },
  { id: 'garland', label: '星のガーランド', emoji: '✨', size: 0.5, on: 'wall' },
  { id: 'clock', label: '月の時計', emoji: '🕰️', size: 0.18, on: 'wall' },
  { id: 'shelf', label: 'かべの棚', emoji: '🪵', size: 0.3, on: 'wall' },
  { id: 'bookshelf', label: '本棚', emoji: '📚', size: 0.3, on: 'floor' },
  { id: 'sofa', label: 'ソファ', emoji: '🛋️', size: 0.42, on: 'floor' },
  { id: 'rug', label: '星のラグ', emoji: '⭐', size: 0.5, on: 'floor', back: true },
  { id: 'easel', label: 'イーゼル', emoji: '🎨', size: 0.28, on: 'floor' },
  { id: 'lamp', label: 'ランプ', emoji: '💡', size: 0.2, on: 'floor' },
  { id: 'plant', label: 'うえき', emoji: '🪴', size: 0.18, on: 'floor' },
  { id: 'table', label: 'まるテーブル', emoji: '☕', size: 0.22, on: 'floor' },
  { id: 'rocket', label: 'ロケットの模型', emoji: '🚀', size: 0.18, on: 'floor' },
  { id: 'crystal', label: 'マナの結晶', emoji: '💎', size: 0.16, on: 'floor' },
  { id: 'cat', label: 'ねむりねこ', emoji: '🐈', size: 0.2, on: 'floor' },
];
export const decoById = (id: string) => DECOS.find((d) => d.id === id);

export interface Surface {
  id: string;
  label: string;
  css: string;
}

export const WALLS: Surface[] = [
  { id: 'cream', label: 'クリーム', css: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.6) 0 2px, transparent 3px) 0 0/28px 28px, linear-gradient(#fff6e6, #f6e3c4)' },
  { id: 'pink', label: 'さくら', css: 'radial-gradient(circle, rgba(255,255,255,0.7) 0 3px, transparent 4px) 0 0/32px 32px, linear-gradient(#ffe4ec, #f9c9d8)' },
  { id: 'sky', label: 'そら', css: 'linear-gradient(90deg, rgba(255,255,255,0.35) 0 12px, transparent 12px) 0 0/48px 48px, linear-gradient(#e2f3ff, #b9dcf7)' },
  { id: 'mint', label: 'ミント', css: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.4) 0 2px, transparent 2px 22px), linear-gradient(#e6fbf1, #c3ecd9)' },
  { id: 'lavender', label: 'ラベンダー', css: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.5) 0 2px, transparent 3px) 0 0/22px 22px, linear-gradient(#efe8ff, #d6c8fb)' },
  { id: 'night', label: 'よぞら', css: 'radial-gradient(circle, rgba(255,240,180,0.9) 0 1.5px, transparent 2.5px) 0 0/37px 41px, radial-gradient(circle, rgba(255,255,255,0.6) 0 1px, transparent 2px) 13px 19px/29px 31px, linear-gradient(#1c1f4a, #2c2466)' },
];

export const FLOORS: Surface[] = [
  { id: 'wood', label: 'フローリング', css: 'repeating-linear-gradient(90deg, rgba(90,50,20,0.18) 0 2px, transparent 2px 64px), linear-gradient(#d9a46c, #b77c45)' },
  { id: 'tile', label: 'タイル', css: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0 2px, transparent 2px 40px), repeating-linear-gradient(90deg, rgba(0,0,0,0.08) 0 2px, transparent 2px 40px), linear-gradient(#f4f1ea, #ddd7ca)' },
  { id: 'carpet', label: 'じゅうたん', css: 'radial-gradient(circle, rgba(255,255,255,0.18) 0 2px, transparent 3px) 0 0/14px 14px, linear-gradient(#c96f7d, #a8505f)' },
  { id: 'grass', label: 'しばふ', css: 'radial-gradient(circle, rgba(255,255,255,0.15) 0 1.5px, transparent 2.5px) 0 0/12px 12px, linear-gradient(#9bd17a, #6fae52)' },
  { id: 'cloud', label: 'くも', css: 'radial-gradient(ellipse at 30% 40%, #fff 0 18px, transparent 19px) 0 0/90px 60px, linear-gradient(#f4f8ff, #dde8fb)' },
];
export const wallCss = (id: string) => (WALLS.find((w) => w.id === id) ?? WALLS[0]).css;
export const floorCss = (id: string) => (FLOORS.find((f) => f.id === id) ?? FLOORS[0]).css;

/** Default width of a piece of each kind. */
export const KIND_SIZE: Record<AtelierKind, number> = { deco: 0.24, sticker: 0.22, song: 0.26, mv: 0.38, kororin: 0.28, look: 0.24, bati: 0.2 };

/** Something of yours that can be put up (what you made on the journey). */
export type Piece = Pick<AtelierItem, 'kind' | 'ref' | 'url' | 'poster' | 'text'> & { key: string; label: string };

export const newItemId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
