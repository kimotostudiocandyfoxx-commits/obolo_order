'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { SavedSpell, SpellTag } from '@obolo/shared';
import { face, LOOK_CSS, Talisman, useSpellFont, type TalismanLook, spellLookFor } from './spellLooks';

/**
 * R12 (client 2026-11-25): {bati}'s two tools, in the temple sky over the bowl — only while one is used, then they fade
 * away (never a button in the talk).
 *  - BatiCompass: a magic compass (SVG): an outer gold ring of ticks and stars, a ring of small runes, a night-blue
 *    face with a compass rose, a needle. 'open' — it floats up out of the bowl's light and waits (the needle sways);
 *    'reading' — the needle spins and the rings glow; 'done' — a flash, and the spell's talismans come out of it
 *    (FloatingSpell `from`), while it fades away.
 *  - SpellBookFloat: the spell book: it floats up closed (night-blue leather, a gold crescent), opens (the cover turns),
 *    and shows the kept spells, two to a page, each as its talismans (the look of its kind) with its name; a page turns
 *    with 「次のページ」 or a tap on its edge. 'save': it opens, the spell's talismans fly into the page, its name is
 *    written, and it closes and sinks back.
 */

export type CompassPhase = 'open' | 'reading' | 'done';
export const COMPASS_SIZE = 168;

const COMPASS_CSS = `
@keyframes bc-in{0%{opacity:0;transform:translate(-50%,-50%) translateY(70px) scale(.25);filter:blur(6px) brightness(2.4)}60%{opacity:1;filter:blur(0) brightness(1.5)}100%{opacity:1;transform:translate(-50%,-50%) scale(1);filter:none}}
@keyframes bc-out{0%{opacity:1;transform:translate(-50%,-50%) scale(1);filter:brightness(1.6)}25%{filter:brightness(2.6) drop-shadow(0 0 22px #ffe39a)}100%{opacity:0;transform:translate(-50%,-50%) translateY(-24px) scale(.55);filter:blur(5px) brightness(2)}}
@keyframes bc-bob{0%,100%{transform:translateY(-4px)}50%{transform:translateY(4px)}}
@keyframes bc-cw{to{transform:rotate(360deg)}}
@keyframes bc-ccw{to{transform:rotate(-360deg)}}
@keyframes bc-sway{0%,100%{transform:rotate(-24deg)}50%{transform:rotate(30deg)}}
@keyframes bc-spin{to{transform:rotate(1080deg)}}
@keyframes bc-settle{0%{transform:rotate(-200deg)}70%{transform:rotate(18deg)}100%{transform:rotate(0)}}
@keyframes bc-glow{0%,100%{opacity:.55;transform:translate(-50%,-50%) scale(.94)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}}
@keyframes bc-flash{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}30%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(2.1)}}
@keyframes bc-mote{0%{opacity:0;transform:rotate(var(--a)) translateX(46px) scale(.4)}30%{opacity:1}100%{opacity:0;transform:rotate(calc(var(--a) + 70deg)) translateX(96px) scale(1)}}
@media (prefers-reduced-motion: reduce){[data-bati-compass] *{animation-iteration-count:1!important}}
`;

const pt = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)] as const;
};

/** the compass itself (200×200) */
function CompassSvg({ phase }: { phase: CompassPhase }) {
  const fast = phase === 'reading';
  const ring = (dur: number, dir: 'cw' | 'ccw'): CSSProperties => ({ transformOrigin: '100px 100px', transformBox: 'view-box', animation: `bc-${dir} ${fast ? dur / 7 : dur}s linear infinite` });
  const needle: CSSProperties = { transformOrigin: '100px 100px', transformBox: 'view-box', animation: phase === 'reading' ? 'bc-spin 1.1s cubic-bezier(.4,.1,.6,.9) infinite' : phase === 'done' ? 'bc-settle 1s ease-out both' : 'bc-sway 3.8s ease-in-out infinite' };
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const big = i % 6 === 0;
    const [x1, y1] = pt(big ? 84 : 87, i * 5);
    const [x2, y2] = pt(92, i * 5);
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={big ? 1.6 : 0.7} />;
  });
  const stars = Array.from({ length: 12 }, (_, i) => {
    const [x, y] = pt(76, i * 30 + 15);
    return i % 3 === 0 ? <path key={i} d={`M${x} ${y - 3.4}l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z`} fill="#ffe7a8" stroke="none" /> : <circle key={i} cx={x} cy={y} r={1.1} fill="#ffe7a8" stroke="none" />;
  });
  // the rune ring: small marks (no font needed)
  const runes = Array.from({ length: 24 }, (_, i) => {
    const deg = i * 15;
    const [x, y] = pt(68, deg);
    const k = i % 4;
    const d = k === 0 ? 'M0 -3v6M-2 -1l2 -2 2 2' : k === 1 ? 'M-2 -3l4 6M2 -3l-4 6' : k === 2 ? 'M-2 3v-6l4 3-4 3' : 'M0 -3a3 3 0 1 0 .1 0';
    return <path key={i} d={d} transform={`translate(${x} ${y}) rotate(${deg})`} strokeWidth={0.9} />;
  });
  const rose = (r: number, w: number, off: number) =>
    Array.from({ length: 4 }, (_, i) => {
      const deg = i * 90 + off;
      const [tx, ty] = pt(r, deg);
      const [lx, ly] = pt(w, deg - 45);
      const [rx, ry] = pt(w, deg + 45);
      return <path key={`${r}-${i}`} d={`M100 100L${lx} ${ly}L${tx} ${ty}L${rx} ${ry}Z`} />;
    });
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" fill="none" stroke="#f3d58a" aria-hidden>
      <defs>
        <radialGradient id="bc-face" cx="50%" cy="42%" r="60%">
          <stop offset="0" stopColor="#2a3c8a" />
          <stop offset=".65" stopColor="#141c4e" />
          <stop offset="1" stopColor="#0a0f30" />
        </radialGradient>
        <linearGradient id="bc-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1c2" />
          <stop offset=".5" stopColor="#e2b453" />
          <stop offset="1" stopColor="#9c6a1c" />
        </linearGradient>
        <linearGradient id="bc-north" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb08a" />
          <stop offset="1" stopColor="#d2361c" />
        </linearGradient>
      </defs>
      {/* the rim */}
      <circle cx="100" cy="100" r="96" stroke="url(#bc-gold)" strokeWidth="3.2" />
      <circle cx="100" cy="100" r="93.5" strokeOpacity=".5" strokeWidth=".8" />
      <g style={ring(60, 'cw')}>
        {ticks}
        {stars}
      </g>
      <circle cx="100" cy="100" r="80.5" stroke="url(#bc-gold)" strokeWidth="1.6" />
      {/* the face */}
      <circle cx="100" cy="100" r="79" fill="url(#bc-face)" stroke="none" />
      <g style={ring(42, 'ccw')} stroke="#bfe6ff" strokeOpacity=".85" strokeLinecap="round">
        {runes}
      </g>
      <circle cx="100" cy="100" r="60" stroke="#9fd6ff" strokeOpacity=".5" strokeWidth=".8" strokeDasharray="1.5 3" />
      <g style={ring(90, 'cw')}>
        <g fill="#e9c46a" fillOpacity=".22" stroke="#f3d58a" strokeWidth=".7">{rose(54, 12, 45)}</g>
        <g fill="url(#bc-gold)" stroke="#fff3cc" strokeWidth=".6">{rose(58, 14, 0)}</g>
      </g>
      <circle cx="100" cy="100" r="22" stroke="#f3d58a" strokeOpacity=".6" strokeWidth=".8" />
      {/* the needle */}
      <g style={needle}>
        <path d="M100 38L106.5 100L100 106L93.5 100Z" fill="url(#bc-north)" stroke="#ffe2c8" strokeWidth=".7" />
        <path d="M100 162L106.5 100L100 94L93.5 100Z" fill="#dfe8ff" stroke="#ffffff" strokeWidth=".6" fillOpacity=".92" />
      </g>
      <circle cx="100" cy="100" r="6.5" fill="url(#bc-gold)" stroke="#fff6d8" strokeWidth=".8" />
      <circle cx="100" cy="100" r="2.6" fill="#9ff0ff" stroke="none" />
    </svg>
  );
}

/** the compass in the sky: `cx`/`cy` its centre (the stage's px), `size` its width */
export function BatiCompass({ phase, cx, cy, size = COMPASS_SIZE, leaving }: { phase: CompassPhase; cx: number; cy: number; size?: number; leaving?: boolean }) {
  const glow = phase === 'reading' ? 1 : 0.6;
  return (
    <div className="pointer-events-none absolute" style={{ left: cx, top: cy, width: size, height: size, transform: 'translate(-50%,-50%)', animation: leaving ? 'bc-out .9s ease-in forwards' : 'bc-in 1s cubic-bezier(.25,.8,.3,1) both' }} data-bati-compass={phase}>
      <style>{COMPASS_CSS}</style>
      {/* its light */}
      <span aria-hidden className="absolute left-1/2 top-1/2 block rounded-full" style={{ width: size * 1.7, height: size * 1.7, background: `radial-gradient(circle, rgba(255,226,140,${0.34 * glow}) 0%, rgba(120,200,255,${0.22 * glow}) 38%, transparent 68%)`, animation: `bc-glow ${phase === 'reading' ? 1.1 : 3.4}s ease-in-out infinite` }} />
      {phase !== 'open' &&
        Array.from({ length: 8 }, (_, i) => (
          <span key={i} aria-hidden className="absolute left-1/2 top-1/2 block h-1.5 w-1.5 rounded-full" style={{ ['--a' as string]: `${i * 45}deg`, background: '#fff2c4', boxShadow: '0 0 6px #ffd77a', animation: `bc-mote ${phase === 'reading' ? 1.4 : 1}s ease-out ${i * 0.17}s ${phase === 'reading' ? 'infinite' : '1'}` }} />
        ))}
      {phase === 'done' && <span aria-hidden className="absolute left-1/2 top-1/2 block rounded-full" style={{ width: size, height: size, background: 'radial-gradient(circle, rgba(255,246,210,.95), rgba(255,210,120,.4) 40%, transparent 70%)', animation: 'bc-flash .9s ease-out both' }} />}
      <div className="absolute inset-0" style={{ animation: 'bc-bob 4.2s ease-in-out infinite', filter: `drop-shadow(0 0 ${phase === 'reading' ? 14 : 7}px rgba(255,215,120,.75)) drop-shadow(0 6px 10px rgba(0,0,0,.5))`, transition: 'filter .6s' }}>
        <CompassSvg phase={phase} />
      </div>
    </div>
  );
}

// --- the spell book ----------------------------------------------------------------------------------------------

export type BookMode = 'open' | 'save' | 'close';
export type BookSaving = { kind: string; tags: SpellTag[]; name: string };
export const BOOK_PER_PAGE = 2;

const BOOK_CSS = `
@keyframes sb-in{0%{opacity:0;transform:translateY(80px) scale(.4);filter:blur(5px) brightness(2.2)}60%{opacity:1;filter:none}100%{opacity:1;transform:none}}
@keyframes sb-out{0%{opacity:1;transform:none}100%{opacity:0;transform:translateY(70px) scale(.45);filter:blur(4px) brightness(1.8)}}
@keyframes sb-bob{0%,100%{transform:translateY(-3px)}50%{transform:translateY(3px)}}
@keyframes sb-open{0%{transform:rotateY(0)}100%{transform:rotateY(-180deg)}}
@keyframes sb-shut{0%{transform:rotateY(-180deg)}100%{transform:rotateY(0)}}
@keyframes sb-slide-open{0%{transform:translateX(var(--half))}100%{transform:translateX(0)}}
@keyframes sb-slide-shut{0%{transform:translateX(0)}100%{transform:translateX(var(--half))}}
@keyframes sb-leaf{0%{transform:rotateY(0)}100%{transform:rotateY(-180deg)}}
@keyframes sb-leaf-back{0%{transform:rotateY(-180deg)}100%{transform:rotateY(0)}}
@keyframes sb-ink{from{opacity:0;filter:blur(3px)}to{opacity:1;filter:none}}
@keyframes sb-fly{0%{opacity:0;transform:translate(var(--fx),var(--fy)) scale(1.5);filter:brightness(2.4)}25%{opacity:1}100%{opacity:1;transform:none;filter:none}}
@keyframes sb-glow{0%,100%{opacity:.5}50%{opacity:.95}}
@media (prefers-reduced-motion: reduce){[data-spell-book] *{animation-iteration-count:1!important}}
`;

const PAPER: CSSProperties = { background: 'radial-gradient(ellipse at 50% 40%, #fbf1d6 0%, #f1e0b6 70%, #e2c88f 100%)', boxShadow: 'inset 0 0 18px rgba(120,80,20,.28)' };
/** the pages under the open page (their edges at the outer side) */
const EDGES = (side: 'l' | 'r') => (side === 'r' ? '1.5px 1.5px 0 #e8d3a2, 3px 3px 0 #d6bb80, 4.5px 4.5px 0 #c4a466, 6px 6px 10px rgba(0,0,0,.35)' : '-1.5px 1.5px 0 #e8d3a2, -3px 3px 0 #d6bb80, -4.5px 4.5px 0 #c4a466, -6px 6px 10px rgba(0,0,0,.35)');
const COVER: CSSProperties = { background: 'radial-gradient(ellipse at 40% 35%, #34407e 0%, #1b2150 60%, #10143a 100%)', boxShadow: 'inset 0 0 0 2px #c99a42, inset 0 0 0 5px #1b2150, inset 0 0 0 6px rgba(240,200,110,.55), 0 8px 24px rgba(0,0,0,.55)' };

/** one kept spell on a page: its name (ink), its talismans small in the look of its kind */
function PageSpell({ s, look, fly, delay = 0, k = 1 }: { s: { name: string; tags: SpellTag[] }; look: TalismanLook; fly?: { fx: number; fy: number }; delay?: number; k?: number }) {
  useSpellFont(look);
  const tall = look === 'reifu';
  const shown = s.tags.slice(0, tall ? 5 : 4);
  // the talismans themselves, smaller (zoom keeps their layout: they wrap in rows on the page)
  const zoom = (tall ? 0.46 : 0.66) * k;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5" data-book-spell={s.name}>
      <div className="flex max-w-full flex-wrap items-start justify-center" style={{ zoom, gap: tall ? 4 : 5, rowGap: 4 }}>
        {shown.map((t, i) => (
          <span key={t.en} className="relative block" style={fly ? { ['--fx' as string]: `${fly.fx / zoom}px`, ['--fy' as string]: `${fly.fy / zoom}px`, animation: `sb-fly .9s cubic-bezier(.3,.7,.3,1) ${delay + i * 130}ms both` } : undefined}>
            <Talisman look={look} tilt={((i * 7) % 5) - 2} tag={t} mode="still" delay={0} />
          </span>
        ))}
      </div>
      <span className="max-w-full truncate text-center leading-tight" style={{ fontSize: 12.5 * Math.min(1, k + 0.1), color: '#3b2408', fontFamily: '"Shippori Mincho", "Hiragino Mincho ProN", serif', fontWeight: 600, letterSpacing: '.04em', animation: fly ? `sb-ink .8s ease-out ${delay + shown.length * 130 + 300}ms both` : undefined }}>
        {s.name ? `『${s.name}』` : ''}
      </span>
    </div>
  );
}

/**
 * the spell book in the sky: `cx` its centre line, `top` its top, `w` the open spread's width. `spells` the kept ones
 * (open), `page` the spread shown; `saving` (save mode) the spell going in.
 */
export function SpellBookFloat({ mode, spells, page, saving, cx, top, w, onPage }: { mode: BookMode; spells: SavedSpell[]; page: number; saving?: BookSaving; cx: number; top: number; w: number; onPage?: (step: 1 | -1) => void }) {
  const h = Math.round(w * 0.66);
  const half = w / 2;
  const turned = useRef(page);
  const [leaf, setLeaf] = useState<{ k: number; back: boolean } | null>(null);
  useEffect(() => {
    if (page === turned.current) return;
    const back = page < turned.current;
    turned.current = page;
    setLeaf({ k: Date.now(), back });
    const t = setTimeout(() => setLeaf(null), 800);
    return () => clearTimeout(t);
  }, [page]);
  const spreads = Math.max(1, Math.ceil(spells.length / (BOOK_PER_PAGE * 2)));
  const at = Math.min(page, spreads - 1);
  const left = spells.slice(at * BOOK_PER_PAGE * 2, at * BOOK_PER_PAGE * 2 + BOOK_PER_PAGE);
  const right = spells.slice(at * BOOK_PER_PAGE * 2 + BOOK_PER_PAGE, (at + 1) * BOOK_PER_PAGE * 2);
  // a save: the spell goes in, then the book closes by itself and sinks back
  const [shut, setShut] = useState(false);
  useEffect(() => {
    if (mode !== 'save') return;
    const t = setTimeout(() => setShut(true), 1150 + Math.min(saving?.tags.length ?? 4, 4) * 130 + 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const shutting = mode === 'close' || shut;
  const pageBox = (side: 'l' | 'r'): CSSProperties => ({ ...PAPER, position: 'absolute', top: 0, bottom: 0, width: half, left: side === 'l' ? 0 : half, borderRadius: side === 'l' ? '6px 2px 2px 6px' : '2px 6px 6px 2px', boxShadow: `inset 0 0 18px rgba(120,80,20,.28), ${EDGES(side)}` });
  const k = Math.min(1.15, Math.max(0.8, w / 360));
  const pageInner = (list: SavedSpell[], side: 'l' | 'r') => (
    <div className="absolute inset-0 flex flex-col px-2.5 py-3" style={{ backgroundImage: side === 'l' ? 'linear-gradient(90deg, transparent 88%, rgba(110,70,20,.22))' : 'linear-gradient(270deg, transparent 88%, rgba(110,70,20,.22))' }}>
      {list.map((s) => (
        <PageSpell key={s.id} s={s} look={spellLookFor(s.kind)} k={k} />
      ))}
      {!list.length && side === 'l' && !spells.length && mode === 'open' && <span className="m-auto text-[12px]" style={{ color: 'rgba(80,50,15,.55)', fontFamily: '"Shippori Mincho", serif' }}>まだ、からっぽ</span>}
    </div>
  );
  return (
    <div className="pointer-events-none absolute" style={{ left: cx - half, top, width: w, height: h + 22, animation: shutting ? 'sb-out .8s ease-in .35s both' : 'sb-in .9s cubic-bezier(.25,.8,.3,1) both' }} data-spell-book={mode} aria-label="スペルブック">
      <style>{LOOK_CSS + BOOK_CSS}</style>
      {/* the glow it floats in */}
      <span aria-hidden className="absolute block rounded-[50%]" style={{ left: -30, right: -30, top: -26, bottom: -10, background: 'radial-gradient(ellipse at center, rgba(255,220,140,.32), rgba(130,170,255,.16) 45%, transparent 70%)', animation: 'sb-glow 3.2s ease-in-out infinite' }} />
      <div className="absolute inset-x-0 top-0" style={{ height: h, animation: 'sb-bob 4.6s ease-in-out infinite', perspective: 1100 }}>
        <div className="absolute inset-0" style={{ ['--half' as string]: `${-half / 2}px`, animation: shutting ? 'sb-slide-shut .7s ease-in-out both' : 'sb-slide-open .7s ease-in-out .35s both', transformStyle: 'preserve-3d' }}>
          {/* the left page (the cover's inside) and the right page */}
          <div style={{ ...pageBox('l'), opacity: 0.98 }}>{pageInner(mode === 'save' ? spells.slice(0, BOOK_PER_PAGE) : left, 'l')}</div>
          <div style={pageBox('r')} className="pointer-events-auto" onClick={() => onPage?.(1)}>
            {mode === 'save' && saving ? (
              <div className="absolute inset-0 flex flex-col px-2.5 py-3">
                <PageSpell s={saving} look={spellLookFor(saving.kind)} fly={{ fx: 0, fy: -h * 0.9 }} delay={1150} k={k * 1.2} />
              </div>
            ) : (
              pageInner(right, 'r')
            )}
          </div>
          <div className="pointer-events-auto absolute left-0 top-0 h-full" style={{ width: half }} onClick={() => onPage?.(-1)} />
          {/* the ribbon (a bookmark hanging out under the pages) */}
          <span aria-hidden className="absolute block" style={{ left: half + half * 0.62, top: h - 6, width: 9, height: 30, background: 'linear-gradient(90deg,#8e1b22,#c8333a,#8e1b22)', clipPath: 'polygon(0 0,100% 0,100% 100%,50% 78%,0 100%)', opacity: shutting ? 0 : 1, transition: 'opacity .3s' }} />
          {/* the spine */}
          <span aria-hidden className="absolute top-[-3px] block" style={{ left: half - 3, width: 6, height: h + 6, background: 'linear-gradient(90deg,#0d1236,#3a4688,#0d1236)', borderRadius: 3 }} />
          {/* the cover: closed over the right page, it turns to the left */}
          <div className="absolute top-[-3px]" style={{ left: half, width: half + 3, height: h + 6, transformOrigin: '0 50%', transformStyle: 'preserve-3d', animation: shutting ? 'sb-shut .75s ease-in-out both' : 'sb-open .9s cubic-bezier(.45,.05,.3,1) .35s both' }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ ...COVER, borderRadius: '3px 8px 8px 3px', backfaceVisibility: 'hidden' }}>
              <CoverArt w={half} />
              {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                <span key={c} aria-hidden className="absolute block" style={{ width: 16, height: 16, [c[0] === 't' ? 'top' : 'bottom']: 7, [c[1] === 'l' ? 'left' : 'right']: 7, borderColor: '#d9ab52', borderStyle: 'solid', borderWidth: `${c[0] === 't' ? 2 : 0}px ${c[1] === 'r' ? 2 : 0}px ${c[0] === 'b' ? 2 : 0}px ${c[1] === 'l' ? 2 : 0}px`, borderRadius: 2, opacity: 0.85 }} />
              ))}
            </div>
            <div className="absolute inset-0" style={{ ...COVER, borderRadius: '8px 3px 3px 8px', transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}>
              <div className="absolute inset-[5px]" style={{ ...PAPER, borderRadius: 4 }}>{pageInner(mode === 'save' ? spells.slice(0, BOOK_PER_PAGE) : left, 'l')}</div>
            </div>
          </div>
          {/* a page turning */}
          {leaf && (
            <div key={leaf.k} aria-hidden className="absolute top-0" style={{ left: half, width: half, height: h, transformOrigin: '0 50%', transformStyle: 'preserve-3d', animation: `${leaf.back ? 'sb-leaf-back' : 'sb-leaf'} .75s cubic-bezier(.45,.05,.3,1) both` }}>
              <div className="absolute inset-0" style={{ ...PAPER, borderRadius: '2px 6px 6px 2px', backfaceVisibility: 'hidden', boxShadow: 'inset 0 0 18px rgba(120,80,20,.28), -6px 0 14px rgba(0,0,0,.18)' }} />
              <div className="absolute inset-0" style={{ ...PAPER, borderRadius: '6px 2px 2px 6px', transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }} />
            </div>
          )}
        </div>
      </div>
      {mode === 'open' && spells.length > BOOK_PER_PAGE * 2 && (
        <span className="absolute inset-x-0 block text-center text-[11px] tracking-[.2em]" style={{ top: h + 4, color: '#f6e3a8', textShadow: '0 0 6px rgba(255,205,110,.8), 0 1px 3px rgba(4,8,30,.9)', fontFamily: face('tenfu') }} data-testid="spell-book-page">
          {at + 1} / {spreads}
        </span>
      )}
    </div>
  );
}

function CoverArt({ w }: { w: number }) {
  const s = Math.min(1, w / 170);
  return (
    <>
      <svg viewBox="0 0 60 60" width={46 * s} height={46 * s} aria-hidden style={{ filter: 'drop-shadow(0 0 6px rgba(255,210,120,.75))' }}>
        <path d="M38 8a22 22 0 1 0 14 38A18 18 0 1 1 38 8z" fill="#f3d58a" />
        <path d="M44 16l1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3z" fill="#fff3c8" />
        <circle cx="50" cy="30" r="1.2" fill="#fff3c8" />
      </svg>
      <span className="mt-2 text-center" style={{ fontSize: 14 * s, color: '#f3d58a', fontFamily: face('tenfu'), letterSpacing: '.22em', textShadow: '0 0 6px rgba(255,205,110,.7)' }}>
        スペルブック
      </span>
      <span aria-hidden className="mt-2 block" style={{ width: w * 0.5, height: 1, background: 'linear-gradient(90deg,transparent,#c99a42,transparent)' }} />
    </>
  );
}
