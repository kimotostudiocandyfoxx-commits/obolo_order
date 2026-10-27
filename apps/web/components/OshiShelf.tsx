'use client';

import type { DeliveryView } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * 〔推し〕 (story draft 21, M-R124/M-R109): what the dachi delivered — kororins, jackets, songs, MVs, stages —
 * for 88 hours each. A dachi's work carries a small name tag. It plays only when tapped; eight at a time;
 * nothing is counted (no numbers anywhere, no "seen" marks back to the sender).
 */
const ICON: Record<DeliveryView['kind'], string> = { kororin: '🪐', jacket: '🦋', song: '🚢', mv: '🛸', stage: '🎤' };

export function OshiShelf() {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DeliveryView[]>([]);
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState<DeliveryView | null>(null);
  useEffect(() => {
    if (!me || !open) return;
    void getApi()
      .oshi()
      .then(setItems)
      .catch(() => setItems([]));
  }, [me, open]);
  if (!me) return null;
  const shown = items.slice(page * 8, page * 8 + 8);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-full border border-amber-200/40 bg-black/30 px-3 py-1 text-xs font-bold tracking-widest text-amber-100">
        推し
      </button>
      {open && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60" onClick={() => (setOpen(false), setPlaying(null))}>
          <div className="pb-safe w-full max-w-md rounded-t-3xl bg-[#140f22] p-5 text-white" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-sm font-black tracking-[0.3em] text-amber-100">推し</p>
            <p className="mt-1 text-center text-[11px] text-white/50">ダチが届けてくれた作品。88時間たつと、作った人のところへ帰ります</p>
            {shown.length === 0 ? (
              <p className="py-10 text-center text-sm text-white/60">まだ、何も届いていません</p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {shown.map((d) => (
                  <button key={d.id} onClick={() => setPlaying(d)} className="flex flex-col overflow-hidden rounded-2xl bg-white/10 text-left active:scale-95">
                    <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-violet-900 to-amber-900 text-4xl">
                      {d.posterUrl || (d.kind === 'jacket' && d.url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.posterUrl ?? d.url ?? ''} alt="" className="h-full w-full object-cover" />
                      ) : (
                        ICON[d.kind]
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-[13px] font-bold">{d.title || d.text || ICON[d.kind]}</p>
                      <p className="mt-0.5 inline-block rounded-full bg-amber-200/20 px-2 text-[10px] text-amber-100">@{d.from.displayName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {items.length > 8 && (
              <button onClick={() => setPage((p) => ((p + 1) * 8 < items.length ? p + 1 : 0))} className="mt-3 w-full text-center text-[12px] text-amber-200/80 underline">
                つぎの8つ
              </button>
            )}
            {playing && (
              <div className="mt-4 rounded-2xl bg-black/40 p-3">
                <p className="text-[12px] text-white/70">
                  {ICON[playing.kind]} {playing.title || playing.text}
                </p>
                {playing.kind === 'mv' && playing.url ? (
                  <video src={playing.url} poster={playing.posterUrl ?? undefined} controls autoPlay playsInline className="mt-2 aspect-video w-full rounded-xl bg-black" />
                ) : playing.kind === 'jacket' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  playing.url ? <img src={playing.url} alt="" className="mt-2 w-full rounded-xl" /> : <p className="mt-2 text-lg font-bold">{playing.title}</p>
                ) : playing.url ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio src={playing.url} controls autoPlay className="mt-2 w-full" />
                ) : (
                  <p className="mt-2 text-[14px]">{playing.text}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
