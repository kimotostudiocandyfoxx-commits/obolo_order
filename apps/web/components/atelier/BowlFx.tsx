'use client';

import type { AtelierKind } from '@/lib/atelier/unlock';
import { TEMPLE_PLATE } from './temple';
import type { CastPalette } from './CastClock';
import { MagicCircle } from './spellLooks';
import { KindMark } from './WorkCard';

export { batiTalkPlace, TEMPLE_PLATE } from './temple';

/**
 * R11 (client): 'glow' — {bati} casts into it (a making starting, a change made): bright, light pouring up; 'shimmer' — a
 * slow job still brewing after the cast ({bati} back in the middle): a soft breathing light, so you see it is being made.
 */
/**
 * R18 (client): 'divine' — a work being made and waited for (the arcane clock floats over it): a pillar of light standing
 * out of the water, a magic circle turning slowly on its surface, motes of light rising, a slow pulse — in the work's
 * talisman colours (`tint`).
 */
export type BowlState = 'idle' | 'glow' | 'shimmer' | 'divine' | { rise: { key: string; image?: string | null; kind: AtelierKind } };

const CSS = `
@keyframes bowl-pulse{0%,100%{opacity:.55;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}}
@keyframes bowl-ripple{0%{opacity:.85;transform:translate(-50%,-50%) scale(.25)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.25)}}
@keyframes bowl-ray{0%{opacity:0;transform:translateY(0) scaleY(.3)}25%{opacity:.9}100%{opacity:0;transform:translateY(-55%) scaleY(1)}}
@keyframes bowl-rise{0%{opacity:0;transform:translate(-50%,-30%) scale(.35)}18%{opacity:1}100%{opacity:0;transform:translate(-50%,-260%) scale(1.15)}}
@keyframes bowl-fade{0%,100%{opacity:0}30%,70%{opacity:1}}
@keyframes bowl-in{from{opacity:0}to{opacity:1}}
@keyframes bowl-breathe{0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(.96)}50%{opacity:.95;transform:translate(-50%,-50%) scale(1.04)}}
@keyframes bowl-mist{0%,100%{opacity:.25;transform:translate(-50%,-70%) scaleY(.9)}50%{opacity:.55;transform:translate(-50%,-70%) scaleY(1.05)}}
@keyframes bowl-twinkle{0%,100%{opacity:0;transform:translate(-50%,-50%) scale(.4)}50%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes bowl-pillar{0%,100%{opacity:.7;transform:translateX(-50%) scaleX(.9)}50%{opacity:1;transform:translateX(-50%) scaleX(1.08)}}
@keyframes bowl-spin{to{transform:rotate(360deg)}}
@keyframes bowl-mote{0%{opacity:0;transform:translate(-50%,0) scale(.6)}15%{opacity:1}100%{opacity:0;transform:translate(-50%,var(--rise)) scale(1)}}
@keyframes bowl-slow{0%,100%{opacity:.7;transform:translate(-50%,-50%) scale(.97)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.05)}}
[data-bowl-paused] *{animation-play-state:paused!important}
@keyframes bowl-halo{0%,100%{opacity:.55;transform:translate(-50%,-62%) scale(1)}50%{opacity:.9;transform:translate(-50%,-62%) scale(1.1)}}
`;

export function BowlFx({ state, at, scale, reduced, tint, paused }: { state: BowlState; at: (u: number, v: number) => { x: number; y: number }; scale: number; reduced: boolean; /** R18: the 'divine' light's colours (the work's talisman palette) */ tint?: CastPalette; /** the tab is hidden: nothing moves */ paused?: boolean }) {
  const c = at(TEMPLE_PLATE.bowl.u, TEMPLE_PLATE.bowl.v);
  const bw = TEMPLE_PLATE.bowl.w * scale;
  const lit = state === 'glow' || typeof state === 'object';
  const soft = state === 'shimmer';
  const rise = typeof state === 'object' ? state.rise : null;
  const divine = state === 'divine';
  const g = `rgba(${tint?.glow ?? '150,215,255'},`;
  return (
    <div className="pointer-events-none absolute left-0 top-0" style={{ transform: `translate3d(${c.x}px, ${c.y}px, 0)` }} data-bowl={typeof state === 'string' ? state : 'rise'} data-bowl-paused={paused ? '' : undefined} aria-hidden>
      <style>{CSS}</style>
      {divine && (
        <>
          {/* the pillar of light standing out of the water (up to the clock over it) */}
          <span
            className="absolute block will-change-transform"
            style={{ left: 0, top: -bw * 2.3, width: bw * 0.62, height: bw * 2.3, background: `linear-gradient(to right, ${g}0) 0%, ${g}.38) 30%, rgba(255,255,255,.55) 50%, ${g}.38) 70%, ${g}0) 100%)`, WebkitMaskImage: 'linear-gradient(to top, #000 0%, rgba(0,0,0,.85) 35%, rgba(0,0,0,0) 100%)', maskImage: 'linear-gradient(to top, #000 0%, rgba(0,0,0,.85) 35%, rgba(0,0,0,0) 100%)', mixBlendMode: 'screen', transformOrigin: '50% 100%', transform: 'translateX(-50%)', animation: reduced ? 'bowl-in 1s ease-out both' : 'bowl-pillar 5s ease-in-out infinite' }}
            data-testid="bowl-pillar"
          />
          {/* the light over the bowl */}
          <span
            className="absolute left-0 top-0 block rounded-[50%] will-change-transform"
            style={{ width: bw * 1.45, height: bw * 1.0, background: `radial-gradient(ellipse at 50% 72%, ${g}.55) 0%, ${g}.22) 42%, ${g}0) 70%)`, mixBlendMode: 'screen', animation: reduced ? 'bowl-in .8s ease-out both' : 'bowl-halo 4.6s ease-in-out infinite', transform: 'translate(-50%,-62%)' }}
          />
          {/* the water lit from inside, pulsing slowly */}
          <span
            className="absolute left-0 top-0 block rounded-[50%] will-change-transform"
            style={{ width: bw * 1.02, height: bw * 0.32, background: `radial-gradient(ellipse at center, rgba(255,255,255,.95) 0%, ${g}.7) 40%, ${g}0) 74%)`, mixBlendMode: 'screen', animation: reduced ? 'bowl-in .8s ease-out both' : 'bowl-slow 4s ease-in-out infinite', transform: 'translate(-50%,-50%)' }}
          />
          {/* the magic circle on the water (laid flat: squashed), turning slowly */}
          <span className="absolute left-0 top-0 block" style={{ width: bw * 0.84, height: bw * 0.84, transform: 'translate(-50%,-50%) scaleY(.27)', mixBlendMode: 'screen' }}>
            <span className="block h-full w-full will-change-transform" style={{ color: tint?.ring ?? '#d8f2ff', opacity: 0.85, animation: reduced ? undefined : 'bowl-spin 36s linear infinite' }}>
              <MagicCircle rich className="h-full w-full" />
            </span>
          </span>
          {/* motes of light rising */}
          {!reduced &&
            [
              [-0.3, 0.0, 4.4],
              [-0.16, 1.6, 5.2],
              [-0.04, 0.7, 3.8],
              [0.09, 2.4, 4.8],
              [0.21, 1.1, 5.6],
              [0.33, 3.0, 4.2],
              [-0.24, 3.4, 5.0],
              [0.02, 4.0, 4.6],
            ].map(([dx, d, t], k) => (
              <span key={`m${k}`} className="absolute block rounded-full bg-white will-change-transform" style={{ left: dx * bw, top: (k % 3) * bw * 0.02 - bw * 0.02, width: bw * 0.02, height: bw * 0.02, boxShadow: `0 0 8px 3px ${g}.9)`, ['--rise' as string]: `${-bw * (1.1 + (k % 4) * 0.25)}px`, animation: `bowl-mote ${t}s ease-out ${d}s infinite`, opacity: 0 }} />
            ))}
        </>
      )}
      {soft && (
        <>
          {/* still brewing: the water breathes a soft light, a soft mist of light over it, a slow ripple, a few glints */}
          <span
            className="absolute left-0 top-0 block rounded-[50%] will-change-transform"
            style={{ width: bw * 0.8, height: bw * 0.75, background: 'radial-gradient(ellipse at 50% 80%, rgba(190,230,255,.6) 0%, rgba(150,200,255,.2) 45%, rgba(120,170,255,0) 70%)', mixBlendMode: 'screen', animation: reduced ? 'bowl-in .8s ease-out both' : 'bowl-mist 3.6s ease-in-out infinite', transform: 'translate(-50%,-70%)' }}
          />
          <span
            className="absolute left-0 top-0 block rounded-[50%] will-change-transform"
            data-testid="bowl-shimmer"
            style={{ width: bw * 0.98, height: bw * 0.3, background: 'radial-gradient(ellipse at center, rgba(215,242,255,.95) 0%, rgba(150,210,255,.6) 48%, rgba(120,170,255,0) 74%)', mixBlendMode: 'screen', animation: reduced ? 'bowl-in .8s ease-out both' : 'bowl-breathe 3.6s ease-in-out infinite', transform: 'translate(-50%,-50%)' }}
          />
          {!reduced && (
            <span className="absolute left-0 top-0 block rounded-[50%] border border-sky-100/60 will-change-transform" style={{ width: bw * 0.85, height: bw * 0.24, animation: 'bowl-ripple 4.2s ease-out infinite', transform: 'translate(-50%,-50%) scale(.25)', opacity: 0 }} />
          )}
          {!reduced &&
            [
              [-0.2, -0.02, 0],
              [0.05, -0.05, 1.1],
              [0.22, 0.01, 2.0],
              [-0.06, 0.03, 2.8],
              [0.14, -0.12, 0.6],
              [-0.13, -0.16, 1.7],
            ].map(([dx, dy, d], k) => (
              <span key={`t${k}`} className="absolute block rounded-full bg-white will-change-transform" style={{ left: dx * bw, top: dy * bw, width: bw * 0.022, height: bw * 0.022, boxShadow: '0 0 8px 3px rgba(190,230,255,.9)', animation: `bowl-twinkle 2.6s ease-in-out ${d}s infinite`, transform: 'translate(-50%,-50%)', opacity: 0 }} />
            ))}
        </>
      )}
      {lit && (
        <>
          {/* the light standing over the bowl while {bati} casts */}
          <span
            className="absolute left-0 top-0 block rounded-[50%] will-change-transform"
            style={{ width: bw * 1.25, height: bw * 0.9, background: 'radial-gradient(ellipse at 50% 70%, rgba(190,230,255,.55) 0%, rgba(140,190,255,.22) 45%, rgba(120,170,255,0) 70%)', mixBlendMode: 'screen', animation: reduced ? 'bowl-in .8s ease-out both' : 'bowl-halo 1.8s ease-in-out infinite', transform: 'translate(-50%,-62%)' }}
          />
          {/* the water lit from inside */}
          <span
            className="absolute left-0 top-0 block rounded-[50%] will-change-transform"
            style={{ width: bw, height: bw * 0.3, background: 'radial-gradient(ellipse at center, rgba(210,240,255,.95) 0%, rgba(140,200,255,.55) 45%, rgba(120,170,255,0) 72%)', mixBlendMode: 'screen', animation: reduced ? 'bowl-in .8s ease-out both' : 'bowl-pulse 2.2s ease-in-out infinite', transform: 'translate(-50%,-50%)' }}
          />
          {!reduced &&
            [0, 1, 2].map((k) => (
              <span key={`r${k}`} className="absolute left-0 top-0 block rounded-[50%] border-2 border-sky-100/80 will-change-transform" style={{ width: bw * 0.9, height: bw * 0.26, animation: `bowl-ripple 2.4s ease-out ${k * 0.8}s infinite`, transform: 'translate(-50%,-50%) scale(.25)', opacity: 0 }} />
            ))}
          {/* light rising off the surface */}
          {!reduced &&
            [-0.22, -0.08, 0.06, 0.2].map((dx, k) => (
              <span
                key={`l${k}`}
                className="absolute block rounded-full will-change-transform"
                style={{ left: dx * bw - bw * 0.035, top: -bw * 1.1, width: bw * 0.07, height: bw * 1.1, transformOrigin: '50% 100%', background: 'linear-gradient(to top, rgba(220,245,255,.85), rgba(170,215,255,0))', mixBlendMode: 'screen', animation: `bowl-ray ${1.8 + k * 0.35}s ease-out ${k * 0.45}s infinite`, opacity: 0 }}
              />
            ))}
        </>
      )}
      {rise && (
        <span
          key={rise.key}
          className="absolute left-0 top-0 block overflow-hidden rounded-2xl border-2 border-white/80 bg-[#141b44] shadow-[0_0_30px_rgba(180,225,255,.9)] will-change-transform"
          style={{ width: bw * 0.62, height: bw * 0.62, animation: reduced ? 'bowl-fade 1.6s ease-in-out both' : 'bowl-rise 1.7s cubic-bezier(.3,.6,.3,1) both', transform: 'translate(-50%,-30%)' }}
          data-testid="bowl-rise"
        >
          {rise.image && !rise.image.startsWith('idb:') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={rise.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sky-100">
              <KindMark kind={rise.kind} className="h-1/2 w-1/2" />
            </span>
          )}
        </span>
      )}
    </div>
  );
}
