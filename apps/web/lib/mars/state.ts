'use client';

import { useCallback } from 'react';
import { P } from '@/lib/mercury/sea';
import { useLocalState } from '@/lib/useLocalState';
import type { Theme, Video } from './sky';

/**
 * The visitor's own studio on Mars, kept on this device for the demo (P-MARS-2).
 *  - theme: 郊外 (canyon) or 街中 (city), for the 星図 and the studio
 *  - locker: videos not released yet (the 撮影 chat puts new ones here)
 *  - released: a UFO on friends' 星図 for 88 hours, then a work in the studio
 * The sample drafts use the client's studio mock art until real video making exists.
 */
interface Released {
  video: Video;
  at: number;
}
interface MarsState {
  theme: Theme;
  locker: Video[];
  released: Released[];
}

const EPIC = P(76, 60, 'minor', [0, 3, 4, 3], 'triangle');
const DRAFTS: Video[] = [
  { id: 'f-moon', title: '月影の旅人 - The Fox Wanderer', kind: '映画', author: 'you', thumb: 'film-moonwanderer', seconds: 312, scenes: ['赤い砂漠を歩く旅人', '月が昇る', '旅人は振り返らない'], bgm: EPIC },
  { id: 'f-yoake', title: '狐の夜明け', kind: 'MV', author: 'you', thumb: 'film-yoake', seconds: 205, scenes: ['夜の街に月', '狐が歌いだす', '夜が明ける'], bgm: P(104, 62, 'major', [0, 4, 5, 3], 'triangle') },
  { id: 'f-neon', title: 'Neon Fox', kind: 'MV', author: 'you', thumb: 'film-neonfox', seconds: 188, scenes: ['ネオンの路地', '光る狐のマーク', 'ビートに合わせて点滅'], bgm: P(124, 57, 'minor', [0, 5, 3, 4], 'sawtooth') },
];

const HOUR = 3600_000;
export const flying = (at: number, now = Date.now()) => now - at < 88 * HOUR;
export const hoursSince = (at: number, now = Date.now()) => Math.max(0, Math.floor((now - at) / HOUR));

export function useMars() {
  const [st, setSt] = useLocalState<MarsState>('obolo.mars.v1', { theme: 'city', locker: DRAFTS, released: [] });
  const setTheme = useCallback((theme: Theme) => setSt((s) => ({ ...s, theme })), [setSt]);
  const keep = useCallback((video: Video) => setSt((s) => ({ ...s, locker: [video, ...s.locker] })), [setSt]);
  const release = useCallback(
    (id: string) =>
      setSt((s) => {
        const video = s.locker.find((x) => x.id === id);
        if (!video) return s;
        return { ...s, locker: s.locker.filter((x) => x.id !== id), released: [{ video, at: Date.now() }, ...s.released] };
      }),
    [setSt],
  );
  return { ...st, setTheme, keep, release };
}
