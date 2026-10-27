'use client';

import { PLAZA_ICONS } from '@obolo/shared';
import { useState } from 'react';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { getApi } from '@/lib/api';

/**
 * Your own ひろば (L2-SATURN-S004): 〔＋ ひろばをつくる〕 → what is talked about there (said aloud; the words
 * become the sign — 〔おまかせ〕 / 〔パス〕) → 〔ひろばのしるし〕 and who may come in → 〔このひろばをつくる〕.
 * At first only 〔わたしだけ〕; a ひろば for approved dachi needs its promises set first, so it waits.
 */
const OMAKASE = ['好きな食べ物の話', 'きのう見た夢の話', '何も話さない場所'];
type Phase = 'choose' | 'name' | 'sign' | 'made';

export function PlazaMaker({ onDone }: { onDone: (a: Record<string, string>) => void }) {
  const [phase, setPhase] = useState<Phase>('choose');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<(typeof PLAZA_ICONS)[number]>(PLAZA_ICONS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const make = async () => {
    setBusy(true);
    setErr(null);
    try {
      await getApi().createPlaza({ name: name.trim().slice(0, 20), icon, access: 'me' });
      setPhase('made');
    } catch {
      setErr('その名前では、作れなかった……。ちがう言葉で、もう一度');
    }
    setBusy(false);
  };
  const btn = 'w-full rounded-full border border-pink-200/50 bg-pink-200/10 py-3 text-[14px] tracking-wider active:scale-[0.98] disabled:opacity-40';
  const soft = 'w-full py-2 text-[13px] text-pink-50/60';
  return (
    <div className="absolute inset-0 z-[12] flex items-end justify-center bg-black/55 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md animate-[fadeUp_0.5s_ease-out] rounded-3xl border border-pink-100/25 bg-[#160b14]/95 p-5 text-pink-50">
        <p className="text-center text-[15px] font-bold tracking-wider">＋ ひろばをつくる</p>
        {phase === 'choose' && (
          <div className="mt-4 space-y-2">
            <button onClick={() => setPhase('name')} className={btn}>
              広場を作る
            </button>
            <button onClick={() => onDone({ plaza: 'later' })} className={soft}>
              今はいい
            </button>
          </div>
        )}
        {phase === 'name' && (
          <div className="mt-3 space-y-3">
            <p className="text-center text-[13px] text-pink-50/75">どんな話をする場所？（言ったことが、そのまま看板の名前になります。あとから変えられます）</p>
            <VoiceField value={name} onChange={setName} placeholder="好きな食べ物の話" maxLength={20} />
            <button onClick={() => setName(OMAKASE[Math.floor(Math.random() * OMAKASE.length)])} className="mx-auto block rounded-full bg-white/10 px-4 py-1.5 text-[12px]">
              おまかせ
            </button>
            <p className="text-center text-[12px] text-pink-50/60">たこ焼きシスター「最初は自分だけでもいい。誰かを迎えるのは、あとで決めましょう。」</p>
            <button onClick={() => setPhase('sign')} disabled={!name.trim()} className={btn}>
              次へ
            </button>
            <button onClick={() => onDone({ plaza: 'later' })} className={soft}>
              パス（まだ決めない）
            </button>
          </div>
        )}
        {phase === 'sign' && (
          <div className="mt-3 space-y-3">
            <p className="text-center text-[13px]">『{name}』</p>
            <p className="text-center text-[12px] text-pink-50/70">ひろばのしるし</p>
            <div className="flex flex-wrap justify-center gap-2">
              {PLAZA_ICONS.map((i) => (
                <button key={i} onClick={() => setIcon(i)} className={`h-10 w-10 rounded-full text-xl ${icon === i ? 'bg-pink-300/40 ring-2 ring-pink-200' : 'bg-white/10'}`}>
                  {i}
                </button>
              ))}
            </div>
            <p className="text-center text-[12px] text-pink-50/70">入れる人</p>
            <div className="flex gap-2">
              <span className="flex-1 rounded-2xl bg-pink-300/30 py-2 text-center text-[13px] ring-2 ring-pink-200">わたしだけ</span>
              <span className="flex-1 rounded-2xl bg-white/5 py-2 text-center text-[12px] text-pink-50/40">承認した人（あとで）</span>
            </div>
            {err && <p className="text-center text-[12px] text-pink-200/80">{err}</p>}
            <button onClick={() => void make()} disabled={busy} className={btn}>
              このひろばをつくる
            </button>
            <button onClick={() => onDone({ plaza: 'later' })} className={soft}>
              もどる
            </button>
          </div>
        )}
        {phase === 'made' && (
          <div className="mt-3 space-y-3 text-center">
            <p className="text-3xl">{icon}</p>
            <p className="text-[14px]">『{name}』</p>
            <p className="text-[12px] text-pink-50/70">入れる人：わたしだけ</p>
            <p className="text-[12px] leading-relaxed text-pink-50/60">自分の広場では、〔🎙 この広場でつぶやく〕で、コロリンを置けます。入れる人をしぼった広場のコロリンは、〔推し〕には入りません</p>
            <button onClick={() => onDone({ plaza: 'make' })} className={btn}>
              つぎへ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
