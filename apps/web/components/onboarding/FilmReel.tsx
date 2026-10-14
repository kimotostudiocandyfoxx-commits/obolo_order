'use client';

import { useEffect, useRef, useState } from 'react';
import { Sticker } from '@/components/jupiter/JupiterLesson';
import { Record } from '@/components/mercury/MercuryLesson';
import type { Made } from '@/lib/onboarding/made';

/**
 * The film of the seven days in the Sun temple (day 7, D08-S011; client 2026-10-14): 「{neo}の7日間」 —
 * the kororins (Saturn) → the stickers (Jupiter) → the song with its spinning jacket (Mercury) → the MV
 * (Mars), one line of light. Tap moves on; a piece that was not made is skipped. 〔とばす〕 ends it.
 */
type Reel = 'title' | 'kororins' | 'stickers' | 'song' | 'mv' | 'end';

export function FilmReel({ made, neo, muted, onDone }: { made: Made; neo: string; muted: boolean; onDone: () => void }) {
  const reels: Reel[] = ['title'];
  if (made.kororins?.length) reels.push('kororins');
  if (made.stickers?.length) reels.push('stickers');
  if (made.song) reels.push('song');
  if (made.mv) reels.push('mv');
  reels.push('end');
  const [i, setI] = useState(0);
  const reel = reels[Math.min(i, reels.length - 1)];
  const audio = useRef<HTMLAudioElement | null>(null);
  const next = () => (i < reels.length - 1 ? setI(i + 1) : onDone());

  useEffect(() => {
    if (reel !== 'song' || !made.song) return;
    const a = new Audio(made.song.url);
    a.muted = muted;
    audio.current = a;
    a.play().catch(() => {});
    return () => {
      a.pause();
      audio.current = null;
    };
  }, [reel, made.song, muted]);

  const day = (n: number, place: string) => <p className="mb-3 text-center text-xs tracking-[0.3em] text-amber-200/70">{n}日目　{place}</p>;

  return (
    <div className="absolute inset-0 z-[12] flex flex-col items-center justify-center bg-black/85 px-4" onClick={next}>
      <div key={reel} className="w-full max-w-lg animate-[fadeUp_0.7s_ease-out]">
        {reel === 'title' && (
          <div className="text-center">
            <p className="text-xs tracking-[0.4em] text-amber-200/60">上映</p>
            <p className="mt-3 text-2xl font-black text-amber-50">{neo}の7日間</p>
          </div>
        )}
        {reel === 'kororins' && (
          <div>
            {day(3, '土星')}
            <div className="space-y-2">
              {made.kororins!.map((k, n) => (
                <p key={n} className="mx-auto w-fit max-w-full rounded-full bg-violet-500/80 px-4 py-2 text-sm font-bold text-white" style={{ animation: `fadeUp 0.6s ease-out ${n * 0.4}s both` }}>
                  {k}
                </p>
              ))}
            </div>
          </div>
        )}
        {reel === 'stickers' && (
          <div>
            {day(4, '木星')}
            <div className="flex justify-center gap-4">
              {made.stickers!.map((s, n) => (
                <Sticker key={n} s={s} size={130} />
              ))}
            </div>
          </div>
        )}
        {reel === 'song' && made.song && (
          <div className="flex flex-col items-center">
            {day(5, '水星')}
            <Record s={{ text: made.song.words, url: made.song.jacket }} playing size={190} />
            <p className="mt-3 text-base font-black text-amber-50">{made.song.title}</p>
          </div>
        )}
        {reel === 'mv' && made.mv && (
          <div>
            {day(6, '火星')}
            <div className="rounded-xl border-[6px] border-[#2a2a2a] bg-black shadow-[0_0_80px_rgba(255,200,80,0.45)]">
              <video src={made.mv.url} poster={made.mv.poster ?? undefined} autoPlay playsInline muted={muted} onEnded={next} className="aspect-video w-full object-contain" />
            </div>
          </div>
        )}
        {reel === 'end' && <p className="text-center text-lg font-black text-amber-50">一本の、光の線になった</p>}
      </div>
      <span className="pb-safe absolute bottom-6 text-xs tracking-widest text-white/50">TAP</span>
      <button
        className="absolute right-4 top-[calc(12px+env(safe-area-inset-top))] rounded-full bg-white/15 px-3 py-1 text-xs text-white/80"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        とばす
      </button>
    </div>
  );
}
