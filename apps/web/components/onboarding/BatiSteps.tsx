'use client';

import { useEffect, useState } from 'react';
import { demoBati, eggSvg } from '@/lib/look';
import { VoiceField } from './StoryExtras';

/** Day 2 on the Moon: the favourite food the Bati is born from (examples from the story, 2026-10-14). */
const FOODS = ['おにぎり', 'カレー', 'いちご', 'ラーメン', 'おすし', 'たこ焼き'];

export function EggStep({ onEgg, submit = 'これにする' }: { onEgg: (food: string) => Promise<void>; submit?: string }) {
  const [food, setFood] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    const f = food.trim();
    if (!f) return;
    setBusy(true);
    setErr(null);
    try {
      await onEgg(f);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/85 to-transparent px-6 pt-20">
      <div className="mx-auto mb-10 flex max-w-sm animate-[fadeUp_0.6s_ease-out] flex-col gap-3">
        <VoiceField value={food} onChange={setFood} placeholder="好きな食べ物" maxLength={30} />
        <div className="flex flex-wrap justify-center gap-1.5">
          {FOODS.map((f) => (
            <button key={f} onClick={() => setFood(f)} className={`rounded-full px-3 py-1 text-xs ${food === f ? 'bg-amber-300 font-bold text-black' : 'bg-white/10 text-white/80'}`}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={go} disabled={!food.trim() || busy} className="rounded-full border border-amber-200/80 bg-gradient-to-b from-amber-200/25 to-amber-500/10 py-3.5 text-lg tracking-widest text-amber-50 disabled:opacity-40">
          {busy ? '……' : submit}
        </button>
        {err && <p className="text-center text-sm text-rose-300">{err}</p>}
      </div>
    </div>
  );
}

/** The egg wobbles and cracks while the Bati is generated, then the newborn appears. */
/**
 * The egg hatches on the last picture of its cracking film (the same film-like egg, QA 5 N28 / QA 6 R9): no second
 * wobble, only the light breathing until {bati} is made, a white flash, and {bati} comes out.
 */
export function HatchStep({ food, egg, onHatch, onDone }: { food: string; egg?: 'sun' | 'earth'; onHatch: () => Promise<string>; onDone: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<'wobble' | 'flash' | 'born'>('wobble');
  useEffect(() => {
    let live = true;
    const started = Date.now();
    onHatch().then((u) => {
      const wait = Math.max(0, 3200 - (Date.now() - started));
      setTimeout(() => {
        if (!live) return;
        setUrl(u || demoBati(food));
        setStage('flash');
        setTimeout(() => live && setStage('born'), 700);
      }, wait);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 overflow-hidden bg-black"
      onClick={() => stage === 'born' && url && onDone(url)}
      disabled={stage !== 'born'}
    >
      {egg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/onboarding/s/d2-egg-${egg}-cracked.jpg`}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover ${stage === 'wobble' ? 'animate-pulse' : 'opacity-50 blur-sm'}`}
          style={{ filter: stage === 'wobble' ? 'drop-shadow(0 0 40px rgba(255,230,180,0.6)) brightness(1.08)' : undefined }}
        />
      )}
      {stage !== 'born' ? (
        egg ? (
          <span className="pointer-events-none absolute left-1/2 top-[42%] h-[30svh] w-[30svh] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-amber-100/25 blur-2xl" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={eggSvg(food)} alt="" className="h-[42svh] w-auto animate-[shake_0.5s_ease-in-out_infinite] drop-shadow-[0_0_40px_rgba(255,230,180,0.6)]" />
        )
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url!} alt="" className="relative h-[42svh] w-auto animate-[spriteIn_0.6s_ease-out] rounded-[2.5rem] shadow-[0_0_60px_rgba(255,220,150,0.6)]" />
      )}
      {stage === 'flash' && <span className="pointer-events-none absolute inset-0 animate-[flash_0.7s_ease-out] bg-white" />}
      <p className={`relative tracking-[0.3em] text-amber-100 [text-shadow:0_0_8px_#000] ${egg && stage !== 'born' ? 'mt-auto mb-[16svh]' : ''}`}>{stage === 'born' ? '生まれた！' : egg ? '光の中で、なにかが動いている……' : 'たまごが動いている……'}</p>
      {stage === 'born' && <p className="animate-pulse text-xs text-white/60">TAP</p>}
    </button>
  );
}
