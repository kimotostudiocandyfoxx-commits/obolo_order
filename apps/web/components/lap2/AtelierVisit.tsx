'use client';

import { useState } from 'react';
import { MyAtelier, ATELIER_DEFAULT, atelierCards, atelierFromWords, type AtelierLook } from '@/components/jupiter/MyAtelier';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import type { StickerMade } from '@/lib/onboarding/made';

/**
 * L2-JUPITER-S005 ダチのアトリエを訪ねる (M-R156): KIMORIN⭐︎'s showy atelier (the sign cut at eight letters:
 * 『宇宙一の天才発明』), the visitor's own (the first journey's art on the wall), and 〔🎨 アトリエを飾る〕 — the part
 * cards changed by talking to {bati} and the sign by voice; 〔飾る〕 saves, 〔やめる〕 keeps what was chosen.
 * The atelier lives on this device (ATELIER_KEY) until the server keeps my places.
 */
export const ATELIER_KEY = 'obolo.myAtelier';
export function loadAtelier(): AtelierLook {
  try {
    return { ...ATELIER_DEFAULT, ...(JSON.parse(localStorage.getItem(ATELIER_KEY) ?? '{}') as Partial<AtelierLook>) };
  } catch {
    return ATELIER_DEFAULT;
  }
}
export function saveAtelier(l: AtelierLook) {
  try {
    localStorage.setItem(ATELIER_KEY, JSON.stringify(l));
  } catch {
    /* private mode */
  }
}

const KIMORIN_LOOK: AtelierLook = { wood: 'amber', glass: 'pink', light: 'neon', time: 'dusk', deck: true, ball: true, sign: '宇宙一の天才発明' };
const DRAGON: StickerMade = { text: '', url: '/onboarding/s/kimorin-dragon.jpg' };
const PURIPURI: StickerMade = { text: '', url: '/onboarding/s/jacket-puripuri.jpg' };

export function AtelierVisit({ who, arts = [], neo, bati, onDone }: { who: 'kimorin' | 'mine' | 'deco'; arts?: StickerMade[]; neo: string; bati: string; onDone: (a: Record<string, string>) => void }) {
  const [look, setLook] = useState<AtelierLook>(() => (who === 'kimorin' ? KIMORIN_LOOK : loadAtelier()));
  const [said, setSaid] = useState('');
  const btn = 'w-full rounded-full border border-amber-200/60 bg-amber-200/15 py-3 text-[14px] font-bold tracking-wider text-amber-50 active:scale-[0.98] disabled:opacity-40';
  return (
    <div className="absolute inset-0 z-[12] flex flex-col items-center justify-end bg-[url('/onboarding/s/jupiter-forest.jpg')] bg-cover bg-center px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className="mb-3 flex flex-col items-center">
        <MyAtelier look={look} arts={who === 'kimorin' ? [DRAGON, DRAGON, DRAGON, PURIPURI] : arts} width={300} />
        <span className="-mt-1 rounded bg-[#f6ead2] px-2 py-0.5 text-[12px] font-bold text-stone-700 shadow">{who === 'kimorin' ? 'KIMORIN⭐︎' : neo}</span>
      </div>
      {who !== 'deco' ? (
        <div className="w-full max-w-md">
          <button onClick={() => onDone({})} className={btn}>
            つぎへ
          </button>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-2 rounded-3xl border border-amber-100/25 bg-[#1a120a]/90 p-4 text-amber-50">
          <p className="text-center text-[14px] font-bold">🎨 アトリエを飾る</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {atelierCards(look).map((c) => (
              <span key={c} className="rounded-md bg-amber-50 px-2 py-0.5 text-[12px] font-bold text-amber-800">
                〈{c}〉
              </span>
            ))}
          </div>
          <p className="text-center text-[11px] text-amber-50/60">{bati}に、変えたいところを話してね</p>
          <VoiceField value={said} onChange={setSaid} placeholder="もっと、明るく" maxLength={40} />
          <button
            disabled={!said.trim()}
            onClick={() => {
              setLook((l) => atelierFromWords(said, l));
              setSaid('');
            }}
            className={btn}
          >
            札を変える
          </button>
          <VoiceField value={look.sign} onChange={(t) => setLook((x) => ({ ...x, sign: [...t].slice(0, 8).join('') }))} placeholder="入口の看板（8文字まで）" maxLength={8} />
          <button
            onClick={() => {
              saveAtelier(look);
              onDone({ tree: 'deco' });
            }}
            className={btn}
          >
            飾る
          </button>
          <button onClick={() => onDone({ tree: 'keep' })} className="w-full py-2 text-[13px] text-amber-50/60">
            やめる
          </button>
        </div>
      )}
    </div>
  );
}
