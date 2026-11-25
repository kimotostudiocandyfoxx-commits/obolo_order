'use client';

import { sceneTimes } from '@obolo/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { VideoReel } from './video';

/**
 * R13 (docs/動画の作り方.md): the review page's video — the same pictures-that-move edit the server renders with ffmpeg,
 * played in the card: each picture in its order and share of the time, the camera over it (Ken Burns zoom / pan; 2.5D
 * parallax: the far picture and a near cut-out move by different amounts), a soft fade / white flash where a new picture
 * starts, the lyric lines, the colour grade. A live video is the rendered mp4 (WorkCard plays it).
 */
const PACE = { slow: 0.5, normal: 1, fast: 1.5 } as const;
const GRADE: Record<VideoReel['params']['grade'], string> = {
  none: 'none',
  bright: 'brightness(1.08) saturate(1.1)',
  dark: 'brightness(0.86) contrast(1.05)',
  vivid: 'saturate(1.45) contrast(1.06)',
  soft: 'saturate(0.8) brightness(1.03)',
  mono: 'grayscale(1)',
};

export function ReelPlayer({ reel, title }: { reel: VideoReel; title?: string }) {
  const times = useMemo(() => sceneTimes(reel, reel.seconds), [reel]);
  const total = reel.seconds;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const base = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const t0 = performance.now() - base.current * 1000;
    const tick = (now: number) => {
      const x = ((now - t0) / 1000) % total;
      base.current = x;
      setT(x);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  // the picture shown now and how far into it
  let at = 0;
  let j = 0;
  for (; j < times.length - 1 && t >= at + times[j].dur; j++) at += times[j].dur;
  const cur = times[j];
  if (!cur) return null;
  const scene = reel.scenes[cur.k];
  const local = t - at;
  const u = Math.min(1, Math.max(0, local / cur.dur));
  const p = reel.params;
  const k = PACE[p.pace];
  const ease = 0.5 - Math.cos(u * Math.PI) / 2;
  // the camera: the far picture and (2.5D) the near cut-out, moving by different amounts
  let far = '';
  let near = '';
  switch (p.camera) {
    case 'zoom':
      far = `scale(${1 + 0.18 * k * (j % 2 ? 1 - ease : ease)})`;
      break;
    case 'pan':
      far = `scale(${1 + 0.18 * k}) translateX(${(j % 2 ? 1 : -1) * (ease - 0.5) * 14 * k}%)`;
      break;
    case 'still':
      far = 'none';
      break;
    case 'fly':
      far = `scale(${1.12 + 0.04 * k * ease}) translateY(${(0.5 - ease) * 6 * k}%)`;
      near = `translateY(${(0.5 - ease) * 26 * k}%) scale(${1 + 0.08 * k * ease})`;
      break;
    default:
      far = `scale(${1.1 + 0.03 * k * ease}) translateX(${(j % 2 ? 1 : -1) * (ease - 0.5) * 5 * k}%)`;
      near = `translateX(${(j % 2 ? 1 : -1) * (ease - 0.5) * 22 * k}%) scale(${1 + 0.06 * k * ease})`;
  }
  const depth = p.camera === 'parallax' || p.camera === 'fly';
  // how a new picture comes in (and the soft fade out before one)
  const last = j === times.length - 1;
  const dark = p.transition === 'fade' ? Math.max(local < 0.35 && j > 0 ? 1 - local / 0.35 : 0, !last && cur.dur - local < 0.3 ? 1 - (cur.dur - local) / 0.3 : 0) : 0;
  const white = p.transition === 'flash' && j > 0 && local < 0.3 ? 1 - local / 0.3 : 0;
  // the lyric line being sung
  const lines = reel.lines ?? [];
  const li = p.captions ? lines.findIndex((l, i) => t >= l.t && t < (lines[i + 1]?.t ?? total)) : -1;
  const line = li >= 0 ? lines[li] : null;
  const big = p.captionStyle === 'big' || (p.captionStyle === 'auto' && li === lines.length - 2);

  return (
    <div className="relative mt-1 w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '1 / 1' }} data-testid="reel-player" onClick={() => setPlaying((x) => !x)}>
      <div className="absolute inset-0" style={{ filter: GRADE[p.grade] }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={scene.url} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ transform: far, transformOrigin: '50% 45%' }} />
        {depth && scene.near && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={scene.near} alt="" className="absolute bottom-[8%] left-[29%] w-[42%] object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,.45)]" style={{ transform: near }} />
        )}
      </div>
      {dark > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: dark }} />}
      {white > 0 && <div className="absolute inset-0 bg-white" style={{ opacity: white }} />}
      {line && (
        <p
          key={li}
          className={`absolute inset-x-3 text-center font-bold text-white ${big ? 'bottom-[22%] text-[22px]' : 'bottom-[9%] text-[16px]'}`}
          style={{ textShadow: '0 0 10px rgba(255,120,200,.75), 0 2px 3px rgba(40,10,60,.9)', animation: 'reel-line .5s ease-out both' }}
        >
          {line.text}
        </p>
      )}
      <div className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white/90">{title ? `${title}・` : ''}動く絵</div>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
        <div className="h-full bg-amber-200/80" style={{ width: `${(t / total) * 100}%` }} />
      </div>
      {!playing && <div className="absolute inset-0 flex items-center justify-center text-4xl text-white/85">▶</div>}
      <style>{'@keyframes reel-line{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}'}</style>
    </div>
  );
}
