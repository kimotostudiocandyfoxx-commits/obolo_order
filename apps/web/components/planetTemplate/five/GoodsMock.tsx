'use client';

import type { GoodsKind } from '@obolo/shared';
import type { CSSProperties } from 'react';
import g from './GoodsMock.module.css';

/**
 * Story session 2026-11-25 (グッズ): a goods item drawn in code — the member's art composited onto its kind's mock-up
 * (no picture model, nothing painted): トート (the Uranus viewer's tote), Tシャツ (the art on the chest), ステッカー (a
 * die-cut sticker with a white edge, a corner lifting), アクスタ (a clear acrylic stand on its base), マグカップ (the art
 * wrapped on the mug, its handle) and 缶バッジ (a round badge with a shine). `width` is the mock-up's width in px (its
 * parts scale with it); `sway`: it swings a little (the Uranus viewer).
 */
export function GoodsMock({ kind, art, width = 240, sway = false, className = '' }: { kind: GoodsKind; art?: string | null; width?: number; sway?: boolean; className?: string }) {
  const pic = art ? ({ backgroundImage: `url(${art})` } as CSSProperties) : undefined;
  const style = { ['--w' as string]: `${width}px` } as CSSProperties;
  const cls = `${g.m} ${sway ? g.sway : ''} ${className}`;
  switch (kind) {
    case 'Tシャツ':
      return (
        <div className={`${cls} ${g.tee}`} style={style} data-testid="goods-mock" data-kind={kind}>
          <svg viewBox="0 0 100 100" aria-hidden>
            <path d="M31 8 L42 4 Q50 12 58 4 L69 8 L95 25 L83 41 L74 35 L74 97 L26 97 L26 35 L17 41 L5 25 Z" fill="#fbfbf8" stroke="#d9d6cc" strokeWidth="1.2" />
            <path d="M42 4 Q50 14 58 4" fill="none" stroke="#d9d6cc" strokeWidth="1.2" />
          </svg>
          <i style={pic} />
        </div>
      );
    case 'ステッカー':
      return (
        <div className={`${cls} ${g.sticker}`} style={style} data-testid="goods-mock" data-kind={kind}>
          <i style={pic} />
          <b aria-hidden />
        </div>
      );
    case 'アクスタ':
      return (
        <div className={`${cls} ${g.acry}`} style={style} data-testid="goods-mock" data-kind={kind}>
          <div className={g.panel}>
            <i style={pic} />
          </div>
          <div className={g.base} aria-hidden />
        </div>
      );
    case 'マグカップ':
      return (
        <div className={`${cls} ${g.mug}`} style={style} data-testid="goods-mock" data-kind={kind}>
          <span className={g.handle} aria-hidden />
          <div className={g.cup}>
            <i style={pic} />
          </div>
        </div>
      );
    case '缶バッジ':
      return (
        <div className={`${cls} ${g.badge}`} style={style} data-testid="goods-mock" data-kind={kind}>
          <i style={pic} />
          <b aria-hidden />
        </div>
      );
    default:
      return (
        <div className={`${cls} ${g.tote}`} style={style} data-testid="goods-mock" data-kind="トート">
          <i style={pic} />
        </div>
      );
  }
}
