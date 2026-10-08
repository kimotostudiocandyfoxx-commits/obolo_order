'use client';

import { useEffect, useRef, useState } from 'react';
import { ArtBackdrop, pickShip, Vessel } from '@/components/art/Stage';
import { pauseAudio, resumeAudio, stopAudio, subscribeAudio, toggleAudio } from '@/lib/audio';
import { fmt, type Song } from '@/lib/mercury/sea';
import { synth } from '@/lib/synth';

/** One person on the sea: their ship and the songs it carries. */
export type Flyer = { key: string; name: string; img?: string | null; emoji: string; songs: Song[]; isMe?: boolean };

/**
 * The Mercury player (client request 2026-10-07): each person's ship comes sailing in with their
 * song. Swipe to the next person's ship (the neighbours peek in at the sides); when a song ends the
 * next ship comes in by itself. Dots = that person's songs. Bottom right: go to their island.
 * Stars are your own rating (★1–3); no counts anywhere.
 */
export function ShipPlayer({
  flyers,
  start,
  startSong = 0,
  stars,
  onStar,
  onSwipe,
  onOwner,
}: {
  flyers: Flyer[];
  start: number;
  startSong?: number;
  stars: Record<string, number>;
  onStar: (id: string, tier: 0 | 1 | 2 | 3) => void;
  onSwipe: () => void;
  onOwner?: (f: Flyer) => void;
}) {
  const n = flyers.length;
  const wrap = (v: number, m: number) => ((v % m) + m) % m;
  const [u, setU] = useState(() => wrap(start, n));
  const [k, setK] = useState(startSong);
  const [dir, setDir] = useState(1);
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);
  const flyer = flyers[wrap(u, n)];
  const song = flyer.songs[wrap(k, flyer.songs.length)];
  const drag = useRef<{ x: number; dx: number } | null>(null);
  const [dx, setDx] = useState(0);

  const toFlyer = (d: number) => {
    setDir(d);
    if (n > 1) {
      setU((v) => wrap(v + d, n));
      setK(0);
    } else setK((v) => v + d);
    setPaused(false);
  };
  const next = useRef(() => toFlyer(1));
  next.current = () => toFlyer(1);

  // play the song; when it ends the next ship comes in
  useEffect(() => {
    setT(0);
    let synthTimer: ReturnType<typeof setInterval> | null = null;
    const byTimer = () => {
      synthTimer = setInterval(
        () =>
          setT((v) => {
            if (v + 1 >= song.seconds) {
              setTimeout(() => next.current(), 0);
              return v;
            }
            return v + 1;
          }),
        1000,
      );
    };
    let off = () => {};
    if (song.audioUrl) {
      const url = song.audioUrl;
      synth.stop();
      off = subscribeAudio((s) => {
        if (s.url !== url) return;
        setT(Math.round(s.progress * song.seconds));
        if (!s.playing && s.progress >= 1) next.current();
      });
      toggleAudio(url).catch(() => byTimer());
    } else {
      synth.play(song.preset);
      byTimer();
    }
    return () => {
      off();
      if (synthTimer) clearInterval(synthTimer);
      if (song.audioUrl) stopAudio();
      else synth.stop();
    };
  }, [song]);

  const pause = () => {
    if (!paused) {
      if (song.audioUrl) pauseAudio();
      else synth.stop();
      setPaused(true);
    } else {
      if (song.audioUrl) {
        if (!resumeAudio(song.audioUrl)) void toggleAudio(song.audioUrl).catch(() => undefined);
      } else synth.play(song.preset);
      setPaused(false);
    }
  };

  const peek = (d: number) => flyers[wrap(u + d, n)];
  const mine = stars[song.id] ?? 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <ArtBackdrop name="mercury-sea" focus={62} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#06123a]/30 via-transparent to-[#040a22]/95" />

      <div
        className="relative flex min-h-0 flex-1 touch-pan-y items-end justify-center pb-2"
        onPointerDown={(e) => (drag.current = { x: e.clientX, dx: 0 })}
        onPointerMove={(e) => {
          if (!drag.current) return;
          drag.current.dx = e.clientX - drag.current.x;
          setDx(drag.current.dx);
        }}
        onPointerUp={() => {
          const d = drag.current?.dx ?? 0;
          drag.current = null;
          setDx(0);
          if (Math.abs(d) > 50) {
            toFlyer(d < 0 ? 1 : -1);
            onSwipe();
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDx(0);
        }}
      >
        {/* the neighbours peek in at the sides */}
        {n > 1 && (
          <>
            <button onClick={() => (toFlyer(-1), onSwipe())} className="absolute bottom-[14%] left-0 w-[34%] -translate-x-[52%] opacity-55 blur-[1px]" aria-label={`@${peek(-1).name}の船`}>
              <Vessel ride={pickShip(peek(-1).key)} img={peek(-1).img} emoji={peek(-1).emoji} />
            </button>
            <button onClick={() => (toFlyer(1), onSwipe())} className="absolute bottom-[14%] right-0 w-[34%] translate-x-[52%] opacity-55 blur-[1px]" aria-label={`@${peek(1).name}の船`}>
              <Vessel ride={pickShip(peek(1).key)} img={peek(1).img} emoji={peek(1).emoji} />
            </button>
          </>
        )}
        <div className="w-[min(82%,calc((100svh-330px)*1.25))]" style={{ transform: `translateX(${dx}px) rotate(${dx / 40}deg)` }}>
          <div key={`${flyer.key}-${u}`} className="relative" style={{ animation: `${dir > 0 ? 'ship-in-right' : 'ship-in-left'} 0.7s cubic-bezier(.2,.8,.2,1) both` }}>
            <div style={{ animation: 'sail 5s ease-in-out infinite' }}>
              <Vessel ride={pickShip(flyer.key)} img={flyer.img} emoji={flyer.emoji} />
            </div>
            {!paused &&
              ['♪', '♫', '♪'].map((c, i) => (
                <span
                  key={i}
                  className="pointer-events-none absolute text-[clamp(18px,4vw,34px)] text-fuchsia-200 drop-shadow-[0_0_10px_rgba(255,120,220,0.9)]"
                  style={{ left: `${[8, 84, 70][i]}%`, top: `${[40, 30, 62][i]}%`, animation: `note-float ${3 + i}s ease-in-out ${i * 0.8}s infinite` }}
                >
                  {c}
                </span>
              ))}
          </div>
        </div>
      </div>

      <div className="relative px-5 pb-3 text-center">
        <p className="truncate text-[clamp(22px,4.6vw,40px)] font-black tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">{song.title}</p>
        {flyer.songs.length > 1 && (
          <div className="mt-1 flex justify-center gap-2">
            {flyer.songs.map((s, i) => (
              <button key={s.id} onClick={() => setK(i)} className={`h-2 w-2 rounded-full ${i === wrap(k, flyer.songs.length) ? 'bg-fuchsia-300' : 'bg-white/35'}`} aria-label={s.title} />
            ))}
          </div>
        )}
        <button
          onClick={() => onOwner?.(flyer)}
          disabled={!onOwner}
          className="mx-auto mt-2 flex max-w-[80%] items-center gap-2 rounded-full border border-fuchsia-200/40 bg-black/45 py-1 pl-1 pr-4 text-sm backdrop-blur"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/60 bg-[#1b1f3a]">
            {flyer.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={flyer.img} alt="" className="h-full w-full object-cover" />
            ) : (
              flyer.emoji
            )}
          </span>
          <span className="truncate">{flyer.isMe ? 'あなた' : `@${flyer.name}`}</span>
          {onOwner && <span className="text-white/60">›</span>}
        </button>
        <div className="mx-auto mt-2 flex max-w-md items-center gap-3 text-xs text-white/75">
          <span className="w-9 text-left tabular-nums">{fmt(t)}</span>
          <div className="relative h-1 flex-1 rounded-full bg-white/20">
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-fuchsia-400 to-pink-300 shadow-[0_0_8px_rgba(255,150,230,0.9)]" style={{ width: `${Math.min(100, (t / song.seconds) * 100)}%` }} />
          </div>
          <span className="w-9 text-right tabular-nums">{fmt(song.seconds)}</span>
        </div>
        <div className="relative mx-auto mt-3 flex max-w-md items-center justify-center gap-3">
          {([1, 2] as const).map((s) => (
            <Star key={s} n={s} on={mine >= s} onClick={() => onStar(song.id, mine === s ? ((s - 1) as 0 | 1) : s)} />
          ))}
          <button
            onClick={pause}
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-pink-200/80 bg-gradient-to-br from-fuchsia-500/80 to-violet-600/80 text-2xl shadow-[0_0_24px_rgba(255,120,220,0.6)]"
            aria-label={paused ? '再生' : '一時停止'}
          >
            {paused ? '▶' : '❚❚'}
          </button>
          <Star n={3} on={mine >= 3} onClick={() => onStar(song.id, mine === 3 ? 2 : 3)} />
          {onOwner && (
            <button
              onClick={() => onOwner(flyer)}
              className="flex h-12 shrink-0 items-center gap-1 rounded-full border border-cyan-200/50 bg-black/45 px-3 text-xs font-bold text-cyan-100 backdrop-blur"
            >
              🏝 {flyer.isMe ? '自分の島へ' : 'この人の島へ'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Star({ n, on, onClick }: { n: number; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-12 w-12 items-center justify-center rounded-full border text-sm font-bold backdrop-blur ${on ? 'border-amber-300 bg-amber-300/15 text-amber-200 shadow-[0_0_16px_rgba(255,200,80,0.6)]' : 'border-white/35 bg-black/40 text-white/75'}`}
      aria-label={`星${n}`}
    >
      ★{n}
    </button>
  );
}
