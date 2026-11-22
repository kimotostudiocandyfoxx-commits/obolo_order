'use client';

import type { Lesson } from '@/lib/atelier/unlock';

/**
 * OBOLON teaches what opened today (M-R210), laid over the chat — the talk stays visible under the sheet, no route
 * change. Shown once per lesson (me.story 'sys.atelier_<lesson>', with this device as the fallback).
 * PLACEHOLDER (P-ATELIER-4): every line here is provisional; the story session is rewriting the script and will supply
 * the exact words.
 */
const LINES: Record<Lesson, string[]> = {
  basics: ['ここは、月で作る場所。', 'バティに、ことばで頼んでごらん。自分の姿を変える、バティを着せかえる、調べる、絵を見る。', '作ったものは、そのままブルーナにしまわれる。'],
  voice: ['今日から、コロリンが作れる。', 'つぶやきたいことを、バティに言ってごらん。コロリンになって、ブルーナの土星の棚にしまわれる。', '〔星へ飛ばす〕と、土星へ。'],
  art: ['今日から、アートが作れる。', 'どんな絵がいいか、バティに言ってごらん。「もっと明るく」と言えば、描き直してくれる。'],
  song: ['今日から、曲が作れる。', '歌にしたいことを、バティに話してごらん。'],
  video: ['今日から、映像が作れる。', 'どんな映像にしたいか言えば、きみの曲にのせて作ってくれる。'],
  radio: ['今日から、ラジオ番組が作れる。', '番組の名前を言って、ブルーナの曲を流しながら話して録る。何度でも録り直せる。'],
};

export function Teach({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/45 px-4 pb-[calc(110px+env(safe-area-inset-bottom))]" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-amber-200/25 bg-[rgba(16,11,26,0.82)] p-4 backdrop-blur-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/onboarding/obolon.webp" alt="" className="h-10 w-10 rounded-full bg-black object-cover object-top" />
          <p className="text-[11px] tracking-[0.22em] text-amber-200/90">OBOLON</p>
        </div>
        <div className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-white/90">
          {LINES[lesson].map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
        <button onClick={onClose} className="mt-3 w-full rounded-full bg-amber-200 py-2.5 text-[14px] font-black text-slate-950">
          わかった
        </button>
      </div>
    </div>
  );
}
