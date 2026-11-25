'use client';

import { useEffect, type CSSProperties, type ReactNode } from 'react';
import type { SpellTag } from '@obolo/shared';

/**
 * Client 2026-11-24: 「スペルの札をもっと魔法っぽく — 木札よりキョンシーのおでこのお札みたいに。文字も。何パターンか見せて」.
 * Five talisman looks for the spell card (all approved 2026-11-25; the 木札 is gone): the work kind picks one
 * (SPELL_LOOK_BY_KIND). Each look brings its own tag, card frame, mana line, chip style, motions (in / away) and one Google Font
 * (OFL), loaded only when that look is shown.
 *   A reifu     霊符 — the jiangshi talisman: long yellow strips, cinnabar brush, 勅令 and a 月 seal, red glow; burns away
 *   B tenfu     天符 — celestial ofuda: night-indigo paper, gold leaf rule, crescent and stars, glowing gold; turns to stardust
 *   C rune      ルーン巻物 — tiny parchment scrolls on rods, burnt edges, rune lines, ink with a violet shimmer; burns away
 *   D hikari    光符 — paper lit from within (the bowl's water light), floating with a slow bob; melts into light (Yusei Magic)
 *   E jufu      呪符 — black lacquer slips with vermilion letters and a turning magic circle, on washi; stamped on, peeled off
 */
export const SPELL_LOOKS = ['reifu', 'tenfu', 'rune', 'hikari', 'jufu'] as const;
export type TalismanLook = (typeof SPELL_LOOKS)[number];
export const SPELL_LOOK_LETTER: Record<TalismanLook, string> = { reifu: 'A', tenfu: 'B', rune: 'C', hikari: 'D', jufu: 'E' };

/**
 * Client 2026-11-25 (all five approved): which talisman each kind of work casts with — the one place to change it.
 * 'novel' / 'book' / 'game' are not atelier kinds yet; they light up as soon as those kinds exist.
 * Everything not listed (look / dress-up, bati, lookup, voice, radio, …) casts with B for now.
 */
export const SPELL_LOOK_BY_KIND: Record<string, TalismanLook> = {
  art: 'tenfu',
  image: 'tenfu',
  song: 'hikari',
  video: 'rune',
  novel: 'reifu',
  book: 'reifu',
  game: 'jufu',
};
export const SPELL_LOOK_DEFAULT: TalismanLook = 'tenfu';
export const spellLookFor = (kind: string): TalismanLook => SPELL_LOOK_BY_KIND[kind] ?? SPELL_LOOK_DEFAULT;

/** `css: null` — already loaded for the whole app (app/layout.tsx) */
const FONT: Record<TalismanLook, { family: string; css: string | null }> = {
  reifu: { family: '"Yuji Boku"', css: 'Yuji+Boku' },
  tenfu: { family: '"Zen Antique"', css: 'Zen+Antique' },
  rune: { family: '"Shippori Antique B1"', css: 'Shippori+Antique+B1' },
  hikari: { family: '"Yusei Magic"', css: null },
  jufu: { family: '"Kaisei Decol"', css: 'Kaisei+Decol:wght@700' },
};
const face = (look: TalismanLook) => `${FONT[look].family}, "Shippori Mincho", "Hiragino Mincho ProN", serif`;

/** only the font of the look in use, fetched once when it is first shown (display=swap) */
export function useSpellFont(look: TalismanLook) {
  useEffect(() => {
    if (!FONT[look].css) return;
    const id = `spell-font-${look}`;
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id;
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${FONT[look].css}&display=swap`;
    document.head.appendChild(l);
  }, [look]);
}

/** a steady number per word (the same tag always hangs, frays and floats the same way) */
const seedOf = (s: string) => [...s].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7);
function rng(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1000) / 1000;
  };
}
/** a torn / frayed / burnt outline: jitter along the edges (px), as a clip-path polygon */
function ragged(seed: number, { tb, lr, n = 9, m = 6 }: { tb: number; lr: number; n?: number; m?: number }) {
  const r = rng(seed);
  const p: string[] = [];
  for (let i = 0; i <= n; i++) p.push(`${((i / n) * 100).toFixed(1)}% ${(r() * tb).toFixed(1)}px`);
  for (let i = 1; i < m; i++) p.push(`calc(100% - ${(r() * lr).toFixed(1)}px) ${((i / m) * 100).toFixed(1)}%`);
  for (let i = n; i >= 0; i--) p.push(`${((i / n) * 100).toFixed(1)}% calc(100% - ${(r() * tb).toFixed(1)}px)`);
  for (let i = m - 1; i > 0; i--) p.push(`${(r() * lr).toFixed(1)}px ${((i / m) * 100).toFixed(1)}%`);
  return `polygon(${p.join(',')})`;
}

const svg = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
/** paper grain (fine), fibres (long, along the strip), mottling */
const GRAIN = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .42 0 0 0 0 .25 0 0 0 0 .06 0 0 0 .55 -.12'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`);
const FIBRE_V = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='90' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.55 .018' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .55 0 0 0 0 .35 0 0 0 0 .08 0 0 0 .9 -.35'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`);
const FIBRE_W = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.012 .09' numOctaves='3' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45 0 0 0 0 .38 0 0 0 0 .3 0 0 0 1.1 -.55'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`);
const FIBRE_C = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='90' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.5 .03' numOctaves='3' seed='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .75 0 0 0 0 .95 0 0 0 0 1 0 0 0 .75 -.42'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`);
const MOTTLE = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.035' numOctaves='3' seed='9' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45 0 0 0 0 .22 0 0 0 0 .04 0 0 0 .8 -.3'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`);
/** a line of small rune marks (C: along the scroll's top and bottom) */
const RUNES = (ink: string) =>
  svg(`<svg xmlns='http://www.w3.org/2000/svg' width='48' height='6' fill='none' stroke='${ink}' stroke-width='.6' stroke-linecap='round'><circle cx='3' cy='3' r='2'/><path d='M3 1v4M9 5l2-4 2 4zM17 1v4M15.5 2.2h3M15.5 3.8h3'/><circle cx='23' cy='3' r='.8' fill='${ink}'/><path d='M27 5c0-3 3-3 3-1s-3 1-3-2M34 1l1.5 2-1.5 2-1.5-2zM40 1v4l2-2zM45 1a2 2 0 1 0 0 4'/></svg>`);
/** the night sky inside the gold border (B) */
const STARS =
  'radial-gradient(1px 1px at 12% 22%, rgba(255,240,200,.9), transparent 60%), radial-gradient(1px 1px at 78% 30%, rgba(255,240,200,.7), transparent 60%), radial-gradient(1.2px 1.2px at 40% 78%, rgba(255,240,200,.8), transparent 60%), radial-gradient(1px 1px at 90% 82%, rgba(255,240,200,.6), transparent 60%), radial-gradient(.8px .8px at 60% 12%, rgba(255,255,255,.7), transparent 60%)';

/** E: the magic circle (a small one on each slip; a big faint one turning behind the card) */
export function MagicCircle({ className, style, rich }: { className?: string; style?: CSSProperties; rich?: boolean }) {
  const pts = (r: number, k: number, off = -90) => Array.from({ length: k }, (_, i) => { const a = ((off + (360 / k) * i) * Math.PI) / 180; return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`; });
  const tri1 = pts(31, 3);
  const tri2 = pts(31, 3, 90);
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} fill="none" stroke="currentColor" aria-hidden>
      <circle cx="50" cy="50" r="47" strokeWidth="2.6" />
      <circle cx="50" cy="50" r="41" strokeWidth="1.3" />
      {rich && <circle cx="50" cy="50" r="44" strokeWidth="3.5" strokeDasharray="1 3.2" />}
      <polygon points={tri1.join(' ')} strokeWidth="2.2" />
      <polygon points={tri2.join(' ')} strokeWidth="2.2" />
      <circle cx="50" cy="50" r="15" strokeWidth="1.4" />
      {pts(41, 6, -60).map((p, i) => {
        const [x, y] = p.split(',');
        return <circle key={i} cx={x} cy={y} r="3.6" strokeWidth="1.3" fill="currentColor" fillOpacity=".25" />;
      })}
      {rich && pts(23, 12).map((p, i) => { const [x, y] = p.split(','); return <circle key={`d${i}`} cx={x} cy={y} r=".9" fill="currentColor" stroke="none" />; })}
      <circle cx="50" cy="50" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const LOOK_CSS = `
@property --burn{syntax:'<percentage>';inherits:true;initial-value:0%}
@keyframes ta-gone{0%,98%{max-width:220px}100%{max-width:0;margin:0}}
@keyframes ta-fade{from{opacity:0}to{opacity:1}}
/* A 霊符: flutters down like paper, glows, burns away from the bottom */
@keyframes rf-in{0%{opacity:0;transform:translateY(-60px) rotate(-16deg) rotateY(70deg)}35%{opacity:1;transform:translateY(-14px) rotate(9deg) rotateY(-35deg)}65%{transform:translateY(3px) rotate(-4deg) rotateY(12deg)}85%{transform:translateY(-1px) rotate(calc(var(--tilt) + 1deg)) rotateY(-3deg)}100%{opacity:1;transform:translateY(0) rotate(var(--tilt))}}
@keyframes rf-sway{0%,100%{transform:rotate(var(--tilt))}50%{transform:rotate(calc(var(--tilt) * -.6))}}
@keyframes rf-glow{0%,100%{filter:drop-shadow(0 0 3px rgba(255,70,30,.45)) drop-shadow(0 3px 4px rgba(0,0,0,.55))}50%{filter:drop-shadow(0 0 8px rgba(255,90,40,.7)) drop-shadow(0 3px 4px rgba(0,0,0,.55))}}
@keyframes burn{0%{--burn:0%}100%{--burn:135%}}
@keyframes rf-away{0%{transform:rotate(var(--tilt))}70%{opacity:1;transform:translateY(-4px) rotate(var(--tilt))}100%{opacity:0;transform:translateY(-16px) rotate(var(--tilt))}}
/* B 天符: appears in a flash of gold, goes as rising stardust */
@keyframes tf-in{0%{opacity:0;transform:scale(.55);filter:blur(6px) brightness(3)}55%{opacity:1;transform:scale(1.07);filter:blur(0) brightness(1.7)}100%{opacity:1;transform:scale(1) rotate(var(--tilt));filter:none}}
@keyframes tf-away{0%{opacity:1;filter:none;transform:rotate(var(--tilt))}30%{opacity:1;filter:brightness(2.4) drop-shadow(0 0 8px #ffd77a)}100%{opacity:0;filter:brightness(3) blur(7px);transform:translateY(-26px) scale(1.15)}}
@keyframes tf-twinkle{0%,100%{opacity:.35;transform:scale(.7) rotate(0)}50%{opacity:1;transform:scale(1.15) rotate(45deg)}}
@keyframes tf-card{0%,100%{opacity:.55}50%{opacity:.9}}
/* C ルーン: unrolls, the ink shimmers, burns away */
@keyframes rn-in{0%{opacity:0;transform:scaleX(.12)}25%{opacity:1}70%{transform:scaleX(1.05) rotate(var(--tilt))}100%{opacity:1;transform:scaleX(1) rotate(var(--tilt))}}
@keyframes rn-shim{0%,55%{background-position:120% 0}100%{background-position:-60% 0}}
@keyframes rn-rod{0%{opacity:1;filter:none}40%{filter:brightness(.4) sepia(1) saturate(4) hue-rotate(-20deg)}100%{opacity:0;transform:translateY(10px) rotate(12deg);filter:brightness(.2)}}
@keyframes rn-away{0%{transform:rotate(var(--tilt))}75%{opacity:1}100%{opacity:0;transform:translateY(-10px) rotate(var(--tilt))}}
/* D 光符: rises out of the light, floats, melts into light */
@keyframes hk-in{0%{opacity:0;transform:translateY(18px) scaleY(.5);filter:blur(5px) brightness(2.4)}60%{opacity:1;transform:translateY(-4px) scaleY(1.04);filter:blur(0) brightness(1.5)}100%{opacity:1;transform:translateY(0) rotate(var(--tilt));filter:none}}
@keyframes hk-bob{0%{transform:translateY(-2px) rotate(var(--tilt))}100%{transform:translateY(2.5px) rotate(calc(var(--tilt) * -1))}}
@keyframes hk-away{0%{opacity:1;filter:none;transform:rotate(var(--tilt))}35%{opacity:1;filter:brightness(2.2) blur(1px)}100%{opacity:0;filter:brightness(3.2) blur(8px);transform:translateY(-30px) scale(1.2)}}
@keyframes hk-glow{0%,100%{filter:drop-shadow(0 0 4px rgba(110,215,255,.75)) drop-shadow(0 0 12px rgba(60,160,255,.4))}50%{filter:drop-shadow(0 0 7px rgba(150,230,255,.95)) drop-shadow(0 0 18px rgba(60,160,255,.55))}}
@keyframes hk-breathe{0%,100%{box-shadow:0 0 10px rgba(90,205,255,.5),0 0 22px rgba(60,160,255,.2),inset 0 0 12px rgba(190,245,255,.45)}50%{box-shadow:0 0 16px rgba(120,220,255,.75),0 0 30px rgba(60,160,255,.35),inset 0 0 14px rgba(210,250,255,.6)}}
@keyframes hk-ripple{0%{transform:translate(-50%,-50%) scale(.6);opacity:.55}100%{transform:translate(-50%,-50%) scale(1.6);opacity:0}}
/* E 呪符: stamped on, the circle turns, peeled off */
@keyframes jf-in{0%{opacity:0;transform:scale(1.7) rotate(-8deg)}55%{opacity:1;transform:scale(.94) rotate(calc(var(--tilt) + 1deg))}75%{transform:scale(1.03)}100%{opacity:1;transform:scale(1) rotate(var(--tilt))}}
@keyframes jf-spin{to{transform:rotate(360deg)}}
@keyframes jf-peel{0%{transform:rotate(var(--tilt))}35%{transform:rotate(-14deg) translate(-2px,-6px) skewX(-6deg)}100%{opacity:0;transform:rotate(28deg) translate(18px,70px) skewX(8deg)}}
@media (prefers-reduced-motion: reduce){[data-look] *{animation-iteration-count:1!important}}
`;

type Mode = 'still' | 'drop' | 'fall';
export interface TalismanProps {
  tag: SpellTag;
  mode: Mode;
  delay: number;
  onDrop?: () => void;
}

function Drop({ ja, onDrop, className, style }: { ja: string; onDrop: () => void; className: string; style?: CSSProperties }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDrop();
      }}
      aria-label={`${ja}を外す`}
      className={`flex shrink-0 items-center justify-center rounded-full font-sans leading-none ${className}`}
      style={style}
    >
      ✕
    </button>
  );
}

/** the burning edge that eats the paper (A, C): masked from `--burn`, with an ember rim */
const burnMask = (at: string): CSSProperties => ({
  WebkitMaskImage: `radial-gradient(ellipse 160% 130% at ${at}, transparent var(--burn), #000 calc(var(--burn) + 7%))`,
  maskImage: `radial-gradient(ellipse 160% 130% at ${at}, transparent var(--burn), #000 calc(var(--burn) + 7%))`,
});
function Ember({ at }: { at: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ background: `radial-gradient(ellipse 160% 130% at ${at}, transparent calc(var(--burn) + 1%), #ffd27a calc(var(--burn) + 3%), #ff6a1a calc(var(--burn) + 6%), rgba(60,15,0,.85) calc(var(--burn) + 10%), rgba(60,20,0,.25) calc(var(--burn) + 17%), transparent calc(var(--burn) + 24%))`, mixBlendMode: 'multiply' }}
    />
  );
}

/* ───────────────────────── A 霊符 ───────────────────────── */
function Reifu({ tag, mode, delay, onDrop, tilt }: TalismanProps & { tilt: number }) {
  const seed = seedOf(tag.ja);
  const t = (tilt * 0.45).toFixed(1);
  const sway = 3.6 + (seed % 7) * 0.35;
  const anim =
    mode === 'drop'
      ? `rf-in 1s cubic-bezier(.25,.7,.3,1) ${delay}ms both, rf-sway ${sway}s ease-in-out ${delay + 1000}ms infinite`
      : mode === 'fall'
        ? `rf-away 1.25s ease-in ${delay}ms forwards, burn 1.15s cubic-bezier(.5,.1,.7,.9) ${delay}ms forwards, ta-gone ${1250 + delay}ms linear forwards`
        : `ta-fade .4s ease-out ${delay}ms both, rf-sway ${sway}s ease-in-out ${(seed % 9) * -400}ms infinite`;
  const ink = '#b3140b';
  return (
    <span className="relative inline-flex flex-col pt-[6px]" style={{ ['--tilt' as string]: `${t}deg`, transformOrigin: '50% 0', animation: anim, perspective: '400px' }} data-fuda={mode} aria-label={tag.ja}>
      <span className="absolute left-1/2 top-0 block h-[8px] w-px -translate-x-1/2 bg-[#e8a24a]/60" />
      <span className="flex flex-1 flex-col" style={{ animation: 'rf-glow 3.2s ease-in-out infinite', animationDelay: `${(seed % 5) * -600}ms` }}>
        <span
          className="relative flex min-w-[29px] flex-1 flex-col items-center px-[2px] pb-[4px] pt-[6px]"
          style={{
            clipPath: ragged(seed, { tb: 2.6, lr: 0.7, n: 7, m: 8 }),
            background: `${FIBRE_V}, ${GRAIN}, ${MOTTLE}, radial-gradient(ellipse at 30% 20%, rgba(255,250,200,.55), transparent 55%), linear-gradient(180deg, #f6dc6a 0%, #f0c94a 45%, #e3b232 100%)`,
            backgroundBlendMode: 'multiply, multiply, multiply, normal, normal',
            ...(mode === 'fall' ? burnMask('50% 112%') : {}),
          }}
        >
          {/* 勅令 at the head, a brush bar under it */}
          <span className="block whitespace-nowrap text-[7px] leading-none opacity-90" style={{ writingMode: 'vertical-rl', minHeight: '2.05em', fontFamily: face('reifu'), color: ink }}>
            勅令
          </span>
          <span className="my-[3px] block h-[2.5px] w-[18px] rounded-[2px_40%_1px_60%]" style={{ background: ink, opacity: 0.85 }} />
          <span className="block py-[1px] text-[14.5px] leading-[1.06]" style={{ writingMode: 'vertical-rl', lineBreak: 'anywhere', height: `${Math.min([...tag.ja].length, 4) + 0.15}em`, fontFamily: face('reifu'), color: ink, textShadow: '0 0 .5px rgba(120,0,0,.6), 0 0 6px rgba(255,120,60,.25)' }}>
            {tag.ja}
          </span>
          {/* the 月 seal (the Moon temple's) and the ✕, at the foot */}
          <span className="mt-auto flex items-center gap-[1px] pt-[4px]">
            <span
              className="flex h-[12.5px] w-[12.5px] items-center justify-center text-[8.5px] leading-none text-[#fbe6a4]"
              style={{ background: '#c21d10', clipPath: ragged(seed + 3, { tb: 0.9, lr: 0.9, n: 4, m: 4 }), rotate: `${(seed % 7) - 3}deg`, fontFamily: face('reifu'), opacity: 0.92, mixBlendMode: 'multiply' }}
            >
              月
            </span>
            {onDrop && mode !== 'fall' && <Drop ja={tag.ja} onDrop={onDrop} className="h-[12.5px] w-[12.5px] text-[7px]" style={{ color: ink, boxShadow: `inset 0 0 0 1px ${ink}77`, background: 'rgba(255,240,190,.45)' }} />}
          </span>
          {mode === 'fall' && <Ember at="50% 112%" />}
        </span>
      </span>
    </span>
  );
}

/* ───────────────────────── B 天符 ───────────────────────── */
function Star4({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={`absolute block ${className ?? ''}`} style={{ clipPath: 'polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%)', background: 'radial-gradient(circle, #fff8d8, #f2c75c 60%)', ...style }} />;
}
function Tenfu({ tag, mode, delay, onDrop, tilt }: TalismanProps & { tilt: number }) {
  const seed = seedOf(tag.ja);
  const t = (tilt * 0.35).toFixed(1);
  const anim = mode === 'drop' ? `tf-in .9s cubic-bezier(.2,.8,.3,1) ${delay}ms both` : mode === 'fall' ? `tf-away 1s ease-in ${delay}ms forwards, ta-gone ${1000 + delay}ms linear forwards` : `ta-fade .45s ease-out ${delay}ms both`;
  const cut = (c: number) => `polygon(${c}px 0,calc(100% - ${c}px) 0,100% ${c}px,100% calc(100% - ${c}px),calc(100% - ${c}px) 100%,${c}px 100%,0 calc(100% - ${c}px),0 ${c}px)`;
  return (
    <span className="relative inline-block p-[2px]" style={{ ['--tilt' as string]: `${t}deg`, transform: `rotate(${t}deg)`, animation: anim, filter: 'drop-shadow(0 0 5px rgba(255,200,100,.28)) drop-shadow(0 2px 3px rgba(0,0,10,.7))' }} data-fuda={mode} aria-label={tag.ja}>
      {/* gold leaf rim → night paper → a fine gold rule → the field (each a chamfered ofuda plate) */}
      <span className="block p-[1.2px]" style={{ clipPath: cut(6), background: 'linear-gradient(135deg, #fff1b8, #d9a93e 30%, #f7dc8c 52%, #b8862a 75%, #f2d27a)' }}>
        <span className="block p-[1.6px]" style={{ clipPath: cut(5.4), background: '#10173f' }}>
          <span className="block p-[.8px]" style={{ clipPath: cut(4.8), background: 'linear-gradient(135deg, rgba(240,205,120,.75), rgba(190,150,70,.55))' }}>
            <span
              className="relative flex h-[27px] items-center gap-[4px] pl-[9px] pr-[5px]"
              style={{
                clipPath: cut(4.4),
                background: `${STARS}, radial-gradient(1px 1px at ${20 + (seed % 60)}% 60%, #fff, transparent 60%), radial-gradient(ellipse at 50% -10%, rgba(120,140,240,.45), transparent 70%), ${GRAIN}, linear-gradient(180deg, #232f6c 0%, #151d4b 60%, #0e1438 100%)`,
                backgroundBlendMode: 'normal, normal, normal, overlay, normal',
              }}
            >
              <span
                className="whitespace-nowrap pt-[1px] text-[14.5px] leading-none tracking-[.06em]"
                style={{ fontFamily: face('tenfu'), backgroundImage: 'linear-gradient(180deg, #fff9de 0%, #f8dc88 40%, #dcac44 72%, #f6d684 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 0 1.5px rgba(255,214,120,.7)) drop-shadow(0 0 6px rgba(255,190,80,.3))' }}
              >
                {tag.ja}
              </span>
              {onDrop && mode !== 'fall' && <Drop ja={tag.ja} onDrop={onDrop} className="h-[13px] w-[13px] text-[7.5px]" style={{ color: '#f1d07c', boxShadow: 'inset 0 0 0 1px rgba(241,208,124,.5)' }} />}
            </span>
          </span>
        </span>
      </span>
      <Star4 className="h-[8px] w-[8px]" style={{ top: -2, right: -2, filter: 'drop-shadow(0 0 3px #ffe08a)', animation: `tf-twinkle ${2.4 + (seed % 5) * 0.3}s ease-in-out ${(seed % 7) * -300}ms infinite` }} />
      {seed % 2 === 0 && <Star4 className="h-[6px] w-[6px]" style={{ bottom: -1, left: -1, filter: 'drop-shadow(0 0 3px #ffe08a)', animation: `tf-twinkle ${3 + (seed % 3) * 0.4}s ease-in-out ${(seed % 5) * -500}ms infinite` }} />}
    </span>
  );
}

/* ───────────────────────── C ルーン巻物 ───────────────────────── */
function Rod({ side, away }: { side: 'l' | 'r'; away?: number }) {
  return (
    <span aria-hidden className={`absolute top-[1px] bottom-[1px] z-[1] w-[5px] rounded-[2px] ${side === 'l' ? 'left-0' : 'right-0'}`} style={{ background: 'linear-gradient(90deg, #3a1f0e, #7a4a22 45%, #4a2812)', boxShadow: '0 1px 2px rgba(0,0,0,.6)', ...(away != null ? { animation: `rn-rod .9s ease-in ${away + (side === 'l' ? 250 : 450)}ms forwards` } : {}) }}>
      <span className="absolute -top-[2px] left-[-1px] h-[3px] w-[7px] rounded-full" style={{ background: 'linear-gradient(90deg,#8a6a2a,#e6c56e,#8a6a2a)' }} />
      <span className="absolute -bottom-[2px] left-[-1px] h-[3px] w-[7px] rounded-full" style={{ background: 'linear-gradient(90deg,#8a6a2a,#e6c56e,#8a6a2a)' }} />
    </span>
  );
}
function Rune({ tag, mode, delay, onDrop, tilt }: TalismanProps & { tilt: number }) {
  const seed = seedOf(tag.ja);
  const t = (tilt * 0.5).toFixed(1);
  const anim =
    mode === 'drop'
      ? `rn-in .85s cubic-bezier(.3,.8,.3,1) ${delay}ms both`
      : mode === 'fall'
        ? `rn-away 1.25s ease-in ${delay}ms forwards, burn 1.15s cubic-bezier(.5,.1,.7,.9) ${delay}ms forwards, ta-gone ${1250 + delay}ms linear forwards`
        : `ta-fade .4s ease-out ${delay}ms both`;
  const at = seed % 2 ? '0% 0%' : '100% 100%';
  return (
    <span className="relative inline-block px-[1px] py-[4px]" style={{ ['--tilt' as string]: `${t}deg`, transform: `rotate(${t}deg)`, animation: anim, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.55))' }} data-fuda={mode} aria-label={tag.ja}>
      <Rod side="l" away={mode === 'fall' ? delay : undefined} />
      <Rod side="r" away={mode === 'fall' ? delay : undefined} />
      <span
        className="relative mx-[3px] flex h-[31px] items-center gap-[3px] px-[7px]"
        style={{
          clipPath: ragged(seed, { tb: 2.2, lr: 0, n: 10, m: 2 }),
          background: `${RUNES('rgba(80,32,10,.5)')} 0 2.5px / 48px 6px repeat-x, ${RUNES('rgba(80,32,10,.5)')} 13px calc(100% - 2.5px) / 48px 6px repeat-x, linear-gradient(180deg, rgba(70,28,6,.75) 0, rgba(120,60,20,.25) 3.5px, transparent 7px, transparent calc(100% - 7px), rgba(120,60,20,.25) calc(100% - 3.5px), rgba(70,28,6,.75) 100%), ${GRAIN}, ${MOTTLE}, linear-gradient(180deg, #f1dfb2, #e3c68d 60%, #d6b277)`,
          backgroundBlendMode: 'normal, normal, normal, multiply, multiply, normal',
          ...(mode === 'fall' ? burnMask(at) : {}),
        }}
      >
        <span
          className="whitespace-nowrap pt-[1px] text-[14.5px] font-bold leading-none tracking-[.03em]"
          style={{ fontFamily: face('rune'), color: '#3a1d0b', backgroundImage: 'linear-gradient(100deg, #3a1d0b 0%, #3a1d0b 40%, #8a5cff 47%, #c9b3ff 50%, #41c9c0 53%, #3a1d0b 60%, #3a1d0b 100%)', backgroundSize: '260% 100%', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: `rn-shim ${4.2 + (seed % 5) * 0.5}s ease-in-out ${(seed % 9) * -500}ms infinite` }}
        >
          {tag.ja}
        </span>
        {onDrop && mode !== 'fall' && <Drop ja={tag.ja} onDrop={onDrop} className="h-[13px] w-[13px] text-[7.5px]" style={{ color: '#5a2d10', boxShadow: 'inset 0 0 0 1px rgba(90,45,16,.45)' }} />}
        {mode === 'fall' && <Ember at={at} />}
      </span>
    </span>
  );
}

/* ───────────────────────── D 光符 ───────────────────────── */
function Hikari({ tag, mode, delay, onDrop, tilt }: TalismanProps & { tilt: number }) {
  const seed = seedOf(tag.ja);
  const t = (tilt * 0.4).toFixed(1);
  const bob = `hk-bob ${2.6 + (seed % 7) * 0.22}s ease-in-out ${(seed % 11) * -300}ms infinite alternate`;
  const anim = mode === 'drop' ? `hk-in 1s cubic-bezier(.2,.8,.3,1) ${delay}ms both, ${bob}` : mode === 'fall' ? `hk-away 1.05s ease-in ${delay}ms forwards, ta-gone ${1050 + delay}ms linear forwards` : `ta-fade .5s ease-out ${delay}ms both, ${bob}`;
  return (
    <span className="relative inline-block px-[1px] py-[3px]" style={{ ['--tilt' as string]: `${t}deg`, animation: anim }} data-fuda={mode} aria-label={tag.ja}>
      <span className="block" style={{ animation: `hk-glow ${3.4 + (seed % 5) * 0.3}s ease-in-out ${(seed % 7) * -400}ms infinite` }}>
        <span
          className="relative flex h-[32px] items-center gap-[3px] pl-[6px] pr-[5px]"
          style={{
            clipPath: ragged(seed, { tb: 0.8, lr: 2.2, n: 6, m: 7 }),
            background: `radial-gradient(ellipse 60% 80% at 50% 50%, rgba(200,245,255,.22), transparent 80%), ${FIBRE_C}, linear-gradient(180deg, rgba(110,200,255,.24), rgba(40,120,220,.16) 55%, rgba(110,200,255,.26))`,
            backgroundBlendMode: 'normal, normal, normal',
            boxShadow: 'inset 0 0 7px rgba(200,245,255,.55), inset 0 0 0 1px rgba(210,248,255,.6)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        >
          {/* a drop of the bowl's water, lit */}
          <span aria-hidden className="block h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'radial-gradient(circle, #fff 0 30%, #9ff0ff 55%, transparent 72%)', boxShadow: '0 0 6px #6fe0ff, 0 0 0 1.5px rgba(190,245,255,.0)' }} />
          <span className="relative whitespace-nowrap pt-[1px] text-[15.5px] leading-none tracking-[.04em]" style={{ fontFamily: face('hikari'), color: '#f8feff', textShadow: '0 0 1px #fff, 0 0 4px #9becff, 0 0 10px #3fb6ff, 0 0 16px rgba(40,140,255,.55)' }}>
            {tag.ja}
          </span>
          {onDrop && mode !== 'fall' && <Drop ja={tag.ja} onDrop={onDrop} className="relative h-[13px] w-[13px] text-[7.5px]" style={{ color: '#e8fbff', boxShadow: 'inset 0 0 0 1px rgba(220,250,255,.6)', textShadow: '0 0 4px #7fdcff' }} />}
        </span>
      </span>
      {/* motes of light around it */}
      <span aria-hidden className="pointer-events-none absolute block h-[3px] w-[3px] rounded-full bg-white" style={{ top: 0, right: `${10 + (seed % 30)}%`, boxShadow: '0 0 5px 1px #7fe3ff', animation: `tf-twinkle ${2.2 + (seed % 4) * 0.4}s ease-in-out ${(seed % 9) * -250}ms infinite` }} />
      {seed % 3 !== 0 && <span aria-hidden className="pointer-events-none absolute block h-[2px] w-[2px] rounded-full bg-white" style={{ bottom: 1, left: `${15 + (seed % 40)}%`, boxShadow: '0 0 4px 1px #7fe3ff', animation: `tf-twinkle ${2.8 + (seed % 3) * 0.5}s ease-in-out ${(seed % 7) * -350}ms infinite` }} />}
    </span>
  );
}

/* ───────────────────────── E 呪符 ───────────────────────── */
function Jufu({ tag, mode, delay, onDrop, tilt }: TalismanProps & { tilt: number }) {
  const seed = seedOf(tag.ja);
  const t = (tilt * 0.55).toFixed(1);
  const anim = mode === 'drop' ? `jf-in .6s cubic-bezier(.3,.6,.3,1) ${delay}ms both` : mode === 'fall' ? `jf-peel 1s cubic-bezier(.5,0,.7,.4) ${delay}ms forwards, ta-gone ${1000 + delay}ms linear forwards` : `ta-fade .4s ease-out ${delay}ms both`;
  return (
    <span className="relative inline-block py-[2px] pl-[7px] pr-[1px]" style={{ ['--tilt' as string]: `${t}deg`, transform: `rotate(${t}deg)`, transformOrigin: '0 0', animation: anim }} data-fuda={mode} aria-label={tag.ja}>
      <span
        className="relative flex h-[30px] items-center gap-[3px] pl-[16px] pr-[5px]"
        style={{
          clipPath: ragged(seed, { tb: 1.3, lr: 1.2, n: 8, m: 3 }),
          background: `${GRAIN}, radial-gradient(ellipse at 30% 0%, rgba(120,40,30,.45), transparent 65%), linear-gradient(180deg, #221615, #120b0b)`,
          backgroundBlendMode: 'overlay, normal, normal',
          boxShadow: 'inset 0 0 0 1px rgba(214,58,32,.55)',
          filter: 'drop-shadow(0 2px 2.5px rgba(40,10,0,.45))',
        }}
      >
        <span className="whitespace-nowrap pt-[1px] text-[14px] font-bold leading-none tracking-[.02em]" style={{ fontFamily: face('jufu'), color: '#ff5a36', textShadow: '0 0 4px rgba(255,70,30,.65), 0 0 10px rgba(255,40,10,.3)' }}>
          {tag.ja}
        </span>
        {onDrop && mode !== 'fall' && <Drop ja={tag.ja} onDrop={onDrop} className="h-[13px] w-[13px] text-[7.5px]" style={{ color: '#ff8a6a', boxShadow: 'inset 0 0 0 1px rgba(255,110,80,.5)' }} />}
      </span>
      {/* the magic circle stamped across the slip's edge (割印), turning slowly */}
      <MagicCircle className="pointer-events-none absolute left-0 top-1/2 -mt-[11px] h-[22px] w-[22px] text-[#e2452a]" style={{ animation: `jf-spin ${16 + (seed % 6) * 3}s linear infinite ${seed % 2 ? 'reverse' : ''}`, filter: 'drop-shadow(0 0 2.5px rgba(255,80,40,.8))' }} />
    </span>
  );
}

export function Talisman({ look, tilt, ...p }: TalismanProps & { look: TalismanLook; tilt: number }) {
  const C = { reifu: Reifu, tenfu: Tenfu, rune: Rune, hikari: Hikari, jufu: Jufu }[look];
  return <C {...p} tilt={tilt} />;
}

/* ───────────────────────── the card around them ───────────────────────── */
export interface LookFrame {
  card: CSSProperties;
  cardClass: string;
  title: CSSProperties;
  row: string;
  rule: string;
  mana: CSSProperties;
  price: CSSProperties;
  have: CSSProperties;
  short: CSSProperties;
  /** behind the tags (stars, a watermark circle, light ripples) */
  back?: ReactNode;
  titleMark?: ReactNode;
}

export const FRAME: Record<TalismanLook, LookFrame> = {
  reifu: {
    cardClass: 'rounded-[10px]',
    card: {
      background: `radial-gradient(ellipse 90% 60% at 50% 0%, rgba(190,40,20,.42), transparent 70%), radial-gradient(ellipse 80% 50% at 50% 100%, rgba(120,20,10,.35), transparent 70%), ${GRAIN}, linear-gradient(180deg, #24110d, #140808)`,
      backgroundBlendMode: 'normal, normal, overlay, normal',
      boxShadow: 'inset 0 0 0 1px rgba(214,90,50,.35), inset 0 0 22px rgba(0,0,0,.65), 0 0 16px rgba(220,50,20,.22)',
      color: '#f0d8a8',
    },
    title: { fontFamily: face('reifu'), color: '#f2c64e', letterSpacing: '.28em', fontSize: 13, textShadow: '0 0 6px rgba(255,120,40,.55)' },
    titleMark: <span className="ml-auto block h-[13px] w-[13px] rotate-[6deg] text-center text-[9px] leading-[13px] text-[#ffe9b0]" style={{ background: '#b51a0e', fontFamily: face('reifu') }}>符</span>,
    row: 'items-stretch justify-center gap-x-[3px] gap-y-2',
    rule: 'border-[#d4583a]/30',
    mana: { color: '#ecd3a0' },
    price: { color: '#ffd45a', textShadow: '0 0 8px rgba(255,140,40,.8)', fontFamily: face('reifu'), fontSize: 18 },
    have: { color: 'rgba(240,216,168,.7)' },
    short: { color: '#ff7a5c', fontWeight: 600 },
  },
  tenfu: {
    cardClass: 'rounded-[6px]',
    card: {
      background: `${STARS}, radial-gradient(1px 1px at 30% 50%, #fff, transparent 60%), radial-gradient(1px 1px at 70% 65%, #fff, transparent 60%), radial-gradient(ellipse 80% 55% at 50% 0%, rgba(80,100,210,.4), transparent 70%), linear-gradient(180deg, #172056, #0b1033)`,
      boxShadow: 'inset 0 0 0 1px #d8b45c, inset 0 0 0 4px #0f1640, inset 0 0 0 5px rgba(216,180,92,.5), 0 0 18px rgba(255,200,100,.18)',
      color: '#ecdcae',
    },
    title: { fontFamily: face('tenfu'), color: '#f0cf7a', letterSpacing: '.3em', fontSize: 12.5, textShadow: '0 0 6px rgba(255,210,120,.7)' },
    back: (
      <>
        {/* a crescent low in the corner, and gold corner pieces */}
        <span aria-hidden className="pointer-events-none absolute right-[14px] top-[9px] block h-[22px] w-[22px] rounded-full" style={{ boxShadow: '5px -3px 0 0 rgba(243,210,122,.85)', filter: 'drop-shadow(0 0 6px rgba(255,214,120,.8))', animation: 'tf-card 5s ease-in-out infinite' }} />
        {(['left-[6px] top-[6px] border-l border-t', 'right-[6px] top-[6px] border-r border-t', 'left-[6px] bottom-[6px] border-l border-b', 'right-[6px] bottom-[6px] border-r border-b'] as const).map((c) => (
          <span key={c} aria-hidden className={`pointer-events-none absolute h-[12px] w-[12px] border-[#e6c46c] ${c}`} style={{ borderWidth: undefined }} />
        ))}
      </>
    ),
    row: 'items-center justify-center gap-x-[3px] gap-y-[5px]',
    rule: 'border-[#d8b45c]/35',
    mana: { color: '#e9d9a6' },
    price: { fontFamily: face('tenfu'), fontSize: 18, color: '#ffe08a', textShadow: '0 0 8px rgba(255,210,110,.9)' },
    have: { color: 'rgba(233,217,166,.7)' },
    short: { color: '#ff8f7a', fontWeight: 600 },
  },
  rune: {
    cardClass: 'rounded-[8px]',
    card: {
      background: `radial-gradient(ellipse 85% 70% at 50% 45%, rgba(110,70,40,.35), transparent 75%), ${GRAIN}, linear-gradient(160deg, #3b2616, #24160c 70%, #1c1009)`,
      backgroundBlendMode: 'normal, overlay, normal',
      boxShadow: 'inset 0 0 0 1px rgba(200,150,80,.45), inset 0 0 0 4px rgba(30,16,8,.9), inset 0 0 0 5px rgba(200,150,80,.25), inset 0 0 28px rgba(0,0,0,.6)',
      color: '#ead6ad',
    },
    title: { fontFamily: face('rune'), fontWeight: 700, color: '#e8cf98', letterSpacing: '.26em', fontSize: 12.5 },
    back: <MagicCircle rich className="pointer-events-none absolute left-1/2 top-1/2 h-[190px] w-[190px] -translate-x-1/2 -translate-y-1/2 text-[#c79a55]" style={{ opacity: 0.12, animation: 'jf-spin 90s linear infinite' }} />,
    row: 'items-center justify-center gap-x-[4px] gap-y-[5px]',
    rule: 'border-[#c8964f]/30',
    mana: { color: '#e6d1a6' },
    price: { fontFamily: face('rune'), fontWeight: 700, fontSize: 18, color: '#c9b3ff', textShadow: '0 0 8px rgba(140,100,255,.8)' },
    have: { color: 'rgba(230,209,166,.7)' },
    short: { color: '#ff9a7a', fontWeight: 600 },
  },
  hikari: {
    cardClass: 'rounded-[14px]',
    card: {
      background: 'radial-gradient(ellipse 70% 45% at 50% 105%, rgba(80,200,255,.35), transparent 70%), radial-gradient(ellipse 60% 40% at 20% 10%, rgba(120,190,255,.18), transparent 70%), linear-gradient(180deg, rgba(14,34,84,.94), rgba(6,18,52,.96))',
      boxShadow: 'inset 0 0 0 1px rgba(150,225,255,.45), inset 0 1px 0 rgba(220,250,255,.35), 0 0 18px rgba(70,180,255,.28)',
      color: '#d8f4ff',
    },
    title: { fontFamily: face('hikari'), color: '#bff0ff', letterSpacing: '.28em', fontSize: 13, textShadow: '0 0 6px #45c4ff' },
    back: (
      <>
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-[58%] block h-[120px] w-[260px] rounded-[50%] border border-[rgba(140,225,255,.35)]" style={{ animation: 'hk-ripple 4.5s ease-out infinite' }} />
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-[58%] block h-[120px] w-[260px] rounded-[50%] border border-[rgba(140,225,255,.3)]" style={{ animation: 'hk-ripple 4.5s ease-out 2.25s infinite' }} />
      </>
    ),
    row: 'items-center justify-center gap-x-[3px] gap-y-[3px]',
    rule: 'border-[#8fe0ff]/25',
    mana: { color: '#cdeeff' },
    price: { fontFamily: face('hikari'), fontSize: 19, color: '#f2fdff', textShadow: '0 0 6px #7fe3ff, 0 0 12px #3bb8ff' },
    have: { color: 'rgba(205,238,255,.7)' },
    short: { color: '#ffb0a0', fontWeight: 600 },
  },
  jufu: {
    cardClass: 'rounded-[4px]',
    card: {
      background: `${FIBRE_W}, ${GRAIN}, radial-gradient(ellipse at 50% 50%, #f7f0e1, #ece0c8)`,
      backgroundBlendMode: 'multiply, multiply, normal',
      boxShadow: 'inset 0 0 0 1px rgba(190,40,20,.55), inset 0 0 0 3.5px #f3eadb, inset 0 0 0 4.5px rgba(190,40,20,.35), 0 2px 8px rgba(60,20,0,.25)',
      color: '#2a1a14',
    },
    title: { fontFamily: face('jufu'), fontWeight: 700, color: '#2a1a14', letterSpacing: '.3em', fontSize: 12.5 },
    titleMark: (
      <span className="ml-auto flex h-[18px] w-[18px] rotate-[-8deg] items-center justify-center rounded-full text-[9.5px] font-bold leading-none text-[#c8261a]" style={{ boxShadow: 'inset 0 0 0 1.5px #c8261a', fontFamily: face('jufu'), opacity: 0.85 }}>
        呪
      </span>
    ),
    back: <MagicCircle rich className="pointer-events-none absolute left-1/2 top-[52%] h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 text-[#c8261a]" style={{ opacity: 0.13, animation: 'jf-spin 80s linear infinite' }} />,
    row: 'items-center justify-center gap-x-[2px] gap-y-[4px]',
    rule: 'border-[#c8261a]/25',
    mana: { color: '#3a2a20' },
    price: { fontFamily: face('jufu'), fontWeight: 700, fontSize: 18, color: '#c8261a' },
    have: { color: 'rgba(58,42,32,.7)' },
    short: { color: '#c8261a', fontWeight: 700 },
  },
};

/** the bubble's chips under a card in this look (〔このスペルで作って〕〔変える〕) */
export function spellChipStyle(look: TalismanLook): CSSProperties {
  switch (look) {
    case 'reifu':
      return { fontFamily: face('reifu'), fontWeight: 400, fontSize: 14, color: '#a8120a', borderRadius: 3, background: `${FIBRE_V}, linear-gradient(180deg, #f6dc6a, #e8bb3a)`, backgroundBlendMode: 'multiply, normal', boxShadow: 'inset 0 0 0 1px rgba(168,18,10,.45), 0 0 8px rgba(255,90,40,.35), 0 2px 3px rgba(60,10,0,.35)' };
    case 'tenfu':
      return { fontFamily: face('tenfu'), fontWeight: 400, fontSize: 14, color: '#f3d382', borderRadius: 4, background: 'linear-gradient(180deg, #212d68, #10173f)', boxShadow: 'inset 0 0 0 1px #d8b45c, 0 0 9px rgba(255,205,110,.3)', textShadow: '0 0 5px rgba(255,210,120,.7)' };
    case 'rune':
      return { fontFamily: face('rune'), fontWeight: 700, fontSize: 13.5, color: '#3a1d0b', borderRadius: 4, background: `linear-gradient(180deg, rgba(70,28,6,.5) 0, transparent 5px, transparent calc(100% - 5px), rgba(70,28,6,.5) 100%), ${GRAIN}, linear-gradient(180deg, #f1dfb2, #dcbd85)`, backgroundBlendMode: 'normal, multiply, normal', boxShadow: '0 0 0 1px rgba(90,50,20,.5), 0 2px 3px rgba(40,20,5,.35)' };
    case 'hikari':
      return { fontFamily: face('hikari'), fontSize: 14.5, color: '#f2fdff', borderRadius: 999, background: 'linear-gradient(180deg, rgba(60,140,220,.85), rgba(20,60,140,.9))', boxShadow: 'inset 0 0 0 1px rgba(200,245,255,.7), 0 0 12px rgba(90,205,255,.55)', textShadow: '0 0 5px #8fe8ff' };
    case 'jufu':
      return { fontFamily: face('jufu'), fontWeight: 700, fontSize: 13.5, color: '#ff5a36', borderRadius: 3, background: 'linear-gradient(180deg, #2a1a18, #120b0b)', boxShadow: 'inset 0 0 0 1px rgba(214,58,32,.6), 0 2px 4px rgba(40,10,0,.35)', textShadow: '0 0 4px rgba(255,70,30,.6)' };
  }
}
