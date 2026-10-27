'use client';

import { useEffect, useState } from 'react';

/**
 * 『キモリンの帰り道』 (L2-NEPTUNE-S002), the order's own game on the model-town island. The little KIMORIN
 * walks from the order's gate; at the fork the glowing roads are tapped (or 〔おまかせで進む〕 — Bati picks,
 * and a tap takes it back). Each road has its small happening, and the story told to grandpa changes with it.
 * No time limit, score, winning or counts. `watch`: KIMORIN moves himself, the visitor only picks the road.
 */
type Road = 'slope' | 'river' | 'tako';
const ROADS: { id: Road; sign: string; x: number; y: number; scene: string; talk: string }[] = [
  { id: 'slope', sign: '←坂の道', x: 18, y: 38, scene: '細い坂のまん中に、猫が寝ている。しゃがんで、待つ。……猫があくびして、どいた', talk: '坂の猫' },
  { id: 'tako', sign: 'まっすぐ：たこ焼き屋の前', x: 50, y: 26, scene: 'たこ焼き屋の前。店主が、一個おまけしてくれた', talk: 'おまけのたこ焼き' },
  { id: 'river', sign: '川の道→', x: 82, y: 38, scene: '橋のまん中。川面に、夕日がゆれている。しばらく、立ち止まって見た', talk: '川の夕日' },
];
type Phase = 'gate' | 'fork' | 'walk' | 'home' | 'end';

export function HomewardGame({ watch, onDone }: { watch: boolean; onDone: (a: Record<string, string>) => void }) {
  const [phase, setPhase] = useState<Phase>('gate');
  const [road, setRoad] = useState<(typeof ROADS)[number] | null>(null);
  const [auto, setAuto] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 86 });
  useEffect(() => {
    if (phase === 'gate') {
      setPos({ x: 50, y: 62 });
      const t = setTimeout(() => setPhase('fork'), 1600);
      return () => clearTimeout(t);
    }
    if (phase === 'fork' && auto) {
      const t = setTimeout(() => go(ROADS[Math.floor(Math.random() * ROADS.length)]), 1400);
      return () => clearTimeout(t);
    }
    if (phase === 'walk' && road) {
      setPos({ x: road.x, y: road.y });
      const t = setTimeout(() => {
        setPos({ x: 50, y: 10 });
      }, 3200);
      const u = setTimeout(() => setPhase('home'), 4600);
      return () => {
        clearTimeout(t);
        clearTimeout(u);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, auto]);
  const go = (r: (typeof ROADS)[number]) => {
    if (phase !== 'fork') return;
    setRoad(r);
    setPhase('walk');
  };
  return (
    <div className="absolute inset-0 z-[12] flex flex-col bg-[#0a1630]">
      <div className="pt-safe px-14 pt-3 text-center">
        <p className="text-[11px] tracking-[0.3em] text-sky-200/60">キモリンの帰り道</p>
        <p className="mt-1 text-[14px] text-sky-50">じいちゃんに、土産話を届けよう</p>
      </div>
      {/* the model town, seen from above */}
      <div className="relative mx-4 mt-3 flex-1 overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_50%_40%,#3a6a4a,#1e3a2a)] ring-1 ring-white/10">
        {/* roads */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path d="M50 92 L50 62" stroke="#d8c8a0" strokeWidth="5" fill="none" />
          {ROADS.map((r) => (
            <path key={r.id} d={`M50 62 Q${(50 + r.x) / 2} ${r.y + 14} ${r.x} ${r.y} Q${(50 + r.x) / 2} ${r.y - 18} 50 10`} stroke={phase === 'fork' ? '#ffe9a0' : '#d8c8a0'} strokeWidth={phase === 'fork' ? 4.5 : 3.5} fill="none" opacity={road && road.id !== r.id ? 0.35 : 1} />
          ))}
          <path d="M70 0 Q78 40 100 52" stroke="#5aa8d8" strokeWidth="6" fill="none" opacity="0.8" />
        </svg>
        <span className="absolute left-1/2 top-[3%] -translate-x-1/2 text-2xl">🏠</span>
        <span className="absolute bottom-[2%] left-1/2 -translate-x-1/2 text-2xl">⛩️</span>
        <span className="absolute left-[44%] top-[20%] text-lg">🏮</span>
        {phase === 'fork' &&
          ROADS.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setAuto(false);
                go(r);
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 animate-[hintGlow_2.2s_ease-in-out_infinite] rounded-full bg-amber-100/90 px-2.5 py-1 text-[11px] font-bold text-amber-900 shadow"
              style={{ left: `${r.x}%`, top: `${r.y}%` }}
            >
              {r.sign}
            </button>
          ))}
        {/* the little KIMORIN */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/story/avatars/kimorin.webp"
          alt=""
          className="absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/70 transition-all duration-[1500ms] ease-in-out"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        />
      </div>
      <div className="pb-safe px-4 pb-5 pt-3">
        {phase === 'fork' && (
          <div className="space-y-2 text-center">
            <p className="text-[12px] text-sky-100/70">{watch ? 'KIMORINが、分かれ道で止まった。光っている道を選んでね' : '光っている道をタップすると進みます'}</p>
            <button onClick={() => setAuto((a) => !a)} className="w-full rounded-full border border-sky-200/40 py-2.5 text-[13px] text-sky-50">
              {auto ? 'バティが選んでいる……（タップで自分に戻す）' : 'おまかせで進む'}
            </button>
          </div>
        )}
        {phase === 'walk' && road && <p className="min-h-[3em] animate-[fadeUp_0.5s_ease-out] text-center text-[13px] leading-relaxed text-sky-50">{road.scene}</p>}
        {phase === 'home' && road && (
          <div className="animate-[fadeUp_0.5s_ease-out] space-y-2 text-[14px] leading-relaxed text-sky-50">
            <p>
              <span className="mr-1 text-[11px] text-sky-200/70">じいちゃん</span>おかえり。で、どこから話す？
            </p>
            <p>
              <span className="mr-1 text-[11px] text-sky-200/70">KIMORIN</span>
              {road.talk}の話から！
            </p>
            <button onClick={() => setPhase('end')} className="mt-2 w-full rounded-full border border-sky-200/50 bg-sky-200/10 py-3 text-[14px]">
              つぎへ
            </button>
          </div>
        )}
        {phase === 'end' && (
          <div className="space-y-2 text-center">
            <p className="text-[15px] tracking-[0.3em] text-sky-50">おわり</p>
            <button onClick={() => onDone({ road: road?.id ?? 'slope' })} className="w-full rounded-full border border-sky-200/50 bg-sky-200/10 py-3 text-[14px]">
              つぎへ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
