'use client';

import { useState } from 'react';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * The Moon's basin on the second journey (L2-MOON-S002): change the look worn now. Say what to change or add
 * (the little tags on the rim add words too — colours, hair, clothes, things to hold, wings; it may be
 * unreal), 〔描く〕 asks about mana first, four looks rise; one refine with a wish; or stay as you are.
 * The chosen look becomes the profile.
 */
const TAGS = ['色', '髪', '服', '持ち物', '翼'];
type Phase = 'say' | 'ask' | 'drawing' | 'pick' | 'refine' | 'confirm';

export function Relook({ onDone }: { onDone: (a: Record<string, string>) => void }) {
  const { me, setMe } = useAuth();
  const [phase, setPhase] = useState<Phase>('say');
  const [wish, setWish] = useState('');
  const [again, setAgain] = useState('');
  const [cands, setCands] = useState<{ id: string; url: string }[]>([]);
  const [refined, setRefined] = useState(false);
  const [sel, setSel] = useState<{ id: string; url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const draw = async (instruction: string, isRefine: boolean) => {
    setPhase('drawing');
    setErr(null);
    try {
      const r = await getApi().refineLook(null, instruction.slice(0, 60));
      if (!r.candidates.length) throw new Error('none');
      setCands(r.candidates);
      if (isRefine) setRefined(true);
      setPhase('pick');
    } catch {
      setErr('水盤が、くもってしまった……。もう一度、話してみて');
      setPhase(isRefine ? 'refine' : 'say');
    }
  };
  const choose = async () => {
    if (!sel) return;
    try {
      setMe(await getApi().chooseLook(sel.id));
    } catch {
      /* the look stays as it was */
    }
    onDone({ look: 'change' });
  };
  const btn = 'w-full rounded-full border border-sky-200/50 bg-sky-200/10 py-3 text-[14px] tracking-wider active:scale-[0.98] disabled:opacity-40';
  const soft = 'w-full py-2 text-[13px] text-sky-50/60';
  return (
    <div className="absolute inset-0 z-[12] flex items-end justify-center bg-black/55 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md animate-[fadeUp_0.5s_ease-out] rounded-3xl border border-sky-100/25 bg-[#0a0f1c]/95 p-5 text-sky-50">
        <p className="text-center text-[15px] font-bold tracking-wider">水盤</p>
        {me?.avatarUrl && phase !== 'pick' && phase !== 'confirm' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.avatarUrl} alt="" className="mx-auto mt-3 h-32 w-32 rounded-full object-cover ring-2 ring-sky-200/40" />
        )}
        {(phase === 'say' || phase === 'refine') && (
          <div className="mt-3 space-y-3">
            {err && <p className="text-center text-[12px] text-sky-200/80">{err}</p>}
            <p className="text-center text-[13px] text-sky-50/75">{phase === 'say' ? '変えたいところや、足したいものを' : '要望を、ひとこと（例「もっとかっこよく」）'}</p>
            <VoiceField value={phase === 'say' ? wish : again} onChange={phase === 'say' ? setWish : setAgain} placeholder={phase === 'say' ? '翼をつけて、髪を銀色に' : 'もっとかっこよく'} maxLength={60} />
            {phase === 'say' && (
              <div className="flex flex-wrap justify-center gap-2">
                {TAGS.map((t) => (
                  <button key={t} onClick={() => setWish((w) => (w ? `${w}、${t}` : t))} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px]">
                    {t}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => (phase === 'say' ? setPhase('ask') : void draw(`${wish}。${again}`, true))} disabled={!(phase === 'say' ? wish : again).trim()} className={btn}>
              描く
            </button>
            <button onClick={() => (phase === 'say' ? onDone({ look: 'stay' }) : setPhase('pick'))} className={soft}>
              {phase === 'say' ? 'やめて今の姿のまま' : 'もどる'}
            </button>
          </div>
        )}
        {phase === 'ask' && (
          <div className="mt-4 space-y-2">
            <p className="text-center text-[13px] text-sky-50/80">描くのに、マナを使います。描きますか？</p>
            <button onClick={() => void draw(wish, false)} className={btn}>
              描く
            </button>
            <button onClick={() => setPhase('say')} className={soft}>
              やめる
            </button>
          </div>
        )}
        {phase === 'drawing' && <p className="mt-6 animate-pulse text-center text-[13px]">水盤が、光っている……</p>}
        {phase === 'pick' && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {cands.map((c) => (
                <button key={c.id} onClick={() => setSel(c)} className={`overflow-hidden rounded-2xl ring-2 ${sel?.id === c.id ? 'ring-sky-300' : 'ring-transparent'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.url} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
            <button onClick={() => setPhase('confirm')} disabled={!sel} className={btn}>
              この姿を選ぶ
            </button>
            {!refined && (
              <button onClick={() => setPhase('refine')} className={btn}>
                要望を言って描き直す（1回だけ）
              </button>
            )}
            <button onClick={() => onDone({ look: 'stay' })} className={soft}>
              やめて今の姿のまま
            </button>
          </div>
        )}
        {phase === 'confirm' && sel && (
          <div className="mt-3 space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sel.url} alt="" className="mx-auto h-40 w-40 rounded-full object-cover ring-2 ring-sky-200/60" />
            <p className="text-center text-[13px] text-sky-50/80">この姿が、あなたのプロフィールとして表示されます</p>
            <button onClick={() => void choose()} className={btn}>
              この姿にする
            </button>
            <button onClick={() => setPhase('pick')} className={soft}>
              もどる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
