'use client';

import { useEffect, useState } from 'react';
import { demoBati, eggSvg } from '@/lib/look';

/** Day 3: the favourite food the Bati egg is made from (client decision 2026-10-05). */
const FOODS = ['ラーメン', 'カレー', 'おすし', 'ケーキ', 'たこ焼き', 'おにぎり'];

export function EggStep({ onEgg }: { onEgg: (food: string) => Promise<void> }) {
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
        <input
          className="rounded-full border border-amber-200/60 bg-black/60 px-6 py-3.5 text-center tracking-widest text-amber-50 outline-none placeholder:text-white/35"
          style={{ fontSize: 18 }}
          maxLength={30}
          placeholder="好きな食べ物"
          value={food}
          onChange={(e) => setFood(e.target.value)}
        />
        <div className="flex flex-wrap justify-center gap-1.5">
          {FOODS.map((f) => (
            <button key={f} onClick={() => setFood(f)} className={`rounded-full px-3 py-1 text-xs ${food === f ? 'bg-amber-300 font-bold text-black' : 'bg-white/10 text-white/80'}`}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={go} disabled={!food.trim() || busy} className="rounded-full border border-amber-200/80 bg-gradient-to-b from-amber-200/25 to-amber-500/10 py-3.5 text-lg tracking-widest text-amber-50 disabled:opacity-40">
          {busy ? '……' : 'たまごを受け取る'}
        </button>
        {err && <p className="text-center text-sm text-rose-300">{err}</p>}
      </div>
    </div>
  );
}

/** Day 4: the egg wobbles and cracks while the Bati is generated, then the newborn appears. */
export function HatchStep({ food, onHatch, onDone }: { food: string; onHatch: () => Promise<string>; onDone: (url: string) => void }) {
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
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/40"
      onClick={() => stage === 'born' && url && onDone(url)}
      disabled={stage !== 'born'}
    >
      {stage !== 'born' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={eggSvg(food)} alt="" className="h-[42svh] w-auto animate-[shake_0.5s_ease-in-out_infinite] drop-shadow-[0_0_40px_rgba(255,230,180,0.6)]" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url!} alt="" className="h-[42svh] w-auto animate-[spriteIn_0.6s_ease-out] rounded-[2.5rem] shadow-[0_0_60px_rgba(255,220,150,0.6)]" />
      )}
      {stage === 'flash' && <span className="pointer-events-none absolute inset-0 animate-[flash_0.7s_ease-out] bg-white" />}
      <p className="tracking-[0.3em] text-amber-100">{stage === 'born' ? '生まれた！' : 'たまごが動いている……'}</p>
      {stage === 'born' && <p className="animate-pulse text-xs text-white/60">TAP</p>}
    </button>
  );
}
