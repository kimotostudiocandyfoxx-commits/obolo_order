'use client';

import { talkExpression, type TalkExpression, type TalkFace, type TalkLook, type TalkMotion } from '@obolo/shared';
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
const REACTION: Record<TalkMotion, string> = { none: '', hop: 'talk-hop', lean: 'talk-lean', nod: 'talk-nod', tilt: 'talk-tilt2', sway: 'talk-sway2', shrink: 'talk-shrink' };

export function Figure({
  look,
  face = 'normal',
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
  const expr = talkExpression(look, face);
  const shut = useBlink(!!expr && expr.kind === 'image' && !!expr.blink);
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
      <div className="relative h-full overflow-visible" style={chest ? { overflow: 'hidden', borderRadius: '0 0 40% 40% / 0 0 10% 10%' } : undefined}>
        {/* the shadow at the feet */}
        {!chest && <span className="absolute bottom-[-2%] left-1/2 h-[5%] w-[70%] -translate-x-1/2 rounded-[50%] bg-black/45 blur-[3px]" style={live && !calm ? { animation: `talk-shadow ${breath}s ease-in-out infinite` } : undefined} />}
        <div
          key={`m${motionKey}`}
          className="h-full origin-bottom"
          style={{
            ['--dir' as string]: dir,
            animation: live && motion && motion !== 'none' && motionKey ? `${REACTION[motion]} ${motion === 'hop' ? 0.7 : 1.1}s cubic-bezier(.3,1.3,.5,1)` : undefined,
            transform: lit ? 'translateY(2%) scale(1.06)' : undefined,
            transition: 'transform .35s ease',
            filter: glow ? `drop-shadow(0 0 10px ${glow}) drop-shadow(0 0 3px ${glow})` : undefined,
          }}
        >
          <div className="h-full origin-bottom" style={{ ['--dir' as string]: dir, animation: pose }}>
            <div className="h-full origin-bottom" style={{ animation: still && !calm ? undefined : `talk-breath ${breath}s ease-in-out infinite` }}>
              <div className="h-full" style={{ transform: open && live ? 'translateY(-0.8%) scaleY(1.006)' : undefined, transformOrigin: '50% 100%', transition: 'transform 70ms linear' }}>
                <Picture faceAt={faceBox(look)} expr={expr} img={img} chest={chest} height={height} shut={shut} open={open || yawn} sway={live && !calm} breath={breath} />
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
  return (
    <div className="relative" style={box}>
      {img(expr.url, { height: '100%', WebkitMaskImage: sway ? under : undefined, maskImage: sway ? under : undefined })}
      {sway && <div className="absolute inset-0" style={{ ...top, WebkitMaskImage: mask, maskImage: mask }}>{img(expr.url, { height: '100%' })}</div>}
      {/* the parts move with the top, so they stay on the face */}
      <div className="absolute inset-0" style={top}>
        {expr.blink && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={expr.blink} alt="" className="max-w-none select-none" style={{ ...at(expr.eyesBox), opacity: shut ? 1 : 0 }} />
        )}
        {expr.mouth && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={expr.mouth} alt="" className="max-w-none select-none" style={{ ...at(expr.mouthBox), opacity: open ? 1 : 0 }} />
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
@keyframes talk-breath { 0%,100% { transform: scale(1,1) } 50% { transform: scale(1.006,1.014) } }
@keyframes talk-shadow { 0%,100% { transform: translateX(-50%) scaleX(1) } 50% { transform: translateX(-50%) scaleX(1.03) } }
@keyframes talk-sway { 0%,100% { transform: skewX(0deg) } 30% { transform: skewX(1.3deg) } 70% { transform: skewX(-1.1deg) } }
@keyframes talk-listen { 0%,100% { transform: translateX(calc(var(--dir) * 3px)) rotate(calc(var(--dir) * 1.6deg)) } 35% { transform: translateX(calc(var(--dir) * 3px)) rotate(calc(var(--dir) * 1.6deg)) translateY(1.2%) } 55% { transform: translateX(calc(var(--dir) * 3px)) rotate(calc(var(--dir) * 2.4deg)) } }
@keyframes talk-think { 0%,100% { transform: rotate(-1.6deg) } 50% { transform: rotate(1.6deg) } }
@keyframes talk-tilt { 0%,100% { transform: rotate(0) } 30%,70% { transform: rotate(calc(var(--dir) * 3.5deg)) } }
@keyframes talk-look { 0%,100% { transform: translateX(0) } 25%,40% { transform: translateX(-4px) rotate(-1.5deg) } 60%,75% { transform: translateX(4px) rotate(1.5deg) } }
@keyframes talk-yawn { 0%,100% { transform: scale(1,1) } 40%,60% { transform: scale(0.99,1.03) } }
@keyframes talk-hop { 0%,100% { transform: translateY(0) } 15% { transform: translateY(1.5%) scale(1.03,0.96) } 45% { transform: translateY(-9%) scale(0.98,1.03) } 75% { transform: translateY(0.8%) scale(1.02,0.98) } }
@keyframes talk-lean { 0%,100% { transform: rotate(0) } 25%,55% { transform: rotate(calc(var(--dir) * -5deg)) translateX(calc(var(--dir) * -5px)) } }
@keyframes talk-nod { 0%,100% { transform: translateY(0) } 25%,75% { transform: translateY(1.8%) rotate(calc(var(--dir) * 1deg)) } 50% { transform: translateY(0) } }
@keyframes talk-tilt2 { 0%,100% { transform: rotate(0) } 40%,70% { transform: rotate(calc(var(--dir) * 6deg)) } }
@keyframes talk-sway2 { 0%,100% { transform: rotate(0) } 25% { transform: rotate(3deg) } 75% { transform: rotate(-3deg) } }
@keyframes talk-shrink { 0%,100% { transform: scale(1) } 30%,70% { transform: scale(0.96,0.94) } }
@keyframes talk-ring { 0%,100% { transform: rotate(-5deg) } 50% { transform: rotate(5deg) } }
@keyframes talk-ring-up { 0%,100% { transform: rotate(5deg) } 50% { transform: rotate(-5deg) } }
@keyframes talk-in { 0% { opacity: 0; transform: translateY(14px) scale(.92) } 100% { opacity: 1; transform: none } }
@keyframes talk-shrinkin { 0% { opacity: 0; transform: translate(var(--fx), var(--fy)) scale(3.2) } 60% { opacity: 1 } 100% { opacity: 1; transform: none } }
@keyframes talk-bob { 0%,100% { transform: translateY(0) rotate(-3deg) } 50% { transform: translateY(-3px) rotate(3deg) } }
@keyframes talk-kohop { 0%,86%,100% { transform: translateY(0) } 91% { transform: translateY(-9px) } }
@keyframes talk-pop { 0% { transform: scale(1); opacity: 1 } 40% { transform: scale(1.35); opacity: 1 } 100% { transform: scale(1.7); opacity: 0 } }
@keyframes talk-roll { 0% { transform: translateX(-26px) rotate(-300deg) scale(.4); opacity: 0 } 70% { opacity: 1 } 100% { transform: none; opacity: 1 } }
@keyframes talk-drift { 0% { transform: translate3d(-1.5%, 0, 0) scale(1.08) } 100% { transform: translate3d(1.5%, -1%, 0) scale(1.08) } }
`;
