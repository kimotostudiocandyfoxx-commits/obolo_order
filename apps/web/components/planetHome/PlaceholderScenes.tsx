'use client';

import { PLANETS, type HomeRel, type PlanetId } from '@obolo/shared';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useHold } from '@/lib/planetHome/useHold';
import type { StageItem } from '@/lib/planetHome/model';
import type { SceneProps } from './skin';

/**
 * Placeholder scenes for 星のホーム: plain shapes only, so the rules can be tried and checked at phone width before the
 * story team's art and motion arrive (they replace these through skins.ts). Layout per M-R258 §4: portrait, your place in
 * the lower two thirds seen from slightly below with its name plate, what came around floating above and beside it, the
 * far scenery at the back.
 */

/** rim colours: own = gold, dachi = white, 推し = pink (M-R257 §3) */
export const RIM: Record<HomeRel, string> = { own: '#f2c14e', dachi: '#ffffff', oshi: '#ff7ab6', stranger: '#9fb3c8' };

const colours = (p: string) => PLANETS[(p === 'pluto' ? 'neptune' : p) as PlanetId]?.colors ?? ['#ccc', '#333'];

/** one work as a ball with its rim colour; sparkles when new, falls in, leaves the planet's way */
function Ball({ w, i, size, playing, leave, onItem, onHold }: { w: StageItem; i: number; size: number; playing: boolean; leave: string; onItem: (w: StageItem) => void; onHold: (w: StageItem) => void }) {
  const hold = useHold();
  const anim = w.leaving ? `ph-leave-${leave} 1.6s ease-in forwards` : w.drop === 'one' ? `ph-drop .9s cubic-bezier(.3,1.4,.5,1) ${0.25 + i * 0.35}s both` : w.drop === 'plus' ? `ph-fadein .6s ease-out 2.4s both` : undefined;
  return (
    <button
      {...hold(
        () => onItem(w),
        () => onHold(w),
      )}
      aria-label={`${w.author.name}の作品`}
      data-rel={w.rel}
      className="relative flex flex-col items-center"
      style={{ animation: anim }}
    >
      <span
        className="block rounded-full shadow-[0_3px_8px_rgba(0,0,0,.45)] transition-transform"
        style={{ width: size, height: size, background: 'radial-gradient(circle at 35% 30%, #fff8, #c98b4a 45%, #7a4a20)', border: `3px solid ${RIM[w.rel]}`, transform: playing ? 'scale(1.25)' : undefined }}
      />
      {w.fresh && <span className="ph-sparkle pointer-events-none absolute -right-1 -top-1 text-[12px] text-yellow-100">✦</span>}
    </button>
  );
}

/** Saturn: your giant record seen from slightly above, the play button on its rim, the needle-mic on the right */
export function SaturnPlaceholderScene({ view, stage, cfg, playingId, spinning, onPlay, onArrange, onItem, onHold }: SceneProps) {
  const list = [...stage.own, ...stage.around].sort((a, b) => Date.parse(b.flownAt) - Date.parse(a.flownAt));
  const [spin, setSpin] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!spinning) return;
    let last = performance.now();
    const tick = (t: number) => {
      setSpin((s) => (s + (t - last) * 0.012) % 360);
      last = t;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [spinning]);
  // newest on the outside ring first
  const rings = [
    { r: 0.86, n: 12 },
    { r: 0.64, n: 9 },
    { r: 0.44, n: 6 },
  ];
  const placed: { w: StageItem; x: number; y: number }[] = [];
  let k = 0;
  for (const ring of rings) {
    const here = list.slice(k, k + ring.n);
    here.forEach((w, i) => {
      const a = ((i / Math.max(here.length, 1)) * 360 + 90 + spin) * (Math.PI / 180);
      placed.push({ w, x: 50 + ring.r * 50 * Math.cos(a), y: 50 + ring.r * 50 * Math.sin(a) });
    });
    k += ring.n;
  }
  const plusFalls = stage.plus;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(#1c1238 0%, #3b2a66 38%, #8a6a3a 39%, #5a4220 100%)' }}>
      {/* the sky's ringed planet and the far records (scenery only on Saturn: no strangers' works) */}
      <div className="pointer-events-none absolute left-[8%] top-[9%] h-16 w-16 rounded-full bg-[#f6e3b4]/80" aria-hidden />
      <div className="pointer-events-none absolute left-[-2%] top-[13%] h-5 w-36 -rotate-12 rounded-[50%] border-2 border-[#f6e3b4]/60" aria-hidden />
      {[12, 30, 52, 70, 88].map((x, i) => (
        <div key={x} className="pointer-events-none absolute h-3 rounded-[50%] bg-black/60" style={{ left: `${x - 6}%`, top: `${36 + (i % 2) * 2}%`, width: `${10 + (i % 3) * 3}%` }} aria-hidden />
      ))}

      {/* your record: the lower two thirds */}
      <div className="absolute inset-x-[2%] bottom-[6%] top-[34%]">
        <div className="absolute inset-x-0 top-[8%] aspect-square" style={{ transform: 'scaleY(.62)', transformOrigin: 'top' }}>
          <div
            className="absolute inset-0 rounded-full border-[6px] border-[#2b2238]"
            style={{ background: 'repeating-radial-gradient(circle, #19121f 0 5px, #241a2e 5px 7px)', boxShadow: '0 30px 40px rgba(0,0,0,.5)' }}
            aria-hidden
          />
          <div className="absolute inset-[38%] rounded-full bg-[#f6e3b4]" aria-hidden />
        </div>
        {/* the kororins on the grooves (upright; the record's tilt is in their positions) */}
        <div className="absolute inset-x-0 top-[8%] aspect-square">
          {placed.map(({ w, x, y }, i) => (
            <div key={w.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y * 0.62}%` }}>
              <Ball w={w} i={i} size={34} playing={playingId === w.id} leave={cfg.leave} onItem={onItem} onHold={onHold} />
            </div>
          ))}
          {plusFalls && (
            <div className="pointer-events-none absolute left-1/2 top-[20%] flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-black text-[#3b2a66]" style={{ animation: 'ph-plus 2.6s ease-in both' }} aria-hidden>
              ＋
            </div>
          )}
        </div>
        {/* the needle and its microphone (upper right) */}
        <div className={`pointer-events-none absolute right-[4%] top-0 h-[34%] w-2 origin-top rounded bg-[#d9c7a3] transition-transform duration-700 ${spinning ? 'rotate-[28deg]' : 'rotate-[8deg]'}`} aria-hidden>
          <span className="absolute -bottom-3 -left-2 h-6 w-6 rounded-full bg-[#b88a4a]" />
        </div>
        {/* the name plate and the play button on the near rim */}
        <div className="absolute inset-x-0 top-[66%] flex items-center justify-center gap-2">
          <span className="rounded-md bg-[#f6e3b4] px-3 py-1 text-xs font-black text-[#5a3d14] shadow" data-testid="name-plate">
            {view.owner.name}
          </span>
          <button onClick={onPlay} className="rounded-full bg-[#f2c14e] px-5 py-2.5 text-sm font-black text-[#3b2410] shadow-[0_4px_0_#8a6a3a]" aria-label={spinning ? 'とめる' : '再生'}>
            {spinning ? '■ とめる' : '▶ 再生'}
          </button>
          <button onClick={onArrange} className="rounded-full bg-black/40 px-3 py-1.5 text-[11px] font-bold text-white/85">
            並べかえ
          </button>
        </div>
      </div>
    </div>
  );
}

/** every other planet: your place (a big shape with its name plate), works floating around it, small ones far away */
export function GenericPlaceholderScene({ view, stage, cfg, playingId, onPlace, onItem, onHold, onFar }: SceneProps) {
  const [top, bottom] = colours(cfg.planet);
  const hold = useHold();
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `linear-gradient(${bottom} 0%, ${top} 70%)` }}>
      {/* the far scenery: strangers' works, small (none for the young — the feed sends none) */}
      <div className="absolute inset-x-0 top-[22%] h-[10%]">
        {stage.far.map((w, i) => (
          <button key={w.id} {...hold(() => onFar(w), () => onFar(w))} aria-label={`遠くの${cfg.work}`} className="absolute h-3 w-3 rounded-full bg-white/70" style={{ left: `${10 + ((i * 37) % 80)}%`, top: `${(i * 23) % 70}%`, animation: `ph-float ${5 + (i % 3)}s ease-in-out ${i * 0.4}s infinite` } as CSSProperties} />
        ))}
      </div>
      {/* around: dachi and 推し, floating */}
      <div className="absolute inset-x-0 top-[30%] h-[22%]">
        {stage.around.map((w, i) => (
          <div key={w.id} className="absolute" style={{ left: `${6 + ((i * 29) % 82)}%`, top: `${(i * 41) % 80}%`, animation: `ph-float ${4 + (i % 4)}s ease-in-out ${i * 0.3}s infinite` }}>
            <Ball w={w} i={i} size={40} playing={playingId === w.id} leave={cfg.leave} onItem={onItem} onHold={onHold} />
          </div>
        ))}
      </div>
      {/* your place */}
      <button onClick={onPlace} aria-label={`${view.owner.name}の${cfg.place}`} className="absolute inset-x-[8%] bottom-0 top-[50%] rounded-t-[40%] border-4 border-white/40 bg-black/30">
        <span className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-md bg-white/90 px-3 py-1 text-xs font-black text-black/70" data-testid="name-plate">
          {view.owner.name}
        </span>
        <span className="absolute inset-x-0 top-[42%] text-center text-sm font-bold text-white/80">{cfg.place}</span>
      </button>
    </div>
  );
}

/** the keyframes the placeholder scenes use (drop, 「＋」, float, sparkle, the planets' ways of leaving) */
export const PLACEHOLDER_CSS = `
@keyframes ph-drop { 0% { transform: translateY(-70vh) scale(.6); opacity: 0 } 60% { opacity: 1 } 100% { transform: none; opacity: 1 } }
@keyframes ph-plus { 0% { transform: translate(-50%,-70vh); opacity: 0 } 50% { transform: translate(-50%,0); opacity: 1 } 85% { opacity: 1 } 100% { transform: translate(-50%,0) scale(1.6); opacity: 0 } }
@keyframes ph-fadein { from { opacity: 0; transform: scale(.4) } to { opacity: 1; transform: none } }
@keyframes ph-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
@keyframes ph-spark { 0%,100% { opacity: .2; transform: scale(.8) } 50% { opacity: 1; transform: scale(1.2) } }
.ph-sparkle { animation: ph-spark 1.8s ease-in-out infinite }
@keyframes ph-leave-up-to-sky { to { transform: translateY(-80vh) scale(.5); opacity: 0 } }
@keyframes ph-leave-fly-away { to { transform: translate(60vw,-50vh) rotate(20deg); opacity: 0 } }
@keyframes ph-leave-sail-off { to { transform: translateX(-70vw) scale(.4); opacity: 0 } }
@keyframes ph-leave-ufo-up { 30% { transform: translateY(6px) } to { transform: translateY(-90vh); opacity: 0 } }
@keyframes ph-leave-fade { to { opacity: 0; transform: scale(1.6) } }
@keyframes ph-leave-dim { to { opacity: 0; filter: brightness(.2) } }
@media (prefers-reduced-motion: reduce) { [style*="ph-"], .ph-sparkle { animation: none !important } }
`;
