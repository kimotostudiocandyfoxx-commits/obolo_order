'use client';

import { useCallback } from 'react';
import { useLocalState } from '@/lib/useLocalState';
import type { Item } from './shop';

/**
 * The visitor's side of Venus, kept on this device for the demo (P-VENUS-2).
 *  - stars: the wallet (★). Stars come from the other planets; the demo starts with 88.
 *  - collection: goods bought from others
 *  - shop: goods the visitor made and put up for sale (sold count, earnings)
 */
interface VenusState {
  stars: number;
  collection: Item[];
  shop: Item[];
}

export function useVenus() {
  const [st, setSt] = useLocalState<VenusState>('obolo.venus.v1', { stars: 88, collection: [], shop: [] });

  const buy = useCallback(
    (item: Item) => {
      let ok = false;
      setSt((s) => {
        if (s.stars < item.price || s.collection.some((c) => c.id === item.id)) return s;
        ok = true;
        return { ...s, stars: s.stars - item.price, collection: [item, ...s.collection] };
      });
      return ok;
    },
    [setSt],
  );

  const list = useCallback((item: Item) => setSt((s) => ({ ...s, shop: [item, ...s.shop] })), [setSt]);

  /** Someone bought one of the visitor's goods: +price stars. */
  const sold = useCallback(
    (id: string) =>
      setSt((s) => {
        const item = s.shop.find((x) => x.id === id);
        if (!item) return s;
        return { ...s, stars: s.stars + item.price, shop: s.shop.map((x) => (x.id === id ? { ...x, sold: x.sold + 1 } : x)) };
      }),
    [setSt],
  );

  return { ...st, buy, list, sold };
}
