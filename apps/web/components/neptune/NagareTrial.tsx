'use client';

import { useEffect, useRef, useState } from 'react';
import { NeoButterfly } from '@/components/jupiter/NeoButterfly';

/**
 * L2-NEPTUNE-S002 『ナガレを越えて』体験版 (M-R160/M-R161/M-R163): the map of six star squares, then the first two
 * stages. The hero is {neo} made small and round.
 * - 土星: a grey storm throws word-stones (〈次〉〈まだ見てるの？〉…) at little {neo}; tapping {neo}'s kororin makes it sing,
 *   and the stones near it come apart into grains of light. Enough of them gone → クリア.
 * - 木星: {neo}'s butterfly carries little {neo} over a deep valley under {neo}'s own art; each tap is a flap; a stone
 *   that hits makes it spin down onto the rock just behind, and it goes on from there. The dachi wave flags at the far
 *   edge → クリア.
 * No timer, no score, no losing: only クリア is shown. Nothing is kept but the stage cleared.
 */
const WORDS = ['次', '次', 'まだ見てるの？', 'あの人みたいに', 'はやく', 'それだけ？', '次'];
const SQUARES = ['土星', '木星', '水星', '火星', '天王星', '金星'];

let ctx: AudioContext | null = null;
function sing() {
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    [523, 659, 784, 988, 784].forEach((f, k) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t + k * 0.12);
      g.gain.linearRampToValueAtTime(0.12, t + k * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + k * 0.12 + 0.3);
      o.connect(g).connect(ctx!.destination);
      o.start(t + k * 0.12);
      o.stop(t + k * 0.12 + 0.32);
    });
  } catch {
    /* no sound here */
  }
}

/** little {neo}: the chibi picture, or the round face, or a star */
function Mini({ face, size = 48 }: { face?: string; size?: number }) {
  return face ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={face} alt="" className="rounded-full border-2 border-white object-cover object-top shadow-lg" style={{ width: size, height: size }} />
  ) : (
    <span className="flex items-center justify-center rounded-full border-2 border-white bg-amber-200 shadow-lg" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      ✦
    </span>
  );
}

/** {neo}'s kororin: a round takoyaki with sunglasses (they drop onto its eyes while it sings) */
function Kororin({ singing, size = 56 }: { singing: boolean; size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-amber-500 to-amber-800 shadow-[inset_0_-6px_10px_rgba(0,0,0,0.35)]" />
      <div className="absolute inset-x-[18%] top-[22%] h-[14%] rounded-full bg-[#3b2316] opacity-80" />
      <svg viewBox="0 0 100 40" className="absolute left-[14%] w-[72%] transition-all duration-200" style={{ top: singing ? '36%' : '6%' }}>
        <circle cx="27" cy="20" r="15" fill="#120d18" stroke="#ffd36f" strokeWidth="4" />
        <circle cx="73" cy="20" r="15" fill="#120d18" stroke="#ffd36f" strokeWidth="4" />
        <path d="M42 18 Q50 13 58 18" fill="none" stroke="#ffd36f" strokeWidth="4" />
      </svg>
      <span className="absolute -top-2 left-1/2 h-4 w-1 -translate-x-1/2 rounded bg-amber-100" />
      {singing && <span className="absolute -right-3 -top-3 animate-bounce text-lg">♪</span>}
    </div>
  );
}

type Stone = { id: number; text: string; x: number; y: number; vx: number; vy: number; gone?: number };

function SaturnStage({ face, onClear }: { face?: string; onClear: () => void }) {
  // the simulation lives in refs (an updater with side effects runs twice in development); each frame is drawn from it
  const sim = useRef({ stones: [] as Stone[], freed: 0, spawn: 0, seq: 0, done: false });
  const [, draw] = useState(0);
  const [singing, setSinging] = useState(false);
  const [hint, setHint] = useState(true);
  const NEED = 8;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const m = sim.current;
      m.spawn -= dt;
      m.stones = m.stones
        .map((s) => (s.gone !== undefined ? { ...s, gone: s.gone + dt } : { ...s, x: s.x + s.vx * dt, y: s.y + s.vy * dt }))
        // a stone that reaches little {neo} just bumps and drops away (no losing)
        .filter((s) => (s.gone ?? 0) < 0.8 && Math.hypot(s.x - 50, s.y - 58) > 6);
      if (m.spawn <= 0 && m.stones.length < 6) {
        m.spawn = 1.1;
        const a = Math.random() * Math.PI * 2;
        const x = 50 + Math.cos(a) * 60;
        const y = 58 + Math.sin(a) * 60;
        m.seq++;
        m.stones.push({ id: m.seq, text: WORDS[m.seq % WORDS.length], x, y, vx: (50 - x) / 7, vy: (58 - y) / 7 });
      }
      if (m.freed >= NEED && !m.done) {
        m.done = true;
        setTimeout(onClear, 900);
      }
      draw((n) => n + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onClear]);
  const tap = () => {
    setHint(false);
    setSinging(true);
    sing();
    setTimeout(() => setSinging(false), 700);
    // the song: every stone in reach comes apart into light, one letter at a time
    const m = sim.current;
    m.stones = m.stones.map((s) => (s.gone === undefined && Math.hypot(s.x - 50, s.y - 58) < 38 ? (m.freed++, { ...s, gone: 0 }) : s));
  };
  const { stones, freed } = sim.current;
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#2a2238] via-[#6b4a3a] to-[#c27a4a]">
      <div className="absolute inset-0 animate-[spin_30s_linear_infinite] opacity-30" style={{ background: 'conic-gradient(from 0deg, transparent, #9aa 20%, transparent 40%, #889 60%, transparent 80%)' }} />
      {stones.map((s) => (
        <span
          key={s.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-stone-500/90 px-2 py-0.5 text-[12px] font-bold text-stone-100 shadow transition-opacity"
          style={{ left: `${s.x}%`, top: `${s.y}%`, opacity: s.gone !== undefined ? 1 - s.gone / 0.8 : 1, filter: s.gone !== undefined ? `blur(${s.gone * 4}px) brightness(${1 + s.gone * 3})` : undefined, letterSpacing: s.gone !== undefined ? `${s.gone * 12}px` : undefined }}
        >
          〈{s.text}〉
        </span>
      ))}
      <div className="absolute left-1/2 top-[58%] flex -translate-x-1/2 -translate-y-1/2 items-end gap-2">
        <Mini face={face} size={52} />
        <button onClick={tap} aria-label="コロリン" className="active:scale-95">
          <Kororin singing={singing} />
        </button>
      </div>
      <div className="absolute inset-x-0 top-[calc(14px+env(safe-area-inset-top))] text-center text-[12px] text-white/80">土星｜{hint ? 'コロリンをタップすると、歌います' : '　'}</div>
      <div className="absolute inset-x-10 bottom-[calc(24px+env(safe-area-inset-bottom))] h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full bg-amber-200 transition-all" style={{ width: `${Math.min(100, (freed / NEED) * 100)}%` }} />
      </div>
    </div>
  );
}

function JupiterStage({ face, art, onClear }: { face?: string; art?: string | null; onClear: () => void }) {
  // the butterfly flies right on its own; a tap is a flap up; gravity pulls down; the far edge is 100
  const sim = useRef({ x: 6, y: 50, vy: 0, spin: 0, stones: [] as Stone[], rock: 6, spawn: 1.5, seq: 0, done: false });
  const [, draw] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const m = sim.current;
      if (!m.done) {
        m.spawn -= dt;
        m.stones = m.stones.map((o) => ({ ...o, x: o.x + o.vx * dt })).filter((o) => o.x > -10);
        if (m.spin > 0) {
          // hit: spin down onto the rock just behind, then go on from there
          m.spin -= dt;
          m.y += (62 - m.y) * dt * 3;
          if (m.spin <= 0) {
            m.x = m.rock;
            m.y = 50;
            m.vy = 0;
          }
        } else {
          m.x += 7 * dt;
          m.vy += 46 * dt;
          m.y = Math.max(8, Math.min(78, m.y + m.vy * dt));
          if (m.y >= 78) m.vy = -10;
          if (Math.floor(m.x / 20) * 20 > m.rock) m.rock = Math.floor(m.x / 20) * 20;
          if (m.stones.some((o) => Math.abs(o.x - 18) < 6 && Math.abs(o.y - m.y) < 7)) {
            m.spin = 0.9;
            m.stones = [];
          }
        }
        if (m.spawn <= 0) {
          m.spawn = 1.8;
          m.seq++;
          m.stones.push({ id: m.seq, text: WORDS[m.seq % WORDS.length], x: 110, y: 15 + Math.random() * 60, vx: -26, vy: 0 });
        }
        if (m.x >= 100) {
          m.done = true;
          setTimeout(onClear, 1600);
        }
      }
      draw((n) => n + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onClear]);
  const st = sim.current;
  const flap = () => {
    if (sim.current.spin <= 0) sim.current.vy = -26;
  };
  const end = st.x >= 100;
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-indigo-900 to-amber-700" onPointerDown={flap}>
      {art && (
        // {neo}'s art spread over the whole sky behind
        // eslint-disable-next-line @next/next/no-img-element
        <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      )}
      {/* the valley, moving by as the butterfly goes */}
      <div className="absolute inset-x-0 bottom-0 h-[16%] bg-gradient-to-t from-black to-transparent" />
      {[0, 20, 40, 60, 80].map((r) => (
        <div key={r} className="absolute bottom-[8%] h-[14%] w-[16%] rounded-t-[40%] bg-stone-700/90" style={{ left: `${18 + (r - st.x) * 3}%` }} />
      ))}
      {/* the far cliff and the dachi waving flags */}
      <div className="absolute bottom-0 h-[40%] w-[40%] rounded-tl-[30%] bg-stone-800/95 transition-all" style={{ left: `${18 + (100 - st.x) * 3}%` }}>
        <div className="absolute -top-10 left-4 flex gap-3">
          <span className="animate-bounce text-xl">🚩</span>
          <span className="animate-bounce text-xl" style={{ animationDelay: '0.2s' }}>
            🕶️
          </span>
          <span className="animate-bounce text-xl" style={{ animationDelay: '0.4s' }}>
            🚩
          </span>
        </div>
      </div>
      {st.stones.map((o) => (
        <span key={o.id} className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-stone-500/90 px-2 py-0.5 text-[12px] font-bold text-stone-100" style={{ left: `${18 + (o.x - 18)}%`, top: `${o.y}%` }}>
          〈{o.text}〉
        </span>
      ))}
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: '18%', top: `${st.y}%`, transform: `translate(-50%,-50%) rotate(${st.spin > 0 ? st.spin * 720 : 0}deg)` }}>
        <NeoButterfly face={face} size={74} flap={st.spin <= 0} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[calc(14px+env(safe-area-inset-top))] text-center text-[12px] text-white/85">木星｜タップするたびに、羽ばたいて高く上がる</div>
      <div className="pointer-events-none absolute inset-x-10 bottom-[calc(24px+env(safe-area-inset-bottom))] h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full bg-amber-200" style={{ width: `${Math.min(100, st.x)}%` }} />
      </div>
      {end && <p className="absolute inset-x-0 top-[40%] text-center text-[13px] text-white">谷の向こうで、ダチの小さな姿が、旗を振っている</p>}
    </div>
  );
}

export function NagareTrial({ face, art, neo, onDone }: { face?: string; art?: string | null; neo: string; onDone: (a: Record<string, string>) => void }) {
  const [phase, setPhase] = useState<'map' | 'saturn' | 'clear1' | 'jupiter' | 'clear2' | 'end'>('map');
  const [cleared, setCleared] = useState<string>('none');
  const btn = 'w-full rounded-full border border-cyan-200/60 bg-cyan-200/15 py-3 text-[14px] font-bold tracking-wider text-cyan-50 active:scale-[0.98]';
  const Map = ({ at, flag }: { at: number; flag?: boolean }) => (
    <div className="relative mx-auto mt-4 h-[46svh] w-full max-w-sm overflow-hidden rounded-3xl border border-cyan-200/30 bg-[#061a2e] p-4">
      <div className="absolute inset-[-40%] animate-[spin_40s_linear_infinite] opacity-20" style={{ background: 'conic-gradient(#888, transparent, #888, transparent)' }} />
      <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full">
        <path d="M40 250 C 90 220, 60 160, 120 150 S 220 120, 200 70 S 120 40, 250 30" fill="none" stroke="#7dd3fc" strokeWidth="3" strokeDasharray="6 8" opacity={0.6} />
      </svg>
      {SQUARES.map((sq, k) => {
        const pos = [
          [12, 82],
          [38, 50],
          [62, 46],
          [66, 24],
          [44, 14],
          [82, 10],
        ][k];
        const covered = k >= 2;
        return (
          <div key={sq} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${pos[0]}%`, top: `${pos[1]}%` }}>
            <span className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${covered ? 'bg-stone-700/80 text-stone-400' : 'bg-amber-300 text-amber-950'}`}>{covered ? '▦' : '★'}</span>
            <span className="text-[10px] text-cyan-50/70">{sq}</span>
            {k === at && (
              <span className="absolute -top-9 left-1/2 -translate-x-1/2 animate-bounce">
                <Mini face={face} size={30} />
              </span>
            )}
            {flag && k === 1 && <span className="absolute -right-2 -top-3 text-lg">🚩</span>}
          </div>
        );
      })}
    </div>
  );
  return (
    <div className="absolute inset-0 z-[12] bg-[#020b16] text-cyan-50">
      {phase === 'map' && (
        <div className="flex h-full flex-col justify-end px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
          <Map at={0} />
          <div className="mt-4 space-y-2 rounded-3xl bg-black/50 p-4 text-center">
            <p className="text-[14px] font-bold">『ナガレを越えて』体験版</p>
            <p className="text-[12px] leading-relaxed text-cyan-50/70">いま遊べるのは、はじめの2ステージ（土星・木星）です。主人公は、{neo}の小さな姿。1ステージ1〜2分。失敗しても、その場からやり直せます。結果は「クリア」だけが出ます</p>
            <button onClick={() => setPhase('saturn')} className={btn}>
              土星のステージへ
            </button>
          </div>
        </div>
      )}
      {phase === 'saturn' && (
        <SaturnStage
          face={face}
          onClear={() => {
            setCleared('saturn');
            setPhase('clear1');
          }}
        />
      )}
      {phase === 'jupiter' && (
        <JupiterStage
          face={face}
          art={art}
          onClear={() => {
            setCleared('jupiter');
            setPhase('clear2');
          }}
        />
      )}
      {(phase === 'clear1' || phase === 'clear2') && (
        <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
          <p className="animate-[fadeUp_0.5s_ease-out] text-4xl font-bold tracking-[0.3em] text-amber-200 drop-shadow-[0_0_20px_rgba(255,214,120,0.8)]">クリア</p>
          <button onClick={() => setPhase(phase === 'clear1' ? 'jupiter' : 'end')} className={`${btn} max-w-xs`}>
            {phase === 'clear1' ? '木星のステージへ' : 'つぎへ'}
          </button>
        </div>
      )}
      {phase === 'end' && (
        <div className="flex h-full flex-col justify-end px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
          <Map at={1} flag />
          <div className="mt-4 space-y-2 rounded-3xl bg-black/50 p-4 text-center">
            <p className="text-[12px] text-cyan-50/70">水星から先のマスには、布がかかっている</p>
            <p className="text-[13px]">体験版は、ここまでです</p>
            <button onClick={() => onDone({ neptune_trial: cleared })} className={btn}>
              OK
            </button>
          </div>
        </div>
      )}
      <button onClick={() => onDone({ neptune_trial: cleared })} className="absolute right-3 top-[calc(52px+env(safe-area-inset-top))] z-10 rounded-full bg-black/40 px-3 py-1 text-[11px] text-white/70">
        とじる
      </button>
    </div>
  );
}
