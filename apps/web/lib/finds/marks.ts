'use client';

import { nextStars, type ItemMarkId, type MarkedKind, type MarkNames } from '@obolo/shared';
import { useSyncExternalStore } from 'react';
import { getApi } from '@/lib/api';

/**
 * M-R236: the member's ★ and marks on this device, loaded once from the server (the demo: its browser state) and
 * changed at once on a tap (the server is told after). Keyed `kind:id`.
 */
export type ItemMark = { stars: number; mark: ItemMarkId | null };
const NONE: ItemMark = { stars: 0, mark: null };

let marks = new Map<string, ItemMark>();
let names: MarkNames = {};
let loaded: Promise<void> | null = null;
let version = 0;
const subs = new Set<() => void>();
const bump = () => {
  version++;
  for (const f of subs) f();
};

export const markKey = (kind: MarkedKind, id: string) => `${kind}:${id}`;

export function loadMarks(force = false): Promise<void> {
  if (loaded && !force) return loaded;
  loaded = getApi()
    .itemMarks()
    .then((v) => {
      marks = new Map(v.marks.map((m) => [markKey(m.kind, m.id), { stars: m.stars, mark: m.mark }]));
      names = v.names ?? {};
      bump();
    })
    .catch(() => {
      loaded = null;
    });
  return loaded;
}

export function markOf(kind: MarkedKind, id: string): ItemMark {
  return marks.get(markKey(kind, id)) ?? NONE;
}
export const markNames = () => names;

/** set one item's ★ / mark (optimistic; on a failure it goes back) */
export async function setMark(kind: MarkedKind, id: string, patch: Partial<ItemMark>) {
  const key = markKey(kind, id);
  const before = marks.get(key) ?? NONE;
  const next = { ...before, ...patch };
  marks = new Map(marks);
  if (!next.stars && !next.mark) marks.delete(key);
  else marks.set(key, next);
  bump();
  try {
    await getApi().setItemMark({ kind, id, stars: next.stars, mark: next.mark });
  } catch {
    marks = new Map(marks);
    marks.set(key, before);
    bump();
  }
}
/** one tap on the ★: ★ → ★★ → ★★★ → none */
export const cycleStar = (kind: MarkedKind, id: string) => setMark(kind, id, { stars: nextStars(markOf(kind, id).stars) });

export async function saveMarkNames(n: MarkNames) {
  names = { ...n };
  bump();
  names = await getApi().setMarkNames(n).catch(() => names);
  bump();
}

/** the marks in use (the strip shows only those) */
export function marksInUse(): ItemMarkId[] {
  const used = new Set<ItemMarkId>();
  for (const m of marks.values()) if (m.mark) used.add(m.mark);
  return (['spade', 'diamond', 'heart', 'club'] as const).filter((k) => used.has(k));
}

const subscribe = (f: () => void) => {
  subs.add(f);
  void loadMarks();
  return () => void subs.delete(f);
};
/** re-renders when any ★ / mark / name changes (returns a version number) */
export function useMarks(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
}
