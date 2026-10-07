'use client';

import { useCallback, useEffect, useState } from 'react';
import { getBlob, putBlob } from '@/lib/api/idb';
import { useLocalState } from '@/lib/useLocalState';
import type { BranchId } from './residents';

/**
 * The visitor's own Jupiter (docs/jupiter.md), kept on this device for the demo (P-JUP-2):
 *  - roots: private data folder — every photo they add lands here first (videos live on Mars)
 *  - posts: round posts made from a root item; a post flies as a butterfly for 88 hours,
 *    then hangs on its branch as a leaf
 * Media files live in IndexedDB; this record only keeps their ids.
 */
export type MediaKind = 'photo' | 'video';

export interface RootItem {
  id: string;
  kind: MediaKind;
  /** IndexedDB blob id (own files) */
  blobId?: string;
  /** built-in sample (emoji "photo") so the tutorial works without the camera */
  sample?: { emoji: string; hue: number };
  addedAt: number;
}

export type FilterId = 'none' | 'warm' | 'sepia' | 'mono' | 'soft';
export const FILTERS: { id: FilterId; label: string; css: string }[] = [
  { id: 'none', label: 'そのまま', css: 'none' },
  { id: 'warm', label: 'あたたか', css: 'saturate(1.25) sepia(0.18) brightness(1.04)' },
  { id: 'sepia', label: 'セピア', css: 'sepia(0.75) contrast(1.05)' },
  { id: 'mono', label: 'モノクロ', css: 'grayscale(1) contrast(1.1)' },
  { id: 'soft', label: 'ふんわり', css: 'brightness(1.12) saturate(0.8) contrast(0.9)' },
];

export interface OwnPost {
  id: string;
  item: RootItem;
  text: string;
  filter: FilterId;
  branch: BranchId;
  createdAt: number;
}

interface JupiterState {
  roots: RootItem[];
  posts: OwnPost[];
}

/** Videos are limited to 8 seconds (client, 2026-10-05). Longer files play their first 8 s. */
export const VIDEO_MAX_SECONDS = 8;
export const HOUR = 3600_000;

const SAMPLE_ROOTS: RootItem[] = [
  { id: 'r-s1', kind: 'photo', sample: { emoji: '🍙', hue: 95 }, addedAt: 0 },
  { id: 'r-s2', kind: 'photo', sample: { emoji: '🌅', hue: 22 }, addedAt: 0 },
  { id: 'r-s3', kind: 'photo', sample: { emoji: '🐈', hue: 300 }, addedAt: 0 },
  { id: 'r-s4', kind: 'photo', sample: { emoji: '🍰', hue: 340 }, addedAt: 0 },
];

export function useJupiter() {
  const [state, setState] = useLocalState<JupiterState>('obolo.jupiter.v1', { roots: SAMPLE_ROOTS, posts: [] });

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const added: RootItem[] = [];
      for (const f of Array.from(files)) {
        // photos only: videos are kept in Mars's 裏スタジオ (client decision 2026-10-07)
        const kind: MediaKind | null = f.type.startsWith('image/') ? 'photo' : null;
        if (!kind) continue;
        const id = `r-${crypto.randomUUID()}`;
        await putBlob(id, f);
        added.push({ id, kind, blobId: id, addedAt: Date.now() });
      }
      if (added.length) setState((s) => ({ ...s, roots: [...added, ...s.roots] }));
      return added;
    },
    [setState],
  );

  const post = useCallback(
    (p: Omit<OwnPost, 'id' | 'createdAt'>) => {
      const created: OwnPost = { ...p, id: `p-${crypto.randomUUID()}`, createdAt: Date.now() };
      setState((s) => ({ ...s, posts: [created, ...s.posts] }));
      return created;
    },
    [setState],
  );

  return { roots: state.roots, posts: state.posts, addFiles, post };
}

export const isFlying = (createdAt: number, now = Date.now()) => now - createdAt < 88 * HOUR;
export const hoursSince = (createdAt: number, now = Date.now()) => Math.max(0, Math.floor((now - createdAt) / HOUR));

/** Object URL for a stored file (revoked on unmount). */
export function useBlobUrl(blobId?: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blobId) return;
    let u: string | null = null;
    let live = true;
    getBlob(blobId).then((b) => {
      if (b && live) {
        u = URL.createObjectURL(b);
        setUrl(u);
      }
    });
    return () => {
      live = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [blobId]);
  return url;
}
