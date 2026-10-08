'use client';

import { useEffect, useRef, useState } from 'react';
import { ArtBackdrop, pickUfo, Vessel } from '@/components/art/Stage';
import { getApi } from '@/lib/api';
import { fmtLen, KIND_COLOR, type Video } from '@/lib/mars/sky';
import { synth } from '@/lib/synth';
import { Frame } from './Frame';

/** One person in the Mars sky: their UFO and the movies it carries. */
export type CrewMember = { key: string; name: string; img?: string | null; emoji: string; videos: Video[]; isMe?: boolean };

/** Sample movies (a thumbnail + scenes) "play" this long before the next UFO comes. */
const SAMPLE_SECONDS = 16;

/**
 * The Mars player (client request 2026-10-07), like Mercury's: each person's UFO comes in with
 * their square movie. Swipe to the next person (the neighbours peek in at the sides); when a movie
 * ends the next UFO comes by itself. Dots = that person's movies. Bottom right: their studio.
 */
export function UfoPlayer({
  crew,
  start,
  startVideo = 0,
  theme,
  onStudio,
}: {
  crew: CrewMember[];
  start: number;
  startVideo?: number;
  theme: string;
  onStudio?: (m: CrewMember) => void;
}) {
  const n = crew.length;
  const wrap = (v: number, m: number) => ((v % m) + m) % m;
  const [u, setU] = useState(() => wrap(start, n));
  const [k, setK] = useState(startVideo);
  const [dir, setDir] = useState(1);
  const [t, setT] = useState(0);
  const member = crew[wrap(u, n)];
  const video = member.videos[wrap(k, member.videos.length)];
  const real = !!video.url;
  const live = video.kind === 'LIVE';
  const [starred, setStarred] = useState<Record<string, boolean>>({});
  const isStarred = starred[video.id] ?? !!video.starred;
  const drag = useRef<{ x: number; dx: number } | null>(null);
  const [dx, setDx] = useState(0);

  const toMember = (d: number) => {
    setDir(d);
    if (n > 1) {
      setU((v) => wrap(v + d, n));
      setK(0);
    } else setK((v) => v + d);
  };
  const next = useRef(() => toMember(1));
  next.current = () => toMember(1);

  // a sample movie: its BGM and storyboard for a little while, then the next UFO
  useEffect(() => {
    setT(0);
    if (real) {
      synth.stop();
      return;
    }
    synth.play(video.bgm);
    const id = setInterval(
      () =>
        setT((v) => {
          if (v + 1 >= SAMPLE_SECONDS) {
            setTimeout(() => next.current(), 0);
            return v;
          }
          return v + 1;
        }),
      1000,
    );
    return () => {
      clearInterval(id);
      synth.stop();
    };
  }, [video, real]);
  const scene = video.scenes[Math.floor(t / 4) % video.scenes.length];
  const peek = (d: number) => crew[wrap(u + d, n)];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <ArtBackdrop name={`mars-sky-${theme}`} focus={50} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/90" />

      <div
        className="relative flex min-h-0 flex-1 touch-pan-y flex-col items-center justify-center px-3 pt-3"
        onPointerDown={(e) => {
          // the movie's own controls (seek bar) keep their drags
          if ((e.target as HTMLElement).tagName === 'VIDEO') return;
          drag.current = { x: e.clientX, dx: 0 };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          drag.current.dx = e.clientX - drag.current.x;
          setDx(drag.current.dx);
        }}
        onPointerUp={() => {
          const d = drag.current?.dx ?? 0;
          drag.current = null;
          setDx(0);
          if (Math.abs(d) > 50) toMember(d < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDx(0);
        }}
      >
        {n > 1 && (
          <>
            <button onClick={() => toMember(-1)} className="absolute bottom-[6%] left-0 w-[26%] -translate-x-[45%] opacity-55 blur-[1px]" aria-label={`${peek(-1).name}のUFO`}>
              <Vessel ride={pickUfo(peek(-1).key)} img={peek(-1).img} emoji={peek(-1).emoji} />
            </button>
            <button onClick={() => toMember(1)} className="absolute bottom-[6%] right-0 w-[26%] translate-x-[45%] opacity-55 blur-[1px]" aria-label={`${peek(1).name}のUFO`}>
              <Vessel ride={pickUfo(peek(1).key)} img={peek(1).img} emoji={peek(1).emoji} />
            </button>
          </>
        )}
        <div
          key={`${member.key}-${u}`}
          className="flex w-full flex-col items-center"
          style={{ transform: `translateX(${dx}px)`, animation: `${dir > 0 ? 'ship-in-right' : 'ship-in-left'} 0.6s cubic-bezier(.2,.8,.2,1) both` }}
        >
          {/* real Mars movies are square (client decision 2026-10-07) */}
          <div className="relative w-[min(78%,calc(100svh-470px))] overflow-hidden rounded-2xl border-2 border-amber-300/60 shadow-[0_0_40px_rgba(255,150,80,0.45)]">
            <Frame key={video.id} video={video} playing className="aspect-square w-full" onEnded={() => next.current()} />
            {!real && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
                <p key={scene} className="animate-[fadeUp_0.6s_ease-out] text-center text-sm font-bold drop-shadow">{scene}</p>
              </div>
            )}
            {live && <span className="absolute left-3 top-3 animate-pulse rounded bg-red-600 px-2 py-0.5 text-xs font-bold">● LIVE</span>}
          </div>
          {/* the light beam from the UFO up to its movie */}
          <div className="h-4 w-[30%] bg-gradient-to-t from-cyan-200/50 to-transparent blur-[2px]" />
          <div className="w-[min(36%,190px)]" style={{ animation: 'ufo 3s ease-in-out infinite' }}>
            <Vessel ride={pickUfo(member.key)} img={member.img} emoji={member.emoji} />
          </div>
        </div>
      </div>

      <div className="relative px-5 pb-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${KIND_COLOR[video.kind]}`}>{video.kind}</span>
          <p className="truncate text-[clamp(18px,4vw,30px)] font-black drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">{video.title}</p>
        </div>
        {member.videos.length > 1 && (
          <div className="mt-1 flex justify-center gap-2">
            {member.videos.map((v, i) => (
              <button key={v.id} onClick={() => setK(i)} className={`h-2 w-2 rounded-full ${i === wrap(k, member.videos.length) ? 'bg-amber-300' : 'bg-white/35'}`} aria-label={v.title} />
            ))}
          </div>
        )}
        {!real && (
          <div className="mx-auto mt-2 flex max-w-md items-center gap-3 text-xs text-white/70">
            <span className="w-10 text-left tabular-nums">{live ? 'LIVE' : fmtLen(t)}</span>
            <div className="relative h-1 flex-1 rounded-full bg-white/20">
              <div className={`absolute inset-y-0 left-0 rounded-full ${live ? 'bg-red-500' : 'bg-gradient-to-r from-orange-400 to-fuchsia-500'}`} style={{ width: `${(t / SAMPLE_SECONDS) * 100}%` }} />
            </div>
            <span className="w-10 text-right tabular-nums">{live ? '' : fmtLen(SAMPLE_SECONDS)}</span>
          </div>
        )}
        <div className="mx-auto mt-3 flex max-w-md items-center justify-center gap-3">
          <button
            onClick={() => onStudio?.(member)}
            disabled={!onStudio}
            className="flex min-w-0 items-center gap-2 rounded-full border border-amber-200/40 bg-black/50 py-1 pl-1 pr-4 text-sm backdrop-blur"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/60 bg-[#1b1f3a]">
              {member.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.img} alt="" className="h-full w-full object-cover" />
              ) : (
                member.emoji
              )}
            </span>
            <span className="truncate">{member.isMe ? 'あなた' : member.name}</span>
          </button>
          {video.postId && (
            <button
              onClick={() => {
                const on = !isStarred;
                setStarred((cur) => ({ ...cur, [video.id]: on }));
                getApi()
                  .starPlanetPost('mars', video.postId!, on)
                  .catch(() => undefined);
              }}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-lg ${isStarred ? 'border-amber-300 text-amber-300 shadow-[0_0_14px_rgba(255,200,80,0.6)]' : 'border-white/35 bg-black/40 text-white/75'}`}
              aria-label="star"
            >
              {isStarred ? '★' : '☆'}
            </button>
          )}
          {onStudio && (
            <button onClick={() => onStudio(member)} className="flex h-11 shrink-0 items-center gap-1 rounded-full border border-amber-300/60 bg-black/50 px-3 text-xs font-bold text-amber-100 backdrop-blur">
              🎬 {member.isMe ? '自分のスタジオへ' : 'この人のスタジオへ'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
