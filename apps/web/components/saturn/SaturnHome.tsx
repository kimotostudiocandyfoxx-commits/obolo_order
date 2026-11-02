'use client';

import { useEffect, useState } from 'react';
import type { SaturnPostView } from '@obolo/shared';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { KororinVessels, type Kororin } from './KororinVessels';
import { KororinWorld } from './KororinWorld';

/**
 * /saturn on the first and second journey (story chat 2026-11-02, after the planets' review): it opens on your own
 * vessel in the temple hall — your kororins with their dates, a tap sings one, a flick up sends it to the plaza.
 * The plaza (the voices of your dachi and the people you 推し) is behind 〔🪐 広場〕; 〔🎙 つぶやく〕 drops a new
 * voice from there. Nothing of strangers on the first screen.
 */
export function SaturnHome() {
  const { me } = useAuth();
  const [where, setWhere] = useState<'vessel' | 'plaza'>('vessel');
  const [drop, setDrop] = useState(0);
  const [mine, setMine] = useState<Kororin[]>([]);
  const [singing, setSinging] = useState<string | null>(null);
  useEffect(() => {
    if (!me) return;
    getApi()
      .saturnUserPosts(me.id)
      .then((p) => setMine(p.items.filter((x) => !x.replyToId).slice(0, 24).map((x) => toKororin(x))))
      .catch(() => setMine([]));
  }, [me]);
  const sing = (k: Kororin) => {
    if (!k.url) return;
    setSinging(k.id);
    const a = new Audio(k.url);
    a.onended = () => setSinging(null);
    a.onerror = () => setSinging(null);
    void a.play().catch(() => setSinging(null));
  };
  const neo = me?.displayName ?? '';
  return (
    <div className="relative h-full">
      {where === 'plaza' ? (
        <KororinWorld key={drop} hostBar openComposer={drop > 0} />
      ) : (
        <KororinVessels
          scene="hall"
          own
          kimorin={[]}
          mine={mine}
          neo={neo}
          plaza={[]}
          singingId={singing}
          highlightId={null}
          partyOn={!!singing}
          flickable
          oh={false}
          onTap={sing}
          onFlick={() => setWhere('plaza')}
          overlay={
            !mine.length ? (
              <p className="pointer-events-none absolute inset-x-8 top-[38%] rounded-2xl bg-black/45 px-4 py-3 text-center text-sm font-bold text-white/90 backdrop-blur">
                まだ、器はからっぽ。〔🎙 つぶやく〕で、最初のコロリンを
              </p>
            ) : null
          }
        />
      )}
      {/* the three ways, said plainly (〔ゆらす〕〔おまかせ〕 did not tell what they did) */}
      <div className="pb-safe absolute inset-x-0 bottom-0 z-[90] flex justify-center px-4 pb-4">
        <div className="flex items-center gap-1 rounded-[30px] bg-white/95 px-2 py-2 shadow-[0_8px_30px_rgba(80,30,130,.25)]">
          <button onClick={() => setWhere('plaza')} className={`flex h-12 w-20 flex-col items-center justify-center rounded-2xl text-[12px] font-black ${where === 'plaza' ? 'bg-violet-100 text-violet-700' : 'text-[#6b5a8a]'}`}>
            <span className="text-lg leading-none">🪐</span>広場
          </button>
          <button
            onClick={() => {
              setWhere('plaza');
              setDrop((d) => d + 1);
            }}
            className="flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[#f39bd0] to-[#c3a2ff] px-6 text-base font-black text-white shadow-[0_4px_0_rgba(160,90,200,.35)]"
          >
            🎙 つぶやく
          </button>
          <button onClick={() => setWhere('vessel')} className={`flex h-12 w-20 flex-col items-center justify-center rounded-2xl text-[12px] font-black ${where === 'vessel' ? 'bg-violet-100 text-violet-700' : 'text-[#6b5a8a]'}`}>
            <span className="text-lg leading-none">🥣</span>器
          </button>
        </div>
      </div>
    </div>
  );
}

function toKororin(p: SaturnPostView): Kororin {
  return { id: p.id, owner: 'mine', name: p.author.displayName, pic: null, seed: p.author.displayName, text: p.text, url: p.voiceUrl, at: Date.parse(p.createdAt) };
}
