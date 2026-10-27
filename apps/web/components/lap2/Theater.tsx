'use client';

import { useEffect, useState } from 'react';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { getApi } from '@/lib/api';
import type { MvMade } from '@/lib/onboarding/made';

/**
 * The theatre next to your studio (L2-MARS-S003): the theme said aloud (or a tag), the red curtain lifted,
 * ① the first film — yours, a dachi's from 〔推し〕 (KIMORIN⭐︎'s ten seconds is there), or a new shoot (mana,
 * asked first; made in the studio) — ② more and their order (tap order 1·2·3, tap again to take off), ③ whether
 * the dachi may see it. Showing the theatre and delivering a film are asked apart.
 */
type Film = { key: string; title: string; poster: string | null; from: 'mine' | 'dachi' };
const TAGS = ['笑える映像だけ', '眠る前に見たい映像', '自分の作った映像だけ', 'まだ決めない'];
const KIMORIN_TEN: Film = { key: 'kimorin-ten', title: 'KIMORIN⭐︎の十秒', poster: '/onboarding/s/mars-screens.jpg', from: 'dachi' };
type Phase = 'theme' | 'curtain' | 'films' | 'shoot' | 'show';

export function Theater({ mv, onDone }: { mv: MvMade | null; onDone: (a: Record<string, string>) => void }) {
  const [phase, setPhase] = useState<Phase>('theme');
  const [theme, setTheme] = useState('');
  const [films, setFilms] = useState<Film[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [tab, setTab] = useState<'mine' | 'dachi'>('mine');
  useEffect(() => {
    const mine: Film[] = mv ? [{ key: `mv-${mv.id}`, title: mv.title || '自分のMV', poster: mv.poster, from: 'mine' }] : [];
    void Promise.all([getApi().marsBackstage().catch(() => []), getApi().oshi('mv').catch(() => [])]).then(([vids, sent]) => {
      setFilms([
        ...mine,
        ...vids.map((x) => ({ key: `v-${x.id}`, title: x.title || '撮った映像', poster: x.posterUrl, from: 'mine' as const })),
        KIMORIN_TEN,
        ...sent.map((d) => ({ key: `d-${d.id}`, title: `${d.title || '映像'}（${d.from.displayName}）`, poster: d.posterUrl, from: 'dachi' as const })),
      ]);
    });
  }, [mv]);
  const toggle = (k: string) => setOrder((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));
  const title = (k: string) => films.find((f) => f.key === k)?.title ?? '';
  const done = (shown: boolean) => onDone({ theater: shown ? 'show' : 'private', theater_theme: theme.slice(0, 40) || 'まだ決めない', theater_films: order.map(title).join('／').slice(0, 200) });
  const btn = 'w-full rounded-full border border-rose-200/50 bg-rose-200/10 py-3 text-[14px] tracking-wider active:scale-[0.98] disabled:opacity-40';
  const soft = 'w-full py-2 text-[13px] text-rose-50/60';
  return (
    <div className="absolute inset-0 z-[12] flex items-end justify-center bg-black/55 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md animate-[fadeUp_0.5s_ease-out] rounded-3xl border border-rose-100/25 bg-[#1a0a0c]/95 p-5 text-rose-50">
        <p className="text-center text-[15px] font-bold tracking-wider">🎬 上映館</p>
        {phase === 'theme' && (
          <div className="mt-3 space-y-3">
            <p className="text-center text-[13px] text-rose-50/75">上映館のテーマ</p>
            <VoiceField value={theme} onChange={setTheme} placeholder="笑える映像だけ" maxLength={40} />
            <div className="flex flex-wrap justify-center gap-2">
              {TAGS.map((t) => (
                <button key={t} onClick={() => setTheme(t)} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px]">
                  {t}
                </button>
              ))}
            </div>
            <button onClick={() => setPhase('curtain')} disabled={!theme.trim()} className={btn}>
              このテーマにする
            </button>
          </div>
        )}
        {phase === 'curtain' && (
          <div className="mt-3 space-y-3 text-center">
            <div className="relative mx-auto h-28 w-48 overflow-hidden rounded-t-xl bg-[#3a0a12]">
              <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,#8a1020_0_10px,#6a0a18_10px_20px)]" />
              <p className="absolute inset-x-0 bottom-2 text-[12px] font-bold">『{theme}』</p>
            </div>
            <p className="text-[13px]">ヒポキン「幕を、上げろ。」</p>
            <button onClick={() => setPhase('films')} className={btn}>
              幕を上げる
            </button>
          </div>
        )}
        {phase === 'films' && (
          <div className="mt-3 space-y-3">
            <p className="text-center text-[12px] text-rose-50/70">『{theme}』　押した順に1・2・3（もう一度押すと外れます）。一本だけでも開けます</p>
            <div className="flex gap-2">
              {(['mine', 'dachi'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-full py-1.5 text-[12px] ${tab === t ? 'bg-rose-200/25' : 'bg-white/5 text-rose-50/60'}`}>
                  {t === 'mine' ? '自分の映像' : 'ダチが届けてくれた映像'}
                </button>
              ))}
            </div>
            <div className="grid max-h-[34svh] grid-cols-3 gap-2 overflow-y-auto">
              {films
                .filter((f) => f.from === tab)
                .map((f) => (
                  <button key={f.key} onClick={() => toggle(f.key)} className={`relative overflow-hidden rounded-lg bg-black/40 ring-2 ${order.includes(f.key) ? 'ring-rose-300' : 'ring-transparent'}`}>
                    {f.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.poster} alt="" className="aspect-video w-full object-cover" />
                    ) : (
                      <div className="aspect-video w-full bg-[radial-gradient(circle,#5a1e2e,#1a0a0c)]" />
                    )}
                    <span className="block truncate px-1 py-0.5 text-[10px]">{f.title}</span>
                    {order.includes(f.key) && <span className="absolute left-1 top-1 rounded-full bg-rose-300 px-1.5 text-[11px] font-black text-rose-900">{order.indexOf(f.key) + 1}</span>}
                  </button>
                ))}
            </div>
            {tab === 'dachi' && <p className="text-[11px] text-rose-50/50">ダチの映像は元の作品につながっていて、作った人が消すと、上映館でも見られなくなります</p>}
            <button onClick={() => setPhase('shoot')} className="w-full rounded-full bg-white/5 py-2 text-[12px] text-rose-50/70">
              ＋ 新しく一本撮って置く
            </button>
            <button onClick={() => setPhase('show')} disabled={!order.length} className={btn}>
              この順で並べる
            </button>
          </div>
        )}
        {phase === 'shoot' && (
          <div className="mt-3 space-y-3 text-center">
            <p className="text-[13px] text-rose-50/80">新しく撮る時は、マナを使います。撮影は、myスタジオの〔🎥 撮影〕でできます。撮れたら、上映館にそのまま置けます</p>
            <p className="text-[11px] text-rose-50/55">本当にいる人の顔や名前、ほかの人の作品のキャラクターは、映像にしません</p>
            <button onClick={() => setPhase('films')} className={btn}>
              やめる（ほかの一本を選ぶ）
            </button>
          </div>
        )}
        {phase === 'show' && (
          <div className="mt-3 space-y-3">
            <ol className="space-y-1 text-[13px]">
              {order.map((k, n) => (
                <li key={k}>
                  {n + 1}. {title(k)}
                </li>
              ))}
            </ol>
            <p className="text-center text-[12px] text-rose-50/70">見せる相手はダチだけ。押さなければ、上映館はあなただけのものです</p>
            <button onClick={() => done(true)} className={btn}>
              ダチに見せる
            </button>
            <button onClick={() => done(false)} className={soft}>
              今は、自分だけ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
