'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { spriteUrl } from '@/lib/onboarding/media';
import type { Shot as ShotSpec, ShotCam, ShotFx, ShotLayer } from '@/lib/onboarding/shots';

/**
 * A still-based cut (lib/onboarding/shots.ts; client 2026-11-28): the plate moved like a film camera, cut-outs standing
 * on it with a little parallax, light effects in the picture's coordinates. The picture box keeps the plate's 9:16 and
 * covers the screen on a phone (contains it on a wide screen), exactly like the stage's other stills (.story-fit), so a
 * layer placed in % of the picture stays on its spot. Transform and opacity only; with prefers-reduced-motion the
 * camera rests on its end, layers stand still and no particles are drawn.
 */
const AR = 9 / 16;

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return r;
}

/**
 * the camera as a transform of the picture box: `x`, `y` (% of the picture) come to the centre of the screen — never so
 * far that an edge of the picture shows (at scale s the window is 100/s % of the box wide: the centre stays within
 * 50 ± 50·(1 − 1/s))
 */
const camTransform = (c: ShotCam) => {
  const lim = 50 * (1 - 1 / Math.max(1, c.s));
  const dx = Math.max(-lim, Math.min(lim, 50 - c.x));
  const dy = Math.max(-lim, Math.min(lim, 50 - c.y));
  return `scale(${c.s}) translate(${dx.toFixed(2)}%, ${dy.toFixed(2)}%)`;
};

export function ShotView({ src, spec, mouth, under, reduced: forced }: { src: string; spec: ShotSpec; mouth?: ReactNode; under?: boolean; reduced?: boolean }) {
  const rm = useReducedMotion();
  const reduced = forced ?? rm;
  // the camera: set to `from` on the first frame, then moved to `to`; a later spec on the same picture (a reframe)
  // moves from wherever it is to the new `to`
  const [cam, setCam] = useState<{ c: ShotCam; t: string }>({ c: reduced ? spec.to : spec.from, t: 'none' });
  const first = useRef(true);
  useEffect(() => {
    if (under) return;
    if (reduced) return setCam({ c: spec.to, t: 'none' });
    if (first.current) {
      first.current = false;
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setCam({ c: spec.to, t: `transform ${spec.dur}s cubic-bezier(.33,.08,.25,1)` })));
      return () => cancelAnimationFrame(r);
    }
    const re = spec.reframe ?? 0.9;
    // a reframe: a quick move to the new frame, then the slow drift to its end
    setCam({ c: spec.from, t: `transform ${re}s cubic-bezier(.4,0,.2,1)` });
    const t = setTimeout(() => setCam({ c: spec.to, t: `transform ${Math.max(0.5, spec.dur - re)}s cubic-bezier(.33,.08,.25,1)` }), re * 1000);
    return () => clearTimeout(t);
  }, [spec, reduced, under]);
  // the shot's own clock (layers' anims and timed effects start from the cut / the reframe)
  const [epoch, setEpoch] = useState(0);
  useEffect(() => setEpoch((e) => e + 1), [spec]);
  const enter = !reduced && spec.enter ? ENTER[spec.enter] : undefined;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ containerType: 'size', animation: enter } as CSSProperties} aria-hidden>
      <style>{SHOT_CSS}</style>
      <div className="shot-box absolute left-1/2 top-1/2" style={{ translate: '-50% -50%' }}>
        <div className="absolute inset-0" style={{ transform: camTransform(cam.c), transition: cam.t, transformOrigin: '50% 50%', willChange: 'transform' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
          {mouth}
          {(spec.layers ?? []).map((l, k) => (
            <Layer key={`${l.src}-${k}`} l={l} dur={spec.dur} reduced={reduced} epoch={epoch} />
          ))}
          {!reduced && (spec.fx ?? []).map((f, k) => <Fx key={`${epoch}-${k}`} f={f} />)}
          {reduced && (spec.fx ?? []).filter((f) => f.k === 'ring' || f.k === 'glow').map((f, k) => <Fx key={k} f={f} still />)}
        </div>
      </div>
      {!reduced && spec.bloomOut !== undefined && (
        <div key={`bloom-${epoch}`} className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 46%, #fffaf0 0%, #ffe6b0 40%, #e8b860 100%)', opacity: 0, animation: `shotBloomOut ${spec.dur - spec.bloomOut}s ease-in ${spec.bloomOut}s forwards` }} />
      )}
      {!reduced && spec.enter === 'bloom' && <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 46%, #fffaf0 0%, #ffe6b0 45%, #e8b860 100%)', animation: 'shotBloomIn 1.4s ease-out forwards' }} />}
      {!reduced && spec.enter === 'flash' && <div className="absolute inset-0 bg-white" style={{ animation: 'shotFlash 0.7s ease-out forwards' }} />}
    </div>
  );
}

/**
 * Cut-outs over a MOTION (not a still): the foreground of a background film, in the same picture coordinates as a shot
 * (9:16, covering the screen on a phone). Day 2's universe in the Earth temple (client playtest 2026-11-28): the day-1
 * films 14 → 15 with KIMORIN's back large and out of focus in front, watching. Fades in; still with reduced motion.
 */
export function ForegroundView({ layers, dur = 8 }: { layers: ShotLayer[]; dur?: number }) {
  const reduced = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ containerType: 'size', animation: reduced ? undefined : 'shotFade 0.9s ease-out both' } as CSSProperties} aria-hidden>
      <style>{SHOT_CSS}</style>
      <div className="shot-box absolute left-1/2 top-1/2" style={{ translate: '-50% -50%' }}>
        {layers.map((l, k) => (
          <Layer key={`${l.src}-${k}`} l={l} dur={dur} reduced={reduced} epoch={0} />
        ))}
      </div>
    </div>
  );
}

const ENTER: Record<NonNullable<ShotSpec['enter']>, string> = {
  whip: 'shotWhip 0.38s cubic-bezier(.2,.8,.2,1) both',
  bloom: 'shotFade 0.2s linear both',
  flash: 'shotFade 0.1s linear both',
  settle: 'shotFade 0.12s linear both',
};

function Layer({ l, dur, reduced, epoch }: { l: ShotLayer; dur: number; reduced: boolean; epoch: number }) {
  const url = spriteUrl(l.src);
  const [drift, setDrift] = useState(false);
  useEffect(() => {
    setDrift(false);
    if (reduced || !l.drift) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setDrift(true)));
    return () => cancelAnimationFrame(r);
  }, [epoch, reduced, l.drift]);
  // the layer's box: centred on x, its feet on y, h tall (the picture's width is 9/16 of its height: width in % of the
  // picture's width = h × 16/9 × the cut-out's own aspect, so the box is sized by height and the image keeps its aspect)
  const box: CSSProperties = {
    left: `${l.x}%`,
    top: `${l.y - l.h}%`,
    height: `${l.h}%`,
    transform: `translateX(-50%)${drift && l.drift ? ` translate(${l.drift[0]}%, ${l.drift[1]}%)` : ''}`,
    transition: drift ? `transform ${dur}s cubic-bezier(.33,.08,.25,1)` : 'none',
  };
  const anim = reduced ? undefined : l.anim === 'walk-away' ? `shotWalkAway ${l.animDur ?? 3.2}s cubic-bezier(.3,.2,.6,1) forwards` : l.anim === 'vanish' ? `shotVanish ${l.animDur ?? 2.2}s ease-in forwards` : l.anim === 'in' ? 'shotFade 0.8s ease-out both' : undefined;
  const img: CSSProperties = {
    height: '100%',
    width: 'auto',
    transform: l.flip ? 'scaleX(-1)' : undefined,
    filter: [l.blur ? `blur(${l.blur}px)` : '', l.tone ?? '', l.rim ? `drop-shadow(0 0 1.5px ${l.rim})` : ''].join(' ').trim() || undefined,
  };
  // the plate's key light, laid over the figure only (masked by the cut-out itself)
  const mask = `url("${url}") center / 100% 100% no-repeat`;
  return (
    <div key={epoch} className="absolute" style={{ ...box, animation: anim, transformOrigin: '50% 100%' }}>
      <div className="relative h-full" style={{ animation: !reduced && l.float ? 'shotFloat 6s ease-in-out infinite' : !reduced && l.anim === 'walk-away' ? `shotStep 0.4s ease-in-out ${Math.round((l.animDur ?? 3.2) / 0.4)}` : undefined }}>
        {l.halo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spriteUrl('monban-halo')} alt="" draggable={false} className="absolute" style={{ left: '50%', top: '5.7%', width: '62%', translate: '-50% -50%', opacity: 0.9 }} />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" draggable={false} className="relative block" style={img} />
        {l.key && (
          <div className="absolute inset-0" style={{ background: l.key, mixBlendMode: 'soft-light', mask, WebkitMask: mask, transform: img.transform, filter: l.blur ? `blur(${l.blur}px)` : undefined }} />
        )}
        {l.reflect && (
          <div className="absolute left-1/2 top-full h-[7%] w-[90%] rounded-full" style={{ translate: '-50% -60%', background: 'radial-gradient(closest-side, rgba(0,0,0,.55), transparent)' }} />
        )}
        {l.reflect && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" draggable={false} className="absolute left-0 top-full block" style={{ ...img, transform: `scaleY(-1)${l.flip ? ' scaleX(-1)' : ''}`, opacity: 0.22, filter: `${img.filter ?? ''} blur(1.5px)`.trim(), maskImage: 'linear-gradient(to top, rgba(0,0,0,.9), transparent 45%)', WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,.9), transparent 45%)' }} />
        )}
      </div>
    </div>
  );
}

/** a few random numbers, fixed after mounting (random places would differ between the server's HTML and the browser) */
function useSeeded<T>(n: number, make: (k: number) => T): T[] {
  const [v, setV] = useState<T[]>([]);
  useEffect(() => setV(Array.from({ length: n }, (_, k) => make(k))), [n]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

function Fx({ f, still }: { f: ShotFx; still?: boolean }) {
  const delay = 'at' in f && f.at ? `${f.at}s` : '0s';
  if (f.k === 'beam')
    return (
      <div className="absolute" style={{ left: `${f.x}%`, top: 0, width: `${f.w}%`, height: `${f.y}%`, translate: '-50% 0' }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(255,240,200,0) 0%, rgba(255,236,190,.55) 30%, rgba(255,250,235,.95) 100%)', maskImage: 'linear-gradient(to right, transparent, #000 35%, #000 65%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, #000 35%, #000 65%, transparent)', transformOrigin: '50% 0', transform: 'scaleY(0)', animation: `shotBeam 0.9s cubic-bezier(.5,0,.8,.4) ${delay} forwards, shotFadeOut 1.2s ease-in calc(${delay} + 1.4s) forwards`, mixBlendMode: 'screen' }} />
        <div className="absolute left-1/2 top-full h-[24cqw] w-[60cqw] rounded-full" style={{ translate: '-50% -50%', background: 'radial-gradient(ellipse, rgba(255,246,220,.95), rgba(255,210,120,.4) 40%, transparent 70%)', opacity: 0, animation: `shotFlare 1.6s ease-out calc(${delay} + 0.85s) forwards`, mixBlendMode: 'screen' }} />
      </div>
    );
  if (f.k === 'glint') {
    const s = f.size ?? 6;
    return (
      <div className="absolute" style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${s}cqw`, height: `${s}cqw`, translate: '-50% -50%', opacity: 0, animation: `shotGlint 0.9s ease-out ${delay} forwards`, mixBlendMode: 'screen' }}>
        <div className="absolute left-0 top-1/2 h-[6%] w-full" style={{ translate: '0 -50%', background: 'linear-gradient(90deg, transparent, #fff, transparent)' }} />
        <div className="absolute left-1/2 top-0 h-full w-[6%]" style={{ translate: '-50% 0', background: 'linear-gradient(transparent, #fff, transparent)' }} />
        <div className="absolute inset-[30%] rounded-full" style={{ background: 'radial-gradient(circle, #fff, rgba(255,230,170,.6) 40%, transparent 70%)' }} />
      </div>
    );
  }
  if (f.k === 'sweep')
    return (
      <div className="absolute overflow-hidden" style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%`, mixBlendMode: 'screen' }}>
        <div className="absolute inset-x-0 h-[22%]" style={{ top: '100%', background: 'linear-gradient(to bottom, transparent, rgba(255,200,240,.16) 45%, rgba(170,255,250,.13) 55%, transparent)', animation: `shotSweep ${f.period ?? 5}s ease-in-out 0.8s infinite` }} />
      </div>
    );
  if (f.k === 'ring')
    return (
      <div className="absolute rounded-full" style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.r * 2}%`, aspectRatio: '1', translate: '-50% -50%', background: 'radial-gradient(closest-side, transparent 76%, rgba(255,214,140,.30) 86%, rgba(255,240,200,.22) 93%, transparent)', mixBlendMode: 'screen', animation: still ? undefined : 'shotBreathe 4.5s ease-in-out infinite' }} />
    );
  if (f.k === 'glow')
    return (
      <div className="absolute rounded-full" style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.r * 2}%`, aspectRatio: '1', translate: '-50% -50%', background: `radial-gradient(circle, ${f.color ?? 'rgba(255,214,130,.55)'}, rgba(255,200,110,.18) 45%, transparent 70%)`, mixBlendMode: 'screen', animation: still ? undefined : 'shotBreathe 2.6s ease-in-out infinite' }} />
    );
  if (f.k === 'spill')
    return <div className="absolute" style={{ left: `${f.x}%`, top: `${f.y}%`, width: '110%', height: '80%', translate: '-50% -25%', background: 'radial-gradient(closest-side, rgba(255,214,150,.45), rgba(255,190,110,.16) 50%, transparent)', mixBlendMode: 'screen', opacity: 0, animation: `shotFade 1.6s ease-out ${delay} forwards` }} />;
  if (f.k === 'streak') {
    const d = f.dur ?? 0.8;
    return (
      <div className="absolute h-[5cqw] w-[5cqw] rounded-full" style={{ translate: '-50% -50%', background: 'radial-gradient(circle, #fff, rgba(255,226,160,.8) 35%, transparent 70%)', boxShadow: '0 0 18px 6px rgba(255,220,150,.6)', opacity: 0, ['--x0' as string]: `${f.x}%`, ['--y0' as string]: `${f.y}%`, ['--x1' as string]: `${f.x2}%`, ['--y1' as string]: `${f.y2}%`, ['--s1' as string]: f.grow ? '0.4' : '1', ['--s2' as string]: f.grow ? '9' : '0.2', animation: `shotStreak ${d}s cubic-bezier(.6,0,.4,1) ${delay} forwards` } as CSSProperties} />
    );
  }
  if (f.k === 'dust') return <Dust n={f.n ?? 24} />;
  if (f.k === 'stars') return <Stars n={f.n ?? 36} top={f.top ?? 0} bottom={f.bottom ?? 45} />;
  return null;
}

function Dust({ n }: { n: number }) {
  const motes = useSeeded(Math.min(n, 40), () => ({ x: Math.random() * 100, y: 20 + Math.random() * 75, s: 0.4 + Math.random() * 0.7, d: 10 + Math.random() * 10, del: -Math.random() * 20, dx: (Math.random() - 0.5) * 8 }));
  return (
    <>
      {motes.map((m, k) => (
        <span key={k} className="absolute block rounded-full" style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.s}cqw`, height: `${m.s}cqw`, background: 'radial-gradient(circle, rgba(255,240,205,.95), rgba(255,214,150,.35) 50%, transparent 75%)', ['--dx' as string]: `${m.dx}cqw`, animation: `shotDust ${m.d}s linear ${m.del}s infinite` } as CSSProperties} />
      ))}
    </>
  );
}

function Stars({ n, top, bottom }: { n: number; top: number; bottom: number }) {
  const stars = useSeeded(Math.min(n, 60), () => ({ x: Math.random() * 100, y: top + Math.random() * (bottom - top), s: 0.25 + Math.random() * 0.45, d: 1.6 + Math.random() * 2.6, del: -Math.random() * 4 }));
  return (
    <>
      {stars.map((m, k) => (
        <span key={k} className="absolute block rounded-full bg-white" style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.s}cqw`, height: `${m.s}cqw`, boxShadow: '0 0 4px 1px rgba(200,220,255,.7)', animation: `shotTwinkle ${m.d}s ease-in-out ${m.del}s infinite` }} />
      ))}
    </>
  );
}

const SHOT_CSS = `
.shot-box{width:max(100cqw,calc(100cqh*${AR}));height:max(100cqh,calc(100cqw/${AR}))}
@media (min-aspect-ratio: 3/4){.shot-box{width:min(100cqw,calc(100cqh*${AR}));height:min(100cqh,calc(100cqw/${AR}))}}
@keyframes shotFade{from{opacity:0}to{opacity:1}}
@keyframes shotFadeOut{to{opacity:0}}
@keyframes shotWhip{from{transform:translateX(-60%);filter:blur(14px);opacity:.4}60%{filter:blur(4px);opacity:1}to{transform:none;filter:none;opacity:1}}
@keyframes shotBloomIn{from{opacity:1}to{opacity:0}}
@keyframes shotBloomOut{from{opacity:0}to{opacity:1}}
@keyframes shotFlash{from{opacity:.95}to{opacity:0}}
@keyframes shotBeam{from{transform:scaleY(0);opacity:.6}70%{opacity:1}to{transform:scaleY(1);opacity:1}}
@keyframes shotFlare{0%{opacity:0;transform:scale(.4)}25%{opacity:1}100%{opacity:.55;transform:scale(1)}}
@keyframes shotGlint{0%{opacity:0;transform:scale(.3) rotate(0)}30%{opacity:1;transform:scale(1) rotate(20deg)}100%{opacity:0;transform:scale(.6) rotate(45deg)}}
@keyframes shotSweep{0%{top:100%}60%,100%{top:-25%}}
@keyframes shotBreathe{0%,100%{opacity:.7;transform:scale(1)}50%{opacity:1;transform:scale(1.03)}}
@keyframes shotStreak{0%{opacity:0;left:var(--x0);top:var(--y0);transform:scale(var(--s1))}12%{opacity:1}88%{opacity:1}100%{opacity:0;left:var(--x1);top:var(--y1);transform:scale(var(--s2))}}
@keyframes shotDust{0%{transform:translate(0,0);opacity:0}15%{opacity:.8}85%{opacity:.6}100%{transform:translate(var(--dx),-18cqh);opacity:0}}
@keyframes shotTwinkle{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes shotFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3%)}}
@keyframes shotWalkAway{0%{transform:translateX(-50%) translateY(0) scale(1);opacity:1;filter:none}88%{opacity:1;filter:none}100%{transform:translateX(-50%) translateY(-36%) scale(.28);opacity:0;filter:brightness(3)}}
@keyframes shotStep{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5%)}}
@keyframes shotVanish{0%{opacity:1;filter:none;transform:translateX(-50%)}40%{opacity:.9;filter:brightness(2.4) blur(1px)}100%{opacity:0;filter:brightness(3) blur(6px);transform:translateX(-50%) translateY(-12%) scale(1.15)}}
`;
