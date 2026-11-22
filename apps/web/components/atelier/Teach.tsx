'use client';

import type { Lesson } from '@/lib/atelier/unlock';

/**
 * OBOLON teaches what opened today (M-R210), laid over the chat — the talk stays visible under the sheet, no route
 * change. Shown once per lesson (me.story 'sys.atelier_<lesson>', with this device as the fallback), and never when the
 * atelier opens from a story step (the morning scene teaches there and marks it shown).
 * The words are OBOLON's own lines from the mornings of the script (public/story: D04-S002 for the basics, D04-S002b,
 * D05-S001, D06-S001, D07-S001, D07V-S001), word for word.
 */
const LINES: Record<Lesson, string[]> = {
  basics: ['作る時は、、、門が開いて、この神殿の奥の、月の工房に、つながる。', '作ったものは、、、Bluenaに、しまわれる。見せる時は、、、Bluenaから、星へ、投影する。', '作るのは、月。しまうのは、Bluena。見せるのは、、、星だ。'],
  voice: ['、、、{neo}。お前は、ついに、コロリンを、作れるようになる。', '、、、つぶやきだ。思ったことを、声で、{bati}に、話せ。', '{bati}が、魔法で、それを、コロリンにする。', '、、、見せたいコロリンは、土星へ、飛ばせる。'],
  art: ['、、、{neo}。お前は、ついに、アートを、作れるようになる。', 'アートは、、、正方形の、一枚の絵だ。写真でも、描いた絵でも、字だけでも、いい。', '{bati}に、話せ。どんな絵にしたいか。{bati}が、それを、魔法で、描く。'],
  song: ['、、、{neo}。お前は、ついに、曲を、作れるようになる。', '今日食べたラーメンが、美味しかった。学校に、遅刻しそうだ。、、、そんな自分の日常を、話せばいい。言葉が、そのまま、歌詞になる。', 'きのうのアートを、曲の顔に、してもいい。'],
  video: ['、、、{neo}。お前は、ついに、映像を、作れるようになる。', 'きのうの曲に、映像をつける。MVだ。、、、カメラは、いらない。撮りたい場面を、話せばいい。'],
  radio: ['、、、{neo}。お前は、ついに、ラジオを、作れるようになる。', '自分の声で、話す。自分の曲を、かける。、、、それを、録っておく。それが、番組だ。', '、、、録り直しは、何度でも、できる。'],
};

export function Teach({ lesson, neo, bati, onClose }: { lesson: Lesson; neo: string; bati: string; onClose: () => void }) {
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
            <p key={l}>{l.replaceAll('{neo}', neo || '…').replaceAll('{bati}', bati)}</p>
          ))}
        </div>
        <button onClick={onClose} className="mt-3 w-full rounded-full bg-amber-200 py-2.5 text-[14px] font-black text-slate-950">
          わかった
        </button>
      </div>
    </div>
  );
}
