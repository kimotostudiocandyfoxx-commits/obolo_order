'use client';

import { VenusDj } from '@/components/dj/VenusDj';
import type { DjTrack } from '@/components/dj/DjController';

/** /kakunin-5798f28713/dj — the Venus DJ (client request 2026-10-12): your saved songs, two demo songs, or a file. */
const DEMO: DjTrack[] = [
  { title: 'デモ：釜山（写真MV）', url: '/dj-demo/busan-photo.mp3', bpm: 128, videoUrl: '/dj-demo/busan-photo.mp4' },
  { title: 'デモ：釜山（物語MV）', url: '/dj-demo/busan-story.mp3', bpm: 128, videoUrl: '/dj-demo/busan-story.mp4' },
  { title: 'デモ：水星ポップ（MVなし）', url: '/dj-demo/mercury-pop.mp3', bpm: 115, coverUrl: '/art/cover-candy.jpg' },
];

export default function DjPreviewPage() {
  return <VenusDj demo={DEMO} backHref="/kakunin-5798f28713" />;
}
