import { describe, expect, it } from 'vitest';
import type { SpellTag } from '@obolo/shared';
import { floatLayout } from './FloatingSpell';
import { SPELL_LOOKS, spellLookFor } from './spellLooks';

const WORDS = ['夏', '海', 'ポップ', '明るい', 'ふつうの速さ', 'ピアノ', 'ドラム', 'やさしい歌声', 'ストリングス', 'ベル', '手拍子', 'キラキラ'];
const tags = (n: number): SpellTag[] => WORDS.slice(0, n).map((ja, i) => ({ ja, en: `t${i}`, group: 'mood' }));

describe('client 2026-11-25: the spell floating over the bowl', () => {
  it('1–12 talismans of every look stay inside a phone screen, one place each', () => {
    for (const look of SPELL_LOOKS)
      for (let n = 1; n <= 12; n++) {
        const l = floatLayout(look, tags(n), 390);
        expect(l.at.size).toBe(n);
        for (const p of l.at.values()) {
          expect(Math.abs(p.x) + p.w / 2, `${look} ${n}`).toBeLessThanOrEqual(195 - 8);
        }
        expect(l.height).toBeLessThan(look === 'reifu' ? 300 : 230);
      }
  });
  it('the strips (A) go into staggered rows when there are many', () => {
    const l = floatLayout('reifu', tags(12), 390);
    expect(new Set([...l.at.values()].map((p) => p.row)).size).toBeGreaterThanOrEqual(2);
  });
  it('the look follows the kind (one map): picture B, song D, MV C, novel A, game E, others B', () => {
    expect(['art', 'image', 'song', 'video', 'novel', 'book', 'game', 'look', 'bati'].map(spellLookFor)).toEqual(['tenfu', 'tenfu', 'hikari', 'rune', 'reifu', 'reifu', 'jufu', 'tenfu', 'tenfu']);
  });
});
