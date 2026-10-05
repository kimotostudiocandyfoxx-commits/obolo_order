'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Artwork } from '@/components/Artwork';
import { CARD_RECT, CREATE_RECT, fmt, ISLANDS, type Island, type Song } from '@/lib/mercury/islands';
import { spriteUrl, stillUrl } from '@/lib/onboarding/media';
import { synth } from '@/lib/synth';

/**
 * Mercury — the planet of music (client design 2026-10-05, docs/mercury.md).
 *  海図: the sea chart, one island per genre. Tap an island → its card → 「この島を航海する」.
 *  Player: records of that island; swipe sideways for the next / previous song; three stars.
 *  作曲 / 船 (profile) come with the client's next designs (placeholders for now).
 * Laid out as a square stage with the controls underneath (docs/devices.md).
 * VISUAL DEMO: sample songs, synthesised sound (P-MER-2).
 */
export interface MercuryEvents {
  onIsland?: () => void;
  onSail?: () => void;
  onSwipe?: () => void;
  onStar?: () => void;
}

export function MercuryWorld({ events, overlay }: { events?: MercuryEvents; overlay?: ReactNode }) {
  const [selected, setSelected] = useState<Island>(ISLANDS.find((i) => i.id === 'pop')!);
  const [sailing, setSailing] = useState<Island | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const ev = useRef(events);
  ev.current = events;
  useEffect(() => () => synth.stop(), []);

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 1800);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#050b1f] text-white">
      {sailing ? (
        <Player
          island={sailing}
          onSwipe={() => ev.current?.onSwipe?.()}
          onStar={() => ev.current?.onStar?.()}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-4 pt-[calc(12px+env(safe-area-inset-top))]">
            <button onClick={() => say('検索は準備中です')} className="mx-auto flex w-full max-w-xl items-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-left text-sm text-white/55">
              <span className="text-lg">🔍</span> 島・曲・船をさがす
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-2">
            <div className="relative w-full max-w-[min(100%,calc((100svh-230px)*1.2875))]" style={{ aspectRatio: '1254 / 974' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stillUrl('mercury-map')} alt="" className="absolute inset-0 h-full w-full select-none rounded-xl" draggable={false} />
              {ISLANDS.map((is) => (
                <button
                  key={is.id}
                  onClick={() => {
                    setSelected(is);
                    ev.current?.onIsland?.();
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: `${is.x}%`,
                    top: `${is.y}%`,
                    width: `${is.r * 2}%`,
                    aspectRatio: '1.5 / 1',
                    boxShadow: selected.id === is.id ? `0 0 0 3px ${is.color}, 0 0 28px 6px ${is.color}aa` : undefined,
                    background: selected.id === is.id ? `${is.color}18` : undefined,
                  }}
                  aria-label={is.name}
                />
              ))}
              {/* the island card (covers the one drawn on the chart) */}
              <div
                className="absolute flex flex-col justify-between rounded-2xl border border-white/20 bg-[#0d1530]/95 p-[1.4%] shadow-2xl backdrop-blur"
                style={{ left: `${CARD_RECT.left}%`, top: `${CARD_RECT.top}%`, width: `${CARD_RECT.width}%`, height: `${CARD_RECT.height}%`, containerType: 'inline-size' }}
              >
                <p className="truncate text-center text-[clamp(10px,9cqw,20px)] font-bold">{selected.name}</p>
                <div className="space-y-[2cqw] text-[clamp(8px,6.5cqw,15px)] text-white/80">
                  <p className="flex justify-between">
                    <span>👤 住民</span>
                    <span>{selected.residents.toLocaleString()}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>♫ 収録</span>
                    <span>{selected.songs.length}曲</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSailing(selected);
                    ev.current?.onSail?.();
                  }}
                  className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 py-[3cqw] text-[clamp(8px,6.5cqw,15px)] font-bold shadow-[0_0_16px_rgba(190,100,255,0.6)]"
                >
                  この島を航海する
                </button>
              </div>
              <button
                onClick={() => say('島をつくるのは準備中です')}
                className="absolute flex items-center justify-center gap-2 rounded-full border border-cyan-200/40 bg-[#081430]/95 text-[clamp(10px,2.2vw,18px)]"
                style={{ left: `${CREATE_RECT.left}%`, top: `${CREATE_RECT.top}%`, width: `${CREATE_RECT.width}%`, height: `${CREATE_RECT.height}%` }}
              >
                ＋ 島をつくる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* controls: 海図 / 作曲 / 船 */}
      <nav className="relative z-20 mx-auto mb-[calc(10px+env(safe-area-inset-bottom))] flex w-[min(94%,560px)] items-center justify-around rounded-[2rem] border border-white/10 bg-white/5 px-6 py-2.5 backdrop-blur">
        <button
          onClick={() => {
            synth.stop();
            setSailing(null);
          }}
          className={`flex flex-col items-center text-xs ${sailing ? 'text-white/60' : 'text-amber-200'}`}
        >
          <span className="text-2xl">🗺️</span>海図
        </button>
        <button onClick={() => say('作曲の画面は、次のデザインで作ります')} className="-mt-8 flex flex-col items-center text-xs">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 via-fuchsia-500 to-violet-500 text-2xl shadow-[0_0_24px_rgba(220,90,255,0.6)]">♫+</span>
          作曲
        </button>
        <button onClick={() => say('船（プロフィール）は、次のデザインで作ります')} className="flex flex-col items-center text-xs text-white/60">
          <span className="text-2xl">⛵</span>船
        </button>
      </nav>

      {toast && (
        <div className="absolute inset-x-0 bottom-28 z-[70] flex justify-center">
          <span className="rounded-full bg-black/75 px-4 py-2 text-sm">{toast}</span>
        </div>
      )}
      {overlay}
    </div>
  );
}

/** A record (round art) for a song. */
function Record({ song, spinning, className = '' }: { song: Song; spinning?: boolean; className?: string }) {
  return (
    <div className={`relative aspect-square overflow-hidden rounded-full border-[6px] border-black/80 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ${className}`}>
      <div className={`absolute inset-0 ${spinning ? 'animate-[spin-slow_14s_linear_infinite]' : ''}`}>
        {song.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spriteUrl(song.cover)} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <Artwork hue={song.hue ?? 220} emoji={song.emoji ?? '🎵'} className="h-full w-full" />
        )}
        <span className="absolute left-1/2 top-1/2 h-[6%] w-[6%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300/80 bg-black" />
      </div>
    </div>
  );
}

function Player({ island, onSwipe, onStar }: { island: Island; onSwipe: () => void; onStar: () => void }) {
  const [tab, setTab] = useState<'all' | 'follow' | 'friend'>('all');
  const songs = island.songs.filter((s) => tab === 'all' || (tab === 'follow' ? s.follow : s.friend));
  const list = songs.length ? songs : island.songs;
  const [i, setI] = useState(0);
  const [t, setT] = useState(0);
  const [stars, setStars] = useState<Record<string, number>>({});
  const song = list[((i % list.length) + list.length) % list.length];
  const prevSong = list[(((i - 1) % list.length) + list.length) % list.length];
  const nextSong = list[(((i + 1) % list.length) + list.length) % list.length];
  const drag = useRef<{ x: number; dx: number } | null>(null);
  const [dx, setDx] = useState(0);

  // play the song (synth) and run the clock
  useEffect(() => {
    synth.play(song.preset);
    setT(0);
    const id = setInterval(() => setT((v) => (v + 1 >= song.seconds ? 0 : v + 1)), 1000);
    return () => clearInterval(id);
  }, [song]);

  const go = (d: number) => {
    setI((v) => v + d);
    onSwipe();
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* blurred art behind */}
      <div className="pointer-events-none absolute inset-0 opacity-40 blur-2xl">
        {song.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spriteUrl(song.cover)} alt="" className="h-full w-full object-cover" />
        ) : (
          <Artwork hue={song.hue ?? 220} emoji="" className="h-full w-full" />
        )}
      </div>
      <div className="relative px-4 pt-[calc(10px+env(safe-area-inset-top))]">
        <p className="mb-2 text-center text-xs tracking-[0.3em] text-white/60">⚓ {island.name}</p>
        <div className="mx-auto flex w-full max-w-md rounded-full border border-white/15 bg-black/30 p-1">
          {(
            [
              ['all', '全部'],
              ['follow', 'フォロー'],
              ['friend', 'ダチ'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                setTab(k);
                setI(0);
              }}
              className={`flex-1 rounded-full py-1.5 text-sm ${tab === k ? 'bg-white/10 font-bold text-amber-200' : 'text-white/70'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center overflow-hidden"
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
          if (Math.abs(d) > 50) go(d < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDx(0);
        }}
      >
        <button onClick={() => go(-1)} className="absolute left-0 top-1/2 w-[22%] -translate-x-[55%] -translate-y-1/2 opacity-70" aria-label="前の曲">
          <Record song={prevSong} />
        </button>
        <div className="w-[min(64%,calc(100svh-420px))] transition-transform" style={{ transform: `translateX(${dx}px) rotate(${dx / 20}deg)` }}>
          <Record song={song} spinning />
        </div>
        <button onClick={() => go(1)} className="absolute right-0 top-1/2 w-[22%] -translate-y-1/2 translate-x-[55%] opacity-70" aria-label="次の曲">
          <Record song={nextSong} />
        </button>
      </div>

      <div className="relative px-6 pb-3 text-center">
        <p className="text-2xl font-black tracking-wide drop-shadow">{song.title}</p>
        <p className="text-sm font-bold text-cyan-300">{song.artist}</p>
        <div className="mx-auto mt-2 flex max-w-md items-center gap-3 text-xs text-white/70">
          <span className="w-9 text-left">{fmt(t)}</span>
          <div className="relative h-1.5 flex-1 rounded-full bg-white/15">
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-400" style={{ width: `${(t / song.seconds) * 100}%` }} />
          </div>
          <span className="w-9 text-right">{fmt(song.seconds)}</span>
        </div>
        <div className="mt-3 flex justify-center gap-4">
          {[1, 2, 3].map((n) => {
            const on = (stars[song.id] ?? 0) >= n;
            return (
              <button
                key={n}
                onClick={() => {
                  setStars((s) => ({ ...s, [song.id]: s[song.id] === n ? n - 1 : n }));
                  onStar();
                }}
                className={`flex h-12 w-12 items-center justify-center rounded-full border text-xl ${on ? 'border-amber-300 text-amber-300 shadow-[0_0_16px_rgba(255,200,80,0.6)]' : 'border-white/40 text-white/70'}`}
                aria-label={`星${n}`}
              >
                {on ? '★' : '☆'}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[10px] text-white/40">← スワイプで次の曲 →</p>
      </div>
    </div>
  );
}
