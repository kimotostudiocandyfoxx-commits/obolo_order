'use client';

import { talkExpression, talkPose, type TalkExpression, type TalkFace, type TalkLook, type TalkMotion } from '@obolo/shared';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * One speaker standing in the side-by-side talk, made to look alive from still pictures (M-R235 — no video):
 *   breathing   the whole figure stretches a hair, once every 3–4 s (each speaker at their own rate)
 *   sway        the top of the figure (ears, hair, hood) sways a little: a second copy of the picture, masked to the top
 *               and sheared from the neck (one composited layer, no filters)
 *   blink       the eyes-closed patch over the eyes, at random 2–6 s, sometimes twice
 *   lip flap    the open-mouth patch while speaking, with a small bob in time
 *   idle        quiet a while: a head tilt, a look round, a yawn now and then
 *   listen      while you record or type: turned a little to you, nodding
 *   think       the 'thinking' face and a slow sway
 *   reactions   hop / lean / nod / tilt / sway / shrink, as the reply asked for
 *   shadow      under the feet
 * Reduced motion: only the blink and the lip flap. `calm` (a group's quiet ones): only breathing and the blink.
 * An expression may also be a short looping video (M-R234 §7): it is played as it is.
 */
export type FigureState = 'idle' | 'talk' | 'listen' | 'think';
// the prototype's motions (design/talk/proto.html): hop .55 s, lean .5 s, nod .9 s, a tilt held 1.4 s
const REACTION: Record<TalkMotion, string> = {
  none: '',
  hop: 'talk-hop .55s cubic-bezier(.3,1.6,.5,1)',
  lean: 'talk-lean .5s ease-out',
  nod: 'talk-nod .9s ease-in-out',
  tilt: 'talk-tilt2 1.4s ease-in-out',
  sway: 'talk-sway2 1.6s ease-in-out',
  shrink: 'talk-shrink 1.1s ease-in-out',
};

export function Figure({
  look,
  face = 'normal',
  named,
  state = 'idle',
  motion,
  motionKey = 0,
  toward = 'right',
  height,
  chest = false,
  breath = 3.6,
  calm = false,
  reduced = false,
  lit = false,
  glow,
  level,
  className = '',
  style,
}: {
  look: TalkLook | null;
  face?: TalkFace;
  /** a named pose that wins over the face (a story line's painted gesture) */
  named?: TalkExpression | null;
  state?: FigureState;
  /** a reaction, played once each time motionKey changes */
  motion?: TalkMotion;
  motionKey?: number;
  /** which way the one they talk to is (they turn that way to listen) */
  toward?: 'left' | 'right';
  /** px: the full figure's height (chest: the visible part's) */
  height: number;
  /** chest up (the keyboard is up, or a big group) */
  chest?: boolean;
  /** seconds per breath */
  breath?: number;
  calm?: boolean;
  reduced?: boolean;
  /** steps forward (the one speaking in a group) */
  lit?: boolean;
  glow?: string;
  /** the voice's loudness 0..1 while a voice plays (else the flap runs by itself while talking) */
  level?: () => number;
  className?: string;
  style?: CSSProperties;
}) {
  // M-R240: two tiers — the plain standing face, and the expression's own pose when there is one (and it loads)
  const posed = talkPose(look, face);
  const poseOk = usePresent(posed?.kind === 'image' ? posed.url : undefined);
  const expr = named ?? (poseOk ? posed : null) ?? talkExpression(look, face);
  // a change of expression cross-fades (~0.2 s) with a small squash-and-recover at the switch
  const key = expr?.url ?? '';
  const lastExpr = useRef<TalkExpression | null>(expr);
  const [prev, setPrev] = useState<{ e: TalkExpression; n: number } | null>(null);
  useEffect(() => {
    const was = lastExpr.current;
    lastExpr.current = expr;
    if (!was || was.url === key || reduced) return;
    setPrev((p) => ({ e: was, n: (p?.n ?? 0) + 1 }));
    const t = setTimeout(() => setPrev(null), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // no blink while speaking (the prototype); the mouth swap does the work then
  const shut = useBlink(!!expr && expr.kind === 'image' && !!expr.blink && state !== 'talk');
  // a wide figure (a round {bati}) stands at 58% of the height, as in the prototype; every face is fetched ahead
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (!look?.stand) return;
    const i = new Image();
    i.onload = () => setWide(i.naturalWidth / i.naturalHeight > 0.9);
    i.src = look.stand;
    for (const e of Object.values(look.faces ?? {})) {
      if (e?.kind !== 'image') continue;
      for (const u of [e.url, e.blink, e.mouth]) if (u) new Image().src = u;
    }
    // the poses: fetched ahead too, and noted as there (or not) so a change of face swaps at once
    for (const p of Object.values(look.poses ?? {})) {
      if (!p) continue;
      for (const u of [p.url, p.blink, p.mouth]) {
        if (!u || present.has(u)) continue;
        const im = new Image();
        im.onload = () => present.set(u, true);
        im.onerror = () => present.set(u, false);
        im.src = u;
      }
    }
  }, [look]);
  // a wide one (a round creature) stands lower and, chest up, a little smaller (its whole width shows)
  height = wide ? height * (chest ? 0.72 : 0.58) : height;
  const open = useFlap(state === 'talk', level);
  const idle = useIdle(state === 'idle' && !reduced && !calm);
  const yawn = idle === 'yawn';
  const live = !reduced;
  const still = !live || calm;
  const dir = toward === 'right' ? 1 : -1;

  const outer: CSSProperties = { height, ...style };
  const pose =
    !live || calm
      ? undefined
      : state === 'listen'
        ? `talk-listen 2.2s ease-in-out infinite`
        : state === 'think'
          ? `talk-think 2.8s ease-in-out infinite`
          : idle === 'tilt'
            ? `talk-tilt 2.4s ease-in-out`
            : idle === 'look'
              ? `talk-look 3s ease-in-out`
              : yawn
                ? `talk-yawn 2.2s ease-in-out`
                : undefined;
  // the image's own box: everything inside is laid out in its fractions
  const img = (src: string, extra?: CSSProperties) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" draggable={false} className="block h-full w-auto max-w-none select-none" style={extra} />
  );

  return (
    <div className={`pointer-events-none relative flex flex-col items-center ${className}`} style={outer} aria-hidden>
      <div className="relative h-full overflow-visible" style={chest ? { overflow: 'hidden', WebkitMaskImage: 'linear-gradient(to bottom, #000 70%, transparent)', maskImage: 'linear-gradient(to bottom, #000 70%, transparent)' } : undefined}>
        {/* the shadow at the feet */}
        {!chest && <span className="absolute bottom-[-8px] left-1/2 h-[18px] w-[64%] -translate-x-1/2 rounded-[50%] blur-[2px]" style={{ background: 'radial-gradient(closest-side,rgba(0,0,0,.55),rgba(0,0,0,0))', opacity: lit ? 0.75 : 1 }} />}
        <div
          key={`m${motionKey}`}
          className="h-full origin-bottom"
          style={{
            ['--dir' as string]: dir,
            animation: live && motion && motion !== 'none' && motionKey ? REACTION[motion] : undefined,
            // the one speaking steps a little forward and larger
            transform: lit && live ? 'translateY(-6px) scale(1.03)' : undefined,
            transition: 'transform .35s ease',
            filter: glow ? `drop-shadow(0 0 10px ${glow}) drop-shadow(0 0 3px ${glow})` : undefined,
          }}
        >
          <div className="h-full origin-bottom" style={{ ['--dir' as string]: dir, animation: pose }}>
            <div className="h-full origin-bottom" style={{ animation: still && !calm ? undefined : `talk-breath ${breath}s ease-in-out infinite` }}>
              <div className="h-full" style={{ transform: open && live ? 'translateY(-0.8%) scaleY(1.006)' : undefined, transformOrigin: '50% 100%', transition: 'transform 70ms linear' }}>
                <div key={prev ? `sq${prev.n}` : 'still'} className="relative h-full origin-bottom" style={prev ? { animation: 'talk-squash .32s ease-out' } : undefined}>
                  {prev && (
                    <div className="absolute bottom-0 left-1/2 h-full -translate-x-1/2" style={{ animation: 'talk-fadeout .2s linear forwards' }}>
                      <Picture faceAt={faceBox(look)} expr={prev.e} img={img} chest={chest} height={height} shut={false} open={false} sway={false} breath={breath} />
                    </div>
                  )}
                  <div className="h-full" style={prev ? { animation: 'talk-fadein .2s linear' } : undefined}>
                    <Picture faceAt={faceBox(look)} expr={expr} img={img} chest={chest} height={height} shut={shut} open={open || yawn} sway={false} breath={breath} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Picture({ expr, img, chest, height, shut, open, sway, breath, faceAt }: { faceAt?: { x: number; y: number; w: number; h: number }; expr: TalkExpression | null; img: (src: string, s?: CSSProperties) => React.ReactNode; chest: boolean; height: number; shut: boolean; open: boolean; sway: boolean; breath: number }) {
  // chest up: the figure down to a little below the face, as tall as the box
  const fb = (expr?.kind === 'image' ? (expr.eyesBox ?? expr.mouthBox) : undefined) ?? faceAt;
  const crop = fb ? Math.min(1, Math.max(0.42, fb.y + fb.h + 0.26)) : 0.52;
  const box: CSSProperties = chest ? { height: height / crop } : { height: '100%' };
  if (!expr) return <div className="aspect-[3/5] h-full rounded-[40%] bg-white/10" style={box} />;
  if (expr.kind === 'video')
    return (
      // a members' add-on (M-R234 §7): the loop as it is
      <video src={expr.url} poster={expr.poster} autoPlay loop muted playsInline className="block h-full w-auto max-w-none" style={box} />
    );
  const at = (b?: { x: number; y: number; w: number; h: number }): CSSProperties =>
    b ? { position: 'absolute', left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` } : { position: 'absolute', inset: 0, width: '100%', height: '100%' };
  // the swaying top: the same picture, masked to the top and sheared from about the neck (ears, hair, hood tips)
  const swayAnim = sway ? `talk-sway ${(breath * 1.15).toFixed(2)}s ease-in-out infinite` : undefined;
  const top: CSSProperties = { transformOrigin: '50% 46%', animation: swayAnim };
  // the top copy is solid down to 30% and fades out by 42%; the still copy starts under its solid part (no see-through band)
  const mask = 'linear-gradient(to bottom, #000 0%, #000 30%, transparent 42%)';
  const under = 'linear-gradient(to bottom, transparent 24%, #000 25%)';
  // a part without a box is a whole picture (eyes closed / mouth open, aligned to the same body): it replaces the face
  const fullBlink = !!expr.blink && !expr.eyesBox && shut;
  const fullMouth = !!expr.mouth && !expr.mouthBox && open && !fullBlink;
  const hideBase = fullBlink || fullMouth;
  return (
    <div className="relative" style={box}>
      {img(expr.url, { height: '100%', opacity: hideBase ? 0 : 1, WebkitMaskImage: sway ? under : undefined, maskImage: sway ? under : undefined })}
      {sway && <div className="absolute inset-0" style={{ ...top, WebkitMaskImage: mask, maskImage: mask }}>{img(expr.url, { height: '100%' })}</div>}
      {/* the parts move with the top, so they stay on the face */}
      <div className="absolute inset-0" style={top}>
        {expr.blink && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={expr.blink} alt="" className="max-w-none select-none" style={{ ...at(expr.eyesBox), opacity: shut ? 1 : 0 }} />
        )}
        {expr.mouth && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={expr.mouth} alt="" className="max-w-none select-none" style={{ ...at(expr.mouthBox), opacity: expr.mouthBox ? (open ? 1 : 0) : fullMouth ? 1 : 0 }} />
        )}
      </div>
    </div>
  );
}

/** where the face is on this look (its plain face's eyes or mouth): every expression is cropped the same way */
function faceBox(look: TalkLook | null) {
  const n = look?.faces?.normal;
  return n?.kind === 'image' ? (n.eyesBox ?? n.mouthBox) : undefined;
}

const present = new Map<string, boolean>();
/** whether a picture exists (M-R240: the pose files come later — a missing one keeps the standing face) */
function usePresent(url?: string) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!url || present.has(url)) return;
    const i = new Image();
    i.onload = () => (present.set(url, true), force((x) => x + 1));
    i.onerror = () => (present.set(url, false), force((x) => x + 1));
    i.src = url;
  }, [url]);
  return !!url && present.get(url) === true;
}

/** blinks at random 2–6 s, now and then twice (true while shut) */
export function useBlink(on: boolean) {
  const [shut, setShut] = useState(false);
  useEffect(() => {
    if (!on) return;
    let t: ReturnType<typeof setTimeout>;
    const close = (then: () => void) => {
      setShut(true);
      t = setTimeout(() => {
        setShut(false);
        then();
      }, 110 + Math.random() * 50);
    };
    const loop = () => {
      t = setTimeout(() => close(() => (Math.random() < 0.22 ? (t = setTimeout(() => close(loop), 160)) : loop())), 2000 + Math.random() * 4000);
    };
    loop();
    return () => clearTimeout(t);
  }, [on]);
  return shut;
}

/** the lip flap: follows the voice's loudness, or runs by itself (open 90–170 ms, shut 70–150 ms) */
function useFlap(talking: boolean, level?: () => number) {
  const [open, setOpen] = useState(false);
  const lv = useRef(level);
  lv.current = level;
  useEffect(() => {
    if (!talking) return setOpen(false);
    let t: ReturnType<typeof setTimeout>;
    let raf = 0;
    if (lv.current) {
      let cur = false;
      let last = 0;
      const tick = (now: number) => {
        const want = (lv.current?.() ?? 0) > 0.12;
        if (want !== cur && now - last > 70) {
          cur = want;
          last = now;
          setOpen(want);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    let cur = false;
    const step = () => {
      cur = !cur;
      setOpen(cur);
      // a little pause between "words" now and then
      t = setTimeout(step, cur ? 90 + Math.random() * 80 : Math.random() < 0.12 ? 260 : 70 + Math.random() * 80);
    };
    step();
    return () => clearTimeout(t);
  }, [talking]);
  return open;
}

/** quiet a while: now and then a tilt, a look round or a yawn (null in between) */
function useIdle(on: boolean) {
  const [act, setAct] = useState<'tilt' | 'look' | 'yawn' | null>(null);
  useEffect(() => {
    if (!on) return setAct(null);
    let t: ReturnType<typeof setTimeout>;
    const loop = (first: boolean) => {
      t = setTimeout(
        () => {
          const r = Math.random();
          setAct(r < 0.45 ? 'tilt' : r < 0.85 ? 'look' : 'yawn');
          t = setTimeout(() => {
            setAct(null);
            loop(false);
          }, 3100);
        },
        (first ? 7000 : 6000) + Math.random() * 7000,
      );
    };
    loop(true);
    return () => clearTimeout(t);
  }, [on]);
  return act;
}

/** the keyframes the figures and the ring use (put once in the talk) */
export const TALK_CSS = `
@keyframes talk-breath { 0%,100% { transform: scale(1,1) } 50% { transform: scale(1.008,1.018) } }
@keyframes talk-shadow { 0%,100% { transform: translateX(-50%) scaleX(1) } 50% { transform: translateX(-50%) scaleX(1.03) } }
@keyframes talk-sway { 0%,100% { transform: skewX(0deg) } 30% { transform: skewX(1.3deg) } 70% { transform: skewX(-1.1deg) } }
@keyframes talk-listen { 0%,100% { transform: translateX(calc(var(--dir) * 3px)) rotate(calc(var(--dir) * 1.6deg)) } 35% { transform: translateX(calc(var(--dir) * 3px)) rotate(calc(var(--dir) * 1.6deg)) translateY(1.2%) } 55% { transform: translateX(calc(var(--dir) * 3px)) rotate(calc(var(--dir) * 2.4deg)) } }
@keyframes talk-think { 0%,100% { transform: rotate(-1.6deg) } 50% { transform: rotate(1.6deg) } }
@keyframes talk-tilt { 0%,100% { transform: rotate(0) } 30%,70% { transform: rotate(calc(var(--dir) * 3.5deg)) } }
@keyframes talk-look { 0%,100% { transform: translateX(0) } 25%,40% { transform: translateX(-4px) rotate(-1.5deg) } 60%,75% { transform: translateX(4px) rotate(1.5deg) } }
@keyframes talk-yawn { 0%,100% { transform: scale(1,1) } 40%,60% { transform: scale(0.99,1.03) } }
@keyframes talk-hop { 0% { transform: translateY(0) } 40% { transform: translateY(-22px) } 100% { transform: translateY(0) } }
@keyframes talk-lean { 0% { transform: translateX(0) rotate(0) } 40% { transform: translateX(calc(var(--dir) * -6px)) rotate(calc(var(--dir) * -4deg)) } 100% { transform: none } }
@keyframes talk-nod { 0%,100% { transform: translateY(0) } 30% { transform: translateY(5px) } 60% { transform: translateY(0) } 80% { transform: translateY(3px) } }
@keyframes talk-tilt2 { 0%,100% { transform: rotate(0) } 15%,80% { transform: rotate(calc(var(--dir) * -5deg)) } }
@keyframes talk-sway2 { 0%,100% { transform: rotate(0) } 25% { transform: rotate(3deg) } 75% { transform: rotate(-3deg) } }
@keyframes talk-shrink { 0%,100% { transform: scale(1) } 30%,70% { transform: scale(0.96,0.94) } }
@keyframes talk-ring { 0%,100% { transform: rotate(-5deg) } 50% { transform: rotate(5deg) } }
@keyframes talk-ring-up { 0%,100% { transform: rotate(5deg) } 50% { transform: rotate(-5deg) } }
@keyframes talk-in { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
@keyframes talk-shrinkin { 0% { opacity: 0; transform: translate(var(--fx), var(--fy)) scale(3.2) } 60% { opacity: 1 } 100% { opacity: 1; transform: none } }
@keyframes talk-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
@keyframes talk-kohop { 0%,86%,100% { transform: translateY(0) } 91% { transform: translateY(-9px) } }
@keyframes talk-koin { from { transform: translateX(-50%) scale(.4); opacity: 0 } to { transform: translateX(-50%) scale(1); opacity: 1 } }
@keyframes talk-fly { from { transform: none; opacity: .86 } to { transform: translateY(-120px) scale(.2); opacity: 0 } }
@keyframes talk-caret { 50% { opacity: 0 } }
@keyframes talk-slam { 0% { transform: scale(1.9) rotate(-5deg); opacity: 0 } 45% { transform: scale(.9) rotate(2deg); opacity: 1 } 70% { transform: scale(1.05) rotate(-1deg) } 100% { transform: none } }
@keyframes talk-slowin { from { transform: translateY(12px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes talk-shakeb { 0%,100% { transform: none } 20% { transform: translateX(-6px) rotate(-1deg) } 40% { transform: translateX(5px) rotate(1deg) } 60% { transform: translateX(-3px) } 80% { transform: translateX(2px) } }
@keyframes talk-quake0 { 0%,100% { transform: none } 25% { transform: translate(2px,-2px) } 50% { transform: translate(-2px,2px) } 75% { transform: translate(1px,1px) } }
@keyframes talk-quake1 { 0%,100% { transform: none } 25% { transform: translate(2px,-2px) } 50% { transform: translate(-2px,2px) } 75% { transform: translate(1px,1px) } }
@keyframes talk-fadeout { to { opacity: 0 } }
@keyframes talk-arrive { 0% { opacity: 0; filter: brightness(2.6) blur(6px); transform: translateX(-50%) scale(.96) } 55% { opacity: 1; filter: brightness(1.6) blur(1px) } 100% { opacity: 1; filter: none; transform: translateX(-50%) } }
@keyframes talk-gather { 0% { opacity: 0; transform: translate(var(--mx), var(--my)) scale(1.4) } 30% { opacity: 1 } 100% { opacity: 0; transform: translate(0,0) scale(.5) } }
@keyframes talk-fadein { from { opacity: 0 } to { opacity: 1 } }
@keyframes talk-camdrift { from { transform: none } to { transform: scale(var(--cd, 1.035)) } }
@keyframes talk-camshake { 0%,100% { translate: 0 0 } 20% { translate: -7px 3px } 40% { translate: 6px -3px } 60% { translate: -4px 2px } 80% { translate: 2px -1px } }
@keyframes talk-enter { from { transform: translateX(var(--ex, -200px)); opacity: 0 } 30% { opacity: 1 } to { transform: none; opacity: 1 } }
@keyframes talk-exit { from { transform: none; opacity: 1 } 70% { opacity: 1 } to { transform: translateX(var(--ex, -200px)); opacity: 0 } }
@keyframes talk-pulse { 0%,100% { box-shadow: 0 0 0 6px rgba(223,230,255,.16),0 0 32px rgba(160,180,255,.55) } 50% { box-shadow: 0 0 0 14px rgba(223,230,255,.08),0 0 48px rgba(160,180,255,.8) } }
@keyframes talk-squash { 0% { transform: scale(1,1) } 35% { transform: scale(1.04,.95) } 70% { transform: scale(.98,1.03) } 100% { transform: scale(1,1) } }
@keyframes talk-pop { 0% { transform: scale(1); opacity: 1 } 40% { transform: scale(1.35); opacity: 1 } 100% { transform: scale(1.7); opacity: 0 } }
@keyframes talk-roll { 0% { transform: translateX(-26px) rotate(-300deg) scale(.4); opacity: 0 } 70% { opacity: 1 } 100% { transform: none; opacity: 1 } }
@keyframes talk-drift { from { transform: translate3d(0,0,0) scale(1.02) } to { transform: translate3d(-2%,1%,0) scale(1.06) } }
`;
