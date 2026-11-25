'use client';

import { miniShown } from '@/lib/bluena/music';
import { music, useMusic } from '@/lib/bluena/musicEngine';

/**
 * R16 (client 2026-11-25): a song from Bluena keeps playing — once its viewer closes (or you go back to a talk), this
 * small player stays at the top right, over every Moon screen (the Bati chat, the ダチ hall, a ダチ talk, KIMORIN's): its
 * picture, its title, ▶/❚❚ and ✕. A tap on the title opens the viewer again. While a voice speaks the music is low (the
 * ♪ dims); the mic pauses it (one mic).
 */
export function MiniPlayer({ onOpen }: { onOpen?: (trackId: string) => void }) {
  const s = useMusic();
  if (!miniShown(s) || !s.track) return null;
  const on = s.status === 'playing' || s.status === 'loading';
  const pct = s.dur ? Math.min(100, (s.at / s.dur) * 100) : 0;
  return (
    <div className="pointer-events-none absolute right-3 top-[calc(env(safe-area-inset-top)+104px)] z-[44] flex justify-end" data-testid="mini-player">
      <div className="pointer-events-auto relative flex max-w-[min(70vw,260px)] items-center gap-2 overflow-hidden rounded-full border border-sky-200/35 bg-[rgba(12,17,52,.82)] py-1 pl-1 pr-1.5 shadow-[0_8px_24px_rgba(0,0,0,.45)] backdrop-blur-xl">
        <button onClick={() => onOpen?.(s.track!.id)} className="flex min-w-0 items-center gap-2 text-left" aria-label={`${s.track.title}をひらく`}>
          <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: 'conic-gradient(from 210deg, #26407e, #6cc9f0, #8a6cf0, #26407e)', animation: on ? 'mini-spin 8s linear infinite' : undefined }}>
            {s.track.image && !s.track.image.startsWith('idb:') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.track.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className={`text-[13px] text-white ${s.ducked ? 'opacity-50' : ''}`}>♪</span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-bold text-[#f4f1ff]">{s.track.title || '♪'}</span>
            <span className="block text-[9.5px] text-sky-100/65">{s.ducked ? 'バティが話しているあいだ、小さく' : on ? 'ながしているよ' : 'とめているよ'}</span>
          </span>
        </button>
        <button onClick={() => music.toggle()} aria-label={on ? '止める' : '再生'} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[rgba(223,230,255,.92)] text-[12px] text-[#070b24]" data-testid="mini-toggle">
          {on ? '❚❚' : '▶'}
        </button>
        <button onClick={() => music.close()} aria-label="とじる" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] text-sky-100/70" data-testid="mini-close">
          ✕
        </button>
        <span className="absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full bg-white/10" aria-hidden>
          <span className="block h-full bg-sky-200/80" style={{ width: `${pct}%` }} />
        </span>
      </div>
      <style>{'@keyframes mini-spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
