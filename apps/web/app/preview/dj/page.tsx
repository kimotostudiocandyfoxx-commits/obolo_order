'use client';

import { useEffect, useState } from 'react';
import { DjController, type DjTrack } from '@/components/dj/DjController';
import { getApi } from '@/lib/api';

/** /preview/dj — the Venus DJ engine on a plain screen (client request 2026-10-12): your saved songs, two demo songs, or a file. */
const DEMO: DjTrack[] = [
  { title: 'デモ：釜山 K-POP', url: '/dj-demo/busan-kpop.mp3', bpm: 128 },
  { title: 'デモ：水星ポップ', url: '/dj-demo/mercury-pop.mp3', bpm: 115 },
];

export default function DjPreviewPage() {
  const [songs, setSongs] = useState<DjTrack[]>(DEMO);
  useEffect(() => {
    getApi()
      .savedSongs()
      .then((list) => setSongs([...list.map((s) => ({ title: s.title, url: s.url, bpm: s.bpm || null })), ...DEMO]))
      .catch(() => undefined);
  }, []);
  return <DjController songs={songs} />;
}
