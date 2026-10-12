'use client';

import { VenusDj } from '@/components/dj/VenusDj';
import type { DjTrack } from '@/components/dj/DjController';

/** /preview/dj — the Venus DJ (client request 2026-10-12): your saved songs, two demo songs, or a file. */
const DEMO: DjTrack[] = [
  { title: 'デモ：釜山 K-POP', url: '/dj-demo/busan-kpop.mp3', bpm: 128 },
  { title: 'デモ：水星ポップ', url: '/dj-demo/mercury-pop.mp3', bpm: 115 },
];

export default function DjPreviewPage() {
  return <VenusDj demo={DEMO} backHref="/preview" />;
}
