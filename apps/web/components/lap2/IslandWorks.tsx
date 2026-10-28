'use client';

import { useState } from 'react';
import { MyIsland, islandCards, islandFromWords, islandOmakase, type IslandLook } from '@/components/mercury/MyIsland';
import { VoiceField } from '@/components/onboarding/StoryExtras';

/**
 * L2-MERCURY-S004 (M-R154): 〔🏝️ 島を飾る〕 — a theme island said to {bati} (「どんな曲が流れる島？」; the theme
 * becomes its name) rises next to yours, or your island is decorated; either way {bati} lays the part cards and
 * talking changes them. No mana. The island lives on this device (ISLAND_KEY) until the server keeps my places.
 */
export const ISLAND_KEY = 'obolo.myIsland';
export function saveIsland(l: IslandLook) {
  try {
    localStorage.setItem(ISLAND_KEY, JSON.stringify(l));
  } catch {
    /* private mode */
  }
}
function loadIsland(neo: string): IslandLook {
  try {
    const v = localStorage.getItem(ISLAND_KEY);
    if (v) return JSON.parse(v) as IslandLook;
  } catch {
    /* private mode */
  }
  return islandOmakase(neo);
}
const OMAKASE = ['雨の日の曲だけ', '眠る前の曲', '友達と聴いた曲'];

export function IslandWorks({ mode, neo, bati, onDone }: { mode: 'theme' | 'deco'; neo: string; bati: string; onDone: (a: Record<string, string>) => void }) {
  const [look, setLook] = useState<IslandLook>(() => (mode === 'deco' ? loadIsland(neo) : { ...islandOmakase(`${neo}-theme`), name: '' }));
  const [step, setStep] = useState<'ask' | 'cards' | 'rise'>(mode === 'deco' ? 'cards' : 'ask');
  const [talk, setTalk] = useState('');
  const btn = 'w-full rounded-full border border-sky-200/60 bg-sky-200/15 py-3 text-[14px] font-bold tracking-wider text-sky-50 active:scale-[0.98] disabled:opacity-40';
  const toCards = (theme: string) => {
    setLook((l) => ({ ...islandFromWords(theme, { ...l, palm: false }), name: theme.slice(0, 12) }));
    setTalk('');
    setStep('cards');
  };
  const sky = look.time === 'night' ? 'from-indigo-950 to-sky-800' : look.time === 'dusk' ? 'from-orange-300 to-sky-600' : 'from-sky-300 to-sky-600';
  return (
    <div className="absolute inset-0 z-[12] flex flex-col items-center justify-end bg-[url('/onboarding/s/mercury-port.jpg')] bg-cover bg-center px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className={`mb-3 w-full max-w-sm rounded-3xl bg-gradient-to-b ${sky} px-3 pb-2 pt-5 shadow-2xl`}>
        <MyIsland look={look} rise={step === 'rise' ? 2 : step === 'ask' ? 0 : 2} records={1} width={320} />
      </div>
      <div className="w-full max-w-md space-y-2 rounded-3xl border border-sky-100/25 bg-[#06121c]/90 p-4 text-sky-50">
        {step === 'ask' && (
          <>
            <p className="text-center text-[13px]">どんな曲が流れる島？</p>
            <VoiceField value={talk} onChange={setTalk} placeholder="夜の自転車で聴く曲" maxLength={24} />
            <div className="flex flex-wrap justify-center gap-1.5">
              {OMAKASE.map((o) => (
                <button key={o} onClick={() => toCards(o)} className="rounded-full bg-white/10 px-3 py-1 text-[12px]">
                  {o}
                </button>
              ))}
            </div>
            <button onClick={() => toCards(talk.trim())} disabled={!talk.trim()} className={btn}>
              これで組む
            </button>
            <button onClick={() => onDone({ island: 'none' })} className="w-full py-1.5 text-[12px] text-sky-50/60">
              パス（まだ決めない）
            </button>
          </>
        )}
        {step === 'cards' && (
          <>
            <p className="text-center text-[12px] text-sky-50/70">{bati}「じゃあ、こんな感じかな！」</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {islandCards(look).map((c) => (
                <span key={c} className="rounded-md bg-sky-50 px-2 py-0.5 text-[12px] font-bold text-sky-800">
                  〈{c}〉
                </span>
              ))}
            </div>
            <VoiceField value={talk} onChange={setTalk} placeholder="もっと、夜っぽく" maxLength={30} />
            <button
              onClick={() => {
                setLook((l) => islandFromWords(talk, l));
                setTalk('');
              }}
              disabled={!talk.trim()}
              className={btn}
            >
              話して変える
            </button>
            <VoiceField value={look.name} onChange={(t) => setLook((x) => ({ ...x, name: t.slice(0, 12) }))} placeholder="島の名前（なくてもいい）" maxLength={12} />
            <button
              onClick={() => {
                if (mode === 'deco') saveIsland(look);
                setStep('rise');
                setTimeout(() => onDone(mode === 'theme' ? { island: 'theme', island_name: look.name || 'none', island_parts: islandCards(look).join('|') } : { island: 'deco', island_parts: islandCards(look).join('|') }), 2600);
              }}
              className={btn}
            >
              {mode === 'theme' ? 'この島にする' : '飾る'}
            </button>
            <p className="text-center text-[11px] text-sky-50/50">マナは使いません。あとで変えられます</p>
          </>
        )}
        {step === 'rise' && <p className="animate-pulse text-center text-[13px]">{mode === 'theme' ? 'ごごご……。小さな島が、せり上がる' : '島が、札のとおりに組み変わる'}</p>}
      </div>
    </div>
  );
}
