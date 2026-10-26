'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MOTION } from '@/lib/story/motion';
import LAYERS from '@/lib/story/sprite-layers.json';

/** a small motion that goes with a line (lib/story/expression.ts reactFor) */
export type Reaction = 'shock' | 'stare' | 'tremble';

/**
 * The story's stage (production UI 3–4, 11–12, 2026-10-15). Layers, back to front:
 *   background (far / mid / near) → characters → effects → words → UI
 * Characters: the one speaking is lit, the others step back into the dark. When several are on stage and
 * one speaks, the camera cuts to that one's bust-up, and the background changes with the cut (blurred,
 * tinted with that character's colour). While a voice plays the speaker's mouth moves (a small bob, or a
 * mouth picture when the character has one) and now and then the eyes blink.
 * Only position, scale and opacity animate (lightness rule).
 */
export interface CharSpec {
  /** where the feet stand (from the bottom) and how tall, in % of the screen */
  bottom: number;
  height: number;
  /** the face's height in the picture (0–1 from the top): the bust-up zooms here */
  face: number;
  /** the character's colour for the bust-up background */
  tint: string;
  /** a glowing eye that blinks and pulses with the voice (x, y in the picture, 0–1) */
  eye?: [number, number];
  /** how far the bust-up may zoom (small round characters stay small) */
  bustMax?: number;
  /** pictures for expressions: name → file (onboarding/<file>.webp) */
  faces?: Record<string, string>;
}

/** the expression / pose pictures made so far (onboarding/<char>-x-<expr>.webp, lib/story/expression.ts) */
const facesOf = (stem: string, exprs: string[]) => Object.fromEntries(exprs.map((e) => [e, `${stem}-${e}`]));
const POSES = ['talk', 'lecture', 'joy', 'point', 'shock', 'smug', 'tears', 'think'];
/** pictures that have been cut into layers (scripts/sprite-layers.py) — for the newer casts, only those */
const madeFaces = (stem: string, exprs: string[]) => facesOf(stem, exprs.filter((e) => `${stem}-${e}` in LAYERS));
/**
 * KIMORIN after the dragon (the small wing): from the Moon on his round sunglasses are over his eyes (story
 * M-R112) — the sunglasses-on poses as they are cut, the sunglasses-up ones (eyes glowing) for the rest
 */
const KIMORIN_FACES = { ...facesOf('kimorin-x', POSES), ...madeFaces('kimorin-xs', POSES) };
const MONBAN_FACES = facesOf('monban-x', ['talk', 'point', 'arms', 'stop']);
const FRIEND = ['talk', 'joy', 'shock'];

const CHAR: Record<string, CharSpec> = {
  // MONBAN's glowing eye is placed on the standing picture; on the pose pictures the eye is painted in
  monban: { bottom: 8, height: 74, face: 0.24, tint: '#c99a4a', eye: [0.507, 0.225], faces: MONBAN_FACES },
  'kimorin-sun': { bottom: 10, height: 58, face: 0.22, tint: '#8a3a2e', faces: KIMORIN_FACES },
  // KIMORIN before the dragon (no wing) and at the gate (sunglasses on, no eye glow)
  'kimorin-n': { bottom: 10, height: 58, face: 0.22, tint: '#8a3a2e', faces: facesOf('kimorin-n', POSES) },
  'kimorin-g': { bottom: 10, height: 58, face: 0.22, tint: '#8a3a2e', faces: facesOf('kimorin-g', POSES) },
  // KIMORIN's first look, the suspicious inventor (story M-R100): goggles on at the gate, pushed up from the
  // startle in the Earth temple until the Moon
  'kimorin-i': { bottom: 10, height: 58, face: 0.22, tint: '#b8b0a0', faces: madeFaces('kimorin-i', POSES) },
  'kimorin-iu': { bottom: 10, height: 58, face: 0.22, tint: '#b8b0a0', faces: madeFaces('kimorin-iu', POSES) },
  kimorin: { bottom: 10, height: 58, face: 0.22, tint: '#8a3a2e' },
  'kimorin-1': { bottom: 10, height: 58, face: 0.22, tint: '#8a3a2e' },
  'kimorin-2': { bottom: 10, height: 58, face: 0.22, tint: '#8a3a2e' },
  'kimorin-3': { bottom: 10, height: 58, face: 0.22, tint: '#8a3a2e' },
  'kimorin-8': { bottom: 10, height: 58, face: 0.22, tint: '#8a3a2e' },
  'kimorin-dragon': { bottom: 14, height: 70, face: 0.2, tint: '#7a2a20' },
  obolon: { bottom: 38, height: 28, face: 0.5, tint: '#d8b56a', bustMax: 1.35 },
  'takoyaki-brother': { bottom: 10, height: 60, face: 0.25, tint: '#d36a2a', faces: madeFaces('takoyaki-brother-x', FRIEND) },
  'takoyaki-sister': { bottom: 10, height: 60, face: 0.25, tint: '#d35a8a', faces: madeFaces('takoyaki-sister-x', FRIEND) },
  'daikon-kaiser': { bottom: 8, height: 70, face: 0.2, tint: '#7aa84a', faces: madeFaces('daikon-kaiser-x', FRIEND) },
  // the Kaiser grows each journey (client 2026-10-26): 1 the stern daikon on its roots (design/story/refs/cast/kaiser-journey1*)
  kaiser1: { bottom: 6, height: 72, face: 0.35, tint: '#7aa84a', faces: madeFaces('kaiser1-x', FRIEND) },
  freezy: { bottom: 8, height: 64, face: 0.25, tint: '#5aa8d8', faces: madeFaces('freezy-x', FRIEND) },
  hipokin: { bottom: 8, height: 70, face: 0.2, tint: '#c8504a', faces: madeFaces('hipokin-x', FRIEND) },
  'unchi-pinpon': { bottom: 22, height: 26, face: 0.4, tint: '#c89a5a', bustMax: 1.4, faces: madeFaces('unchi-pinpon-x', FRIEND) },
};
const DEFAULT: CharSpec = { bottom: 12, height: 58, face: 0.25, tint: '#b08a4a' };
export const charSpec = (name: string): CharSpec => CHAR[name] ?? (name.startsWith('@') ? { bottom: 30, height: 34, face: 0.45, tint: '#9a7ac8' } : DEFAULT);

/** Which picture on stage is the one who speaks. */
const SPEAKER: Record<string, string[]> = {
  MONBAN: ['monban'],
  KIMORIN: ['kimorin-sun', 'kimorin-n', 'kimorin-g', 'kimorin-i', 'kimorin-iu', 'kimorin', 'kimorin-1', 'kimorin-2', 'kimorin-3', 'kimorin-8', 'kimorin-dragon'],
  'KIMORIN⭐︎': ['kimorin-sun', 'kimorin', 'kimorin-1'],
  OBOLON: ['obolon'],
  バティ: ['@bati', '@bati-weak'],
  たこ焼きブラザー: ['takoyaki-brother'],
  たこ焼きシスター: ['takoyaki-sister'],
  大根カイザー: ['kaiser1', 'daikon-kaiser'],
  フリージー: ['freezy'],
  ヒポキン: ['hipokin'],
  うんちピンポンくん: ['unchi-pinpon'],
};
/** The one speaking is not among the pictures on stage (in the video, or off screen). */
export const OFFSTAGE = '__offstage__';
export function speakerSprite(who: string | null | undefined, names: string[]): string | null {
  if (!who) return null;
  return (SPEAKER[who] ?? []).find((n) => names.includes(n)) ?? OFFSTAGE;
}

/** Blinks every few seconds (true while the eyes are shut). */
function useBlink(on: boolean) {
  const [shut, setShut] = useState(false);
  useEffect(() => {
    if (!on) return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(
        () => {
          setShut(true);
          t = setTimeout(() => {
            setShut(false);
            loop();
          }, 130);
        },
        2600 + Math.random() * 3200,
      );
    };
    loop();
    return () => clearTimeout(t);
  }, [on]);
  return shut;
}

export function Cast({
  names,
  src,
  speaking,
  talking,
  expressions = {},
  level,
  react,
  slot,
  className = '',
}: {
  /** the voice's loudness now (lip sync) */
  level?: () => number;
  /** the speaker's reaction to the line */
  react?: Reaction;
  names: string[];
  src: (name: string) => string | null;
  /** the picture of the one speaking now (null = nobody) */
  speaking: string | null;
  /** a voice is playing */
  talking: boolean;
  /** 〔表情：…〕 per picture */
  expressions?: Record<string, string>;
  /** spreads several characters across the screen */
  slot: (k: number, n: number) => CSSProperties;
  className?: string;
}) {
  // '' keeps a slot empty (someone in the video stands there); the one speaking may be off the cast
  // (OFFSTAGE: in the video) — then everyone on the cast steps back
  const real = names.filter(Boolean);
  const bust = (real.length > 1 || (MOTION.soloBust && real.includes(speaking ?? ''))) && !!speaking && speaking !== OFFSTAGE;
  const tint = speaking ? charSpec(speaking).tint : '#000';
  // MONBAN comes and goes with black smoke
  const [smoke, setSmoke] = useState(0);
  const hadMonban = useRef(real.includes('monban'));
  useEffect(() => {
    const has = real.includes('monban');
    if (has !== hadMonban.current) setSmoke((k) => k + 1);
    hadMonban.current = has;
  }, [real]);
  return (
    <>
      {smoke > 0 && <Smoke key={smoke} />}
      {/* the bust-up's background: the scene behind goes soft and takes the speaker's colour */}
      <div
        className="pointer-events-none absolute inset-0 z-[3] transition-opacity duration-300"
        style={{ opacity: bust ? 1 : 0, backdropFilter: 'blur(7px) brightness(0.55)', WebkitBackdropFilter: 'blur(7px) brightness(0.55)', background: `radial-gradient(ellipse at 50% 38%, ${tint}55 0%, transparent 62%), linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55))` }}
        aria-hidden
      />
      {names.map((name, k) => {
        if (!name) return null;
        const url = src(name);
        if (!url) return null;
        return (
          <Character
            key={name}
            name={name}
            url={expressions[name] && charSpec(name).faces?.[expressions[name]] ? `/onboarding/${charSpec(name).faces![expressions[name]]}.webp` : url}
            posed={!!(expressions[name] && charSpec(name).faces?.[expressions[name]])}
            lit={!speaking || speaking === name}
            bust={bust && speaking === name}
            hidden={bust && speaking !== name}
            talking={talking && speaking === name}
            level={level}
            react={speaking === name ? react : undefined}
            // beside someone in the video ('' slot): a little smaller, kept inside the screen
            style={real.length < names.length ? { left: `${names.length === 2 ? [30, 70][k] : [22, 50, 78][k] ?? 50}%` } : slot(k, names.length)}
            scale={real.length < names.length ? 0.74 : 1}
            className={className}
          />
        );
      })}
    </>
  );
}

/** the parts a layered pose has (scripts/sprite-layers.py writes the list) */
const layersOf = (url: string): string[] => {
  const stem = url.match(/\/onboarding\/([^/]+)\.webp$/)?.[1];
  return (stem && (LAYERS as Record<string, string[]>)[stem]) || [];
};

function Character({ name, url, posed, lit, bust, hidden, talking, level, react, style, className, scale = 1 }: { name: string; url: string; posed?: boolean; lit: boolean; bust: boolean; hidden: boolean; talking: boolean; level?: () => number; react?: Reaction; style: CSSProperties; className: string; scale?: number }) {
  const base = charSpec(name);
  const spec = { ...base, height: base.height * scale };
  const shut = useBlink(!!spec.eye && !posed);
  const own = name.startsWith('@') && name !== '@egg';
  const parts = layersOf(url);
  const layer = (k: string) => (parts.includes(k) ? url.replace(/\.webp$/, `-${k}.webp`) : null);
  const mouth = layer('mouth');
  // lip sync: the open-mouth patch follows the voice's loudness (held a moment so it does not flicker)
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!talking || !mouth || !level) return setOpen(false);
    let raf = 0;
    let last = 0;
    let cur = false;
    const tick = (t: number) => {
      const want = level() > MOTION.lip.open;
      if (want !== cur && t - last > MOTION.lip.holdMs) {
        cur = want;
        last = t;
        setOpen(want);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [talking, mouth, level]);
  // the speaker takes the floor: a small hop (once each time this one starts speaking among others)
  const [hop, setHop] = useState(0);
  const wasLit = useRef(lit);
  useEffect(() => {
    if (lit && !wasLit.current) setHop((h) => h + 1);
    wasLit.current = lit;
  }, [lit]);
  // the bust-up: the same picture, bigger, its face near the upper third of the screen
  const zoom = bust ? Math.min(spec.bustMax ?? 1.75, 62 / (spec.height * Math.max(0.35, 1 - spec.face * 1.6))) : 1;
  const box: CSSProperties = {
    ...style,
    ...(bust ? { left: '50%', maxWidth: '96%' } : {}),
    bottom: `${spec.bottom}%`,
    height: `${spec.height}%`,
    transformOrigin: `50% ${spec.face * 100}%`,
    transform: `translateX(-50%) translateY(${bust ? `${-12 - (spec.face - 0.2) * 40}%` : '0'}) scale(${zoom})`,
    opacity: hidden ? 0 : 1,
    transition: 'transform 320ms cubic-bezier(.2,.8,.2,1), opacity 260ms ease-out, left 320ms ease-out',
  };
  const dim = lit ? 'none' : `brightness(${MOTION.dim.brightness}) saturate(${MOTION.dim.saturate})`;
  const img = `h-full w-auto max-w-none select-none object-contain`;
  // breathing while quiet; the reaction of the line on top
  const life: CSSProperties = {
    ['--breath' as string]: `${MOTION.breath.amount / 100}`,
    ['--hop' as string]: `${-MOTION.hop.height}%`,
    ['--jump' as string]: `${-MOTION.react.shock.jump}%`,
    ['--trem' as string]: `${MOTION.react.tremble.px}px`,
    ['--stare' as string]: `${MOTION.react.stare.zoom}`,
    transformOrigin: '50% 100%',
    animation:
      react === 'shock'
        ? `reactJump ${MOTION.react.shock.ms}ms cubic-bezier(.2,1.6,.4,1)`
        : react === 'tremble'
          ? `reactTremble ${MOTION.react.tremble.ms}ms linear 8`
          : react === 'stare'
            ? `reactStare ${MOTION.react.stare.ms}ms ease-out forwards`
            : !talking && MOTION.breath.amount
              ? `breathe ${MOTION.breath.period}ms ease-in-out infinite`
              : undefined,
  };
  return (
    <div className={`pointer-events-none absolute z-[4] aspect-auto ${className}`} style={box} aria-hidden>
      <div key={hop} className="relative h-full" style={hop ? { animation: `hop ${MOTION.hop.ms}ms cubic-bezier(.3,1.5,.5,1)`, ['--hop' as string]: `${-MOTION.hop.height}%` } : undefined}>
        <div className="relative h-full" style={{ ...life, ...(talking && !mouth ? { animation: 'lipBob 0.22s ease-in-out infinite' } : {}) }}>
          <div key={url} className={`relative h-full drop-shadow-[0_18px_40px_rgba(0,0,0,0.6)] ${posed ? 'animate-[poseIn_0.28s_cubic-bezier(.2,1.4,.4,1)]' : ''}`} style={{ filter: dim }}>
            {layer('tail') && (
              // the tail feathers sway on their own, behind the body
              // eslint-disable-next-line @next/next/no-img-element
              <img src={layer('tail')!} alt="" draggable={false} className={`absolute inset-0 ${img}`} style={{ transformOrigin: '50% 78%', animation: MOTION.tail.deg ? `tailSway ${MOTION.tail.period}ms ease-in-out infinite` : undefined, ['--tail' as string]: `${MOTION.tail.deg}deg` }} />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={layer('body') ?? url} alt="" draggable={false} className={`relative ${img} ${own ? 'rounded-[2rem] border-2 border-amber-200/50' : ''}`} />
            {mouth && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mouth} alt="" draggable={false} className={`absolute inset-0 ${img}`} style={{ opacity: open ? 1 : 0 }} />
            )}
            {layer('eyes') && (
              // KIMORIN's eye slits: a glow that breathes (the sunglasses poses have none)
              // eslint-disable-next-line @next/next/no-img-element
              <img src={layer('eyes')!} alt="" draggable={false} className={`absolute inset-0 ${img}`} style={{ animation: `eyeGlow ${MOTION.eyes.period}ms ease-in-out infinite`, ['--eyeMin' as string]: `${MOTION.eyes.min}`, ['--eyeMax' as string]: `${MOTION.eyes.max}` }} />
            )}
          </div>
          {spec.eye && !posed && (
            <span
              className="absolute h-[3.2%] w-[7%] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-100"
              style={{
                left: `${spec.eye[0] * 100}%`,
                top: `${spec.eye[1] * 100}%`,
                background: 'radial-gradient(circle, rgba(255,236,170,0.95) 0%, rgba(255,190,80,0.55) 40%, transparent 72%)',
                opacity: shut ? 0 : talking ? 1 : lit ? 0.55 : 0.2,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** 〔カットイン：…〕 a character slides across a gold band for a moment. */
export function CutIn({ url, onDone }: { url: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[30%] z-[8] h-[26%] overflow-hidden" aria-hidden>
      <div className="absolute inset-0 animate-[cutinSlide_1.5s_ease-out_forwards] bg-[linear-gradient(90deg,transparent,rgba(30,20,8,0.92)_12%,rgba(30,20,8,0.92)_88%,transparent)]">
        <div className="absolute inset-x-0 top-0 h-px bg-amber-200/80 shadow-[0_0_12px_rgba(255,210,120,0.9)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-amber-200/80 shadow-[0_0_12px_rgba(255,210,120,0.9)]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="absolute left-1/2 top-0 h-[260%] -translate-x-1/2 object-contain object-top" />
      </div>
    </div>
  );
}

/** 〔登場：煙〕 black smoke wells up where someone appears. */
export function Smoke() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
      {[0, 1, 2, 3, 4].map((k) => (
        <span
          key={k}
          className="absolute bottom-[8%] block h-[46%] w-[70%] rounded-full"
          style={{
            left: `${38 + (k - 2) * 7}%`,
            background: 'radial-gradient(ellipse at center, rgba(8,6,10,0.95) 0%, rgba(20,16,24,0.7) 40%, transparent 70%)',
            animation: `smokeRise 1.8s ease-out ${k * 0.12}s forwards`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}

/** Gold motes drifting up (at most 150 at once — lightness rule). */
export function Motes({ count = 40 }: { count?: number }) {
  const n = Math.min(150, count);
  // placed after mounting (random positions would differ between the server's HTML and the browser)
  const [motes, setMotes] = useState<{ left: number; top: number; size: number; dur: number; delay: number }[]>([]);
  useEffect(() => {
    setMotes(
      Array.from({ length: n }, () => ({
        left: Math.random() * 100,
        top: 70 + Math.random() * 40,
        size: 1.5 + Math.random() * 2.5,
        dur: 9 + Math.random() * 10,
        delay: -Math.random() * 18,
      })),
    );
  }, [n]);
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
      {motes.map((m, k) => (
        <span
          key={k}
          className="absolute block rounded-full bg-amber-100"
          style={{ left: `${m.left}%`, top: `${m.top}%`, width: m.size, height: m.size, boxShadow: '0 0 6px 1px rgba(255,214,140,0.8)', animation: `moteRise ${m.dur}s linear ${m.delay}s infinite` }}
        />
      ))}
    </div>
  );
}

/** 〔カメラ：寄る／引く／揺れ〕 on whatever is inside (the background layers). */
export function Camera({ move, focus = '50% 40%', children }: { move: 'in' | 'out' | 'shake' | null; focus?: string; children: ReactNode }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        transformOrigin: focus,
        transform: move === 'in' ? 'scale(1.18)' : 'scale(1)',
        transition: 'transform 700ms cubic-bezier(.2,.7,.2,1)',
        animation: move === 'shake' ? 'camShake 0.5s ease-in-out 2' : undefined,
      }}
    >
      {children}
    </div>
  );
}
