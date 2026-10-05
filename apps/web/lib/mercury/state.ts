'use client';

import { useCallback } from 'react';
import { useLocalState } from '@/lib/useLocalState';
import { P, type Song } from './sea';

/**
 * The visitor's own island on Mercury, kept on this device for the demo (P-MER-2).
 *  - soil: demo songs (not released) buried in the island
 *  - released: songs that set sail; a ship for 88 hours, then a record on the island
 *  - stars: the stars the visitor gave (1–3) — they fill the three treasure chests
 * The sample demos use the client's record art until the 作曲 screen exists.
 */
interface Released {
  song: Song;
  at: number;
}
interface MercuryState {
  soil: Song[];
  released: Released[];
  stars: Record<string, 1 | 2 | 3>;
}

const DEMOS: Song[] = [
  { id: 'd-ramen', title: 'ラーメン・フリースタイル', artist: 'you', cover: 'cover-ramen', seconds: 201, preset: P(92, 57, 'minor', [0, 5, 3, 4], 'square') },
  { id: 'd-chikoku', title: '遅刻ダッシュ8:29', artist: 'you', cover: 'cover-chikoku', seconds: 189, preset: P(152, 52, 'minor', [0, 6, 5, 6], 'sawtooth') },
  { id: 'd-hokahoka', title: 'ほかほか日だまり', artist: 'you', cover: 'cover-hokahoka', seconds: 225, preset: P(96, 67, 'major', [0, 3, 4, 3], 'triangle') },
];

const HOUR = 3600_000;
export const atSea = (at: number, now = Date.now()) => now - at < 88 * HOUR;
export const hoursSince = (at: number, now = Date.now()) => Math.max(0, Math.floor((now - at) / HOUR));

export function useMercury() {
  const [st, setSt] = useLocalState<MercuryState>('obolo.mercury.v1', { soil: DEMOS, released: [], stars: {} });

  const release = useCallback(
    (id: string) =>
      setSt((s) => {
        const song = s.soil.find((x) => x.id === id);
        if (!song) return s;
        return { ...s, soil: s.soil.filter((x) => x.id !== id), released: [{ song, at: Date.now() }, ...s.released] };
      }),
    [setSt],
  );

  const star = useCallback(
    (id: string, tier: 0 | 1 | 2 | 3) =>
      setSt((s) => {
        const stars = { ...s.stars };
        if (tier === 0) delete stars[id];
        else stars[id] = tier;
        return { ...s, stars };
      }),
    [setSt],
  );

  const chests = [1, 2, 3].map((t) => Object.values(st.stars).filter((v) => v === t).length) as [number, number, number];
  return { soil: st.soil, released: st.released, stars: st.stars, chests, release, star };
}
