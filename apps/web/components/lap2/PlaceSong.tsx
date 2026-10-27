'use client';

import { useEffect, useRef, useState } from 'react';
import { getApi } from '@/lib/api';

/**
 * 〔曲を置く〕 on your island (L2-MERCURY-S002): one of your songs from the soil (⛏ 土の中の曲), KIMORIN⭐︎'s
 * 『2』 (only its second verse exists), or nothing for now. A new song is made at Mercury's 〔♫+ 作曲〕 —
 * here it is promised and placed once made. What is placed stands on the beach as a record.
 */
const KIMORIN_2 = '/onboarding/kimorin-mercury-2.m4a';
type Song = { id: string; title: string; url: string };

export function PlaceSong({ onDone }: { onDone: (a: Record<string, string>) => void }) {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [mode, setMode] = useState<'menu' | 'mine' | 'new'>('menu');
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    getApi()
      .savedSongs()
      .then((l) => setSongs(l.map((s) => ({ id: s.id, title: s.title, url: s.url }))))
      .catch(() => setSongs([]));
    return () => audio.current?.pause();
  }, []);
  const play = (url: string) => {
    audio.current?.pause();
    if (playing === url) return setPlaying(null);
    const a = new Audio(url);
    audio.current = a;
    void a.play().catch(() => undefined);
    setPlaying(url);
  };
  const btn = 'w-full rounded-full border border-cyan-200/50 bg-cyan-200/10 py-3 text-[14px] tracking-wider active:scale-[0.98] disabled:opacity-40';
  return (
    <div className="absolute inset-0 z-[12] flex items-end justify-center bg-black/55 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md animate-[fadeUp_0.5s_ease-out] rounded-3xl border border-cyan-100/25 bg-[#07141a]/95 p-5 text-cyan-50">
        <p className="text-center text-[15px] font-bold tracking-wider">🏝️ 曲を置く</p>
        {mode === 'menu' && (
          <div className="mt-4 space-y-2">
            {songs && songs.length > 0 && (
              <button onClick={() => setMode('mine')} className={btn}>
                自分の曲を置く
              </button>
            )}
            <button onClick={() => setMode('new')} className={btn}>
              新しく一曲作って置く
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => play(KIMORIN_2)} className="h-11 w-11 shrink-0 rounded-full bg-white/10 text-lg" aria-label="『2』を聴く">
                {playing === KIMORIN_2 ? '■' : '▶'}
              </button>
              <button onClick={() => onDone({ place: 'kimorin' })} className={btn}>
                KIMORINの『2』を置く
              </button>
            </div>
            <button onClick={() => onDone({ place: 'none' })} className="w-full py-2 text-[13px] text-cyan-50/60">
              今は置かない
            </button>
          </div>
        )}
        {mode === 'mine' && (
          <div className="mt-3 max-h-[50svh] space-y-2 overflow-y-auto">
            <p className="text-center text-[12px] text-cyan-50/70">⛏ 土の中の曲</p>
            {songs?.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <button onClick={() => play(s.url)} className="h-11 w-11 shrink-0 rounded-full bg-white/10 text-lg" aria-label={`${s.title}を聴く`}>
                  {playing === s.url ? '■' : '▶'}
                </button>
                <button onClick={() => onDone({ place: 'mine', place_song: s.title.slice(0, 60) })} className="flex-1 truncate rounded-full border border-cyan-200/40 px-4 py-2.5 text-left text-[13px]">
                  {s.title}
                </button>
              </div>
            ))}
            <button onClick={() => setMode('menu')} className="w-full py-2 text-[13px] text-cyan-50/60">
              もどる
            </button>
          </div>
        )}
        {mode === 'new' && (
          <div className="mt-3 space-y-3 text-center">
            <p className="text-[13px] leading-relaxed text-cyan-50/80">フリージー「作るなら、話してみろ。今日の言葉で、一曲だ。」</p>
            <p className="text-[12px] leading-relaxed text-cyan-50/60">〔♫+ 作曲〕で、話した言葉が歌詞になります。作曲の前に、マナを使うか確認が出ます。できた曲は、〔曲を置く〕でそのまま浜へ（土の中にもしまわれます）</p>
            <button onClick={() => onDone({ place: 'new' })} className={btn}>
              あとで作って置く
            </button>
            <button onClick={() => setMode('menu')} className="w-full py-2 text-[13px] text-cyan-50/60">
              もどる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
