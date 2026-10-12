'use client';

import { useEffect, useState } from 'react';
import { getApi } from '@/lib/api';
import { songCover } from '@/lib/songCover';
import { DjController, type DjTrack } from './DjController';

/** Venus: DJ with your own saved songs (client decision 2026-10-12, docs/venus.md). */
export function VenusDj({ demo = [], backHref }: { demo?: DjTrack[]; backHref?: string }) {
  const [songs, setSongs] = useState<DjTrack[]>(demo);
  useEffect(() => {
    getApi()
      .savedSongs()
      .then((list) => setSongs([...list.map((s) => ({ title: s.title, url: s.url, bpm: s.bpm || null, videoUrl: s.mvUrl ?? null, coverUrl: songCover(s.id) })), ...demo]))
      .catch(() => undefined);
  }, [demo]);
  return <DjController songs={songs} backHref={backHref} />;
}
