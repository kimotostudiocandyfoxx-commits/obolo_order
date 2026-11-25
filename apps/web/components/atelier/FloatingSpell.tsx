'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { formatMana, type SpellTag } from '@obolo/shared';
import { face, LOOK_CSS, Talisman, useSpellFont, type TalismanLook } from './spellLooks';
import type { FloatLyrics } from './LyricSheet';

/**
 * Client 2026-11-25: the spell is not in a bubble. While {bati} says 「じゃあ、こういうスペルになるね。」 its talismans come
 * out one by one in the temple sky over the bowl (the look of the work's kind), glowing softly, and float there — each on
 * its own slow drift — while the spell is decided; a change puts new ones in and lets old ones go in place; when it is
 * cast they fly down into the bowl. The mana floats under them as glowing words (a free making has none). No card, no
 * buttons, no ✕: a tap only wobbles a talisman (and {bati} says how to take it off). It is part of the scene (TalkScene
 * `stage`), so it stays while the talk scrolls; the talk keeps a small record line of it (SpellRecord).
 */
/** `id`: the spell from its first showing through its changes (a new making is a new one) */
export type FloatSpell = { id: string; kind: string; look: TalismanLook; tags: SpellTag[]; removed: SpellTag[]; price: number; have: number | null; casting?: boolean; /** R12: where its talismans come out of at first ({bati}'s compass, the spell book) */ from?: 'compass' | 'book'; /** R13: a song's lyrics with metatags (the sheet under the compact style talismans) */ lyrics?: FloatLyrics; /** R13 fix: called off (「やめて」): it fades away */ leaving?: boolean; /** R17: the secret spell — the talismans glow gold, the mana says so */ gold?: boolean };

const seedOf = (s: string) => [...s].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7);
/** a small steady tilt per tag (the same tag always hangs the same way) */
const tiltOf = (s: string) => ((seedOf(s) % 9) - 4) * 0.9;

/** each look's talisman size, from its word (the talismans' own paddings; measured at 390) */
function sizeOf(look: TalismanLook, ja: string): { w: number; h: number } {
  const n = [...ja].length;
  switch (look) {
    case 'reifu':
      return { w: n > 4 ? 37 : 30, h: 118 };
    case 'tenfu':
      return { w: 25 + 15.4 * n, h: 38 };
    case 'rune':
      return { w: 23 + 15 * n, h: 39 };
    case 'hikari':
      return { w: 26 + 15.2 * n, h: 38 };
    case 'jufu':
      return { w: 29 + 14.5 * n, h: 34 };
  }
}

/** the glow of each look on the night sky (the aura behind a talisman, the mana words) */
const GLOW: Record<TalismanLook, { aura: string; ink: string; shadow: string; num: string }> = {
  reifu: { aura: 'rgba(255,110,40,.34)', ink: '#ffe9b8', shadow: '0 0 6px rgba(255,110,40,.85), 0 0 14px rgba(255,60,20,.5)', num: '#ffd45a' },
  tenfu: { aura: 'rgba(255,214,120,.26)', ink: '#f6e3a8', shadow: '0 0 6px rgba(255,205,110,.85), 0 0 14px rgba(255,190,80,.45)', num: '#ffe08a' },
  rune: { aura: 'rgba(170,130,255,.28)', ink: '#ecdcff', shadow: '0 0 6px rgba(150,110,255,.9), 0 0 14px rgba(90,200,200,.4)', num: '#d9c6ff' },
  hikari: { aura: 'rgba(110,215,255,.32)', ink: '#e8fbff', shadow: '0 0 6px #7fe3ff, 0 0 14px rgba(60,170,255,.7)', num: '#f4feff' },
  jufu: { aura: 'rgba(255,70,30,.3)', ink: '#ffd8cc', shadow: '0 0 6px rgba(255,70,30,.9), 0 0 14px rgba(200,20,0,.5)', num: '#ff7a55' },
};

/** R17: the secret spell's light */
const GOLD_GLOW = { aura: 'rgba(255,200,80,.36)', ink: '#fff3d0', shadow: '0 0 6px rgba(255,200,80,.9), 0 0 14px rgba(255,160,30,.55)', num: '#ffe08a' };

export type FloatLayout = { at: Map<string, { x: number; y: number; w: number; h: number; row: number }>; width: number; height: number };
/**
 * where each talisman floats: rows (centred, every other row a little to the side), a small steady jitter each; strips
 * (A) in rows of tall papers, a staggered height each
 */
export function floatLayout(look: TalismanLook, tags: SpellTag[], width: number, /** R13: a wider row (the compact talismans over a song's lyric sheet) */ rowW?: number): FloatLayout {
  const maxW = rowW ?? Math.min(width - 36, look === 'reifu' ? 330 : 370);
  const gx = look === 'reifu' ? 9 : 14;
  const gy = look === 'reifu' ? 14 : 12;
  const rows: { tags: { t: SpellTag; w: number; h: number }[]; w: number; h: number }[] = [];
  for (const t of tags) {
    const s = sizeOf(look, t.ja);
    const r = rows[rows.length - 1];
    if (r && r.w + gx + s.w <= maxW) {
      r.tags.push({ t, ...s });
      r.w += gx + s.w;
      r.h = Math.max(r.h, s.h);
    } else rows.push({ tags: [{ t, ...s }], w: s.w, h: s.h });
  }
  const at: FloatLayout['at'] = new Map();
  let y = 0;
  rows.forEach((r, ri) => {
    let x = -r.w / 2 + (rows.length > 1 ? (ri % 2 ? 9 : -9) : 0);
    r.tags.forEach((c, ci) => {
      const sd = seedOf(c.t.ja);
      const jx = ((sd % 7) - 3) * 1.2;
      const jy = look === 'reifu' ? (ci % 2 ? 9 : 0) + (sd % 5) - 2 : ((sd >> 3) % 9) - 4;
      at.set(c.t.en, { x: x + c.w / 2 + jx, y: y + jy, w: c.w, h: c.h, row: ri });
      x += c.w + gx;
    });
    y += r.h + gy + (look === 'reifu' ? 9 : 0);
  });
  return { at, width: Math.max(0, ...rows.map((r) => r.w)), height: Math.max(0, y - gy) + 10 };
}

export const MANA_H = 30;

const CSS = `
@keyframes fs-in{0%{opacity:0;filter:blur(7px) brightness(2);transform:translateY(14px) scale(.9)}60%{opacity:1;filter:blur(0) brightness(1.4)}100%{opacity:1;filter:none;transform:none}}
@keyframes fs-float{0%{transform:translate(0,-4px) rotate(var(--r0))}50%{transform:translate(var(--dx),4px) rotate(var(--r1))}100%{transform:translate(0,-4px) rotate(var(--r0))}}
@keyframes fs-wobble{0%,100%{transform:rotate(0)}20%{transform:rotate(-9deg) scale(1.05)}45%{transform:rotate(7deg)}70%{transform:rotate(-4deg)}85%{transform:rotate(2deg)}}
@keyframes fs-aura{0%,100%{opacity:.7;transform:translate(-50%,-50%) scale(.95)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}}
@keyframes fs-mist{0%,100%{opacity:.55;transform:translateX(-50%) scale(1)}50%{opacity:.8;transform:translateX(-50%) scale(1.05)}}
@keyframes fs-emerge{0%{opacity:0;transform:translate(var(--fx),var(--fy)) scale(.12);filter:brightness(2.6) blur(2px)}30%{opacity:1}100%{opacity:1;transform:none;filter:none}}
@keyframes fs-mana{from{opacity:0;filter:blur(4px)}to{opacity:1;filter:none}}
@media (prefers-reduced-motion: reduce){[data-floating-spell] *{animation-iteration-count:1!important}}
`;

/**
 * the spell in the air: `cx` = the bowl's centre line, `bottom` = just over the bowl's rim (the mana sits there, the
 * talismans above it), `bowl` = where they fly when it is cast, `scale` = shrunk to fit the room over the bowl
 */
export function FloatingSpell({ spell, layout, cx, bottom, bowl, scale, onTap, from, manaTop }: { spell: FloatSpell; layout: FloatLayout; cx: number; bottom: number; bowl: { x: number; y: number }; scale: number; onTap?: (t: SpellTag) => void; /** R12: the point (stage px) its first talismans come out of */ from?: { x: number; y: number }; /** R13: the mana words at their own place (under a song's lyric sheet); the talismans end at `bottom` */ manaTop?: number }) {
  const { look } = spell;
  useSpellFont(look);
  // R17: the secret spell glows gold (D 光符 in gold)
  const g = spell.gold ? GOLD_GLOW : GLOW[look];
  const manaH = spell.price > 0 ? MANA_H : 0;
  const top = bottom - (layout.height + (manaTop != null ? 0 : manaH)) * scale;
  // each talisman keeps the motion it came with (a change does not replay the others): its order of coming in
  const born = useRef(new Map<string, { delay: number; spell: string; first?: boolean }>());
  const last = useRef(new Map<string, { x: number; y: number; w: number; h: number }>());
  let k = 0;
  // (keyed by the spell, so a new spell starts afresh: all of them come in one by one; a change, only the new ones)
  const fresh = born.current.size === 0;
  for (const t of spell.tags)
    if (!born.current.has(t.en)) born.current.set(t.en, { delay: fresh ? 250 + k++ * 230 : 150 + k++ * 180, spell: spell.id, first: fresh });
  const [wob, setWob] = useState<Record<string, number>>({});
  const short = spell.have != null && spell.have < spell.price;
  const pos = (p: { x: number; y: number }) => ({ left: cx + p.x * scale, top: top + p.y * scale });
  const one = (t: SpellTag, i: number, gone: boolean) => {
    const p = gone ? last.current.get(t.en) : layout.at.get(t.en);
    if (!p) return null;
    if (!gone) last.current.set(t.en, p);
    const b = born.current.get(t.en) ?? { delay: 0, spell: spell.id };
    const sd = seedOf(t.ja);
    const casting = spell.casting && !gone;
    const q = pos(p);
    return (
      <div
        key={`${gone ? 'gone' : 't'}-${t.en}`}
        className="absolute"
        style={{
          left: casting ? bowl.x : q.left,
          top: casting ? bowl.y - (p.h * scale) / 2 : q.top,
          transform: `translateX(-50%) scale(${casting ? 0.12 : scale})`,
          transformOrigin: '50% 0',
          opacity: casting ? 0 : 1,
          filter: casting ? 'brightness(2.6) blur(1px)' : undefined,
          transition: casting
            ? `left .95s cubic-bezier(.55,0,.75,.6) ${i * 85}ms, top .95s cubic-bezier(.4,0,.9,.5) ${i * 85}ms, transform .95s ease-in ${i * 85}ms, opacity .35s ease-in ${600 + i * 85}ms, filter .6s ease-in ${i * 85}ms`
            : 'left .8s cubic-bezier(.3,.7,.3,1), top .8s cubic-bezier(.3,.7,.3,1), transform .8s cubic-bezier(.3,.7,.3,1)',
          zIndex: gone ? 0 : 1,
        }}
        data-float-tag={t.ja}
      >
        <div
          style={
            from && !gone && b.first
              ? { ['--fx' as string]: `${(from.x - q.left) / scale}px`, ['--fy' as string]: `${(from.y - q.top) / scale - p.h / 2}px`, animation: `fs-emerge 1.1s cubic-bezier(.25,.8,.3,1) ${b.delay}ms both` }
              : { animation: gone ? undefined : `fs-in 1.3s cubic-bezier(.25,.8,.3,1) ${b.delay}ms both` }
          }
        >
          <div
            style={{
              ['--r0' as string]: `${((sd % 5) - 2) * 0.6}deg`,
              ['--r1' as string]: `${((sd % 7) - 3) * -0.7}deg`,
              ['--dx' as string]: `${((sd >> 2) % 5) - 2}px`,
              animation: `fs-float ${5.2 + (sd % 9) * 0.45}s ease-in-out ${(sd % 13) * -470}ms infinite`,
            }}
          >
            {/* a soft aura behind it */}
            <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 block rounded-[50%]" style={{ width: p.w + 34, height: p.h + 30, background: `radial-gradient(ellipse at center, ${g.aura}, transparent 68%)`, animation: `fs-aura ${3.6 + (sd % 5) * 0.4}s ease-in-out ${(sd % 7) * -500}ms infinite`, transform: 'translate(-50%,-50%)' }} />
            <span
              className="pointer-events-auto relative flex cursor-default"
              style={{ height: look === 'reifu' ? p.h : undefined, animation: wob[t.en] ? 'fs-wobble .7s ease-in-out' : undefined, transformOrigin: '50% 10%' }}
              key={wob[t.en] ?? 0}
              onClick={(e) => {
                e.stopPropagation();
                if (gone || spell.casting) return;
                setWob((w) => ({ ...w, [t.en]: Date.now() }));
                onTap?.(t);
              }}
            >
              <Talisman look={look} tilt={tiltOf(t.ja)} tag={t} mode={gone ? 'fall' : 'drop'} delay={gone ? i * 120 : b.delay} gold={spell.gold} />
            </span>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-floating-spell={look}
      data-gold-spell={spell.gold ? '' : undefined}
      data-casting-spell={spell.casting ? '' : undefined}
      data-leaving-spell={spell.leaving ? '' : undefined}
      aria-label={`スペル：${spell.tags.map((t) => t.ja).join('・')}`}
      style={spell.leaving ? { opacity: 0, transform: 'translateY(-26px)', filter: 'blur(5px) brightness(1.5)', transition: 'opacity 1s ease-in, transform 1.1s ease-in, filter 1s ease-in' } : undefined}
    >
      <style>{LOOK_CSS + CSS}</style>
      {/* a faint mist of the look's light behind them all */}
      <span
        aria-hidden
        className="absolute block rounded-[50%]"
        style={{ left: cx, top: top - 18, width: Math.min(layout.width * scale + 120, 520), height: (layout.height + manaH) * scale + 40, background: `radial-gradient(ellipse at center, ${g.aura.replace(/[\d.]+\)$/, '0.16)')}, transparent 70%)`, animation: 'fs-mist 7s ease-in-out infinite', opacity: spell.casting ? 0 : undefined, transition: 'opacity .8s ease-in .6s' }}
      />
      {spell.tags.map((t, i) => one(t, i, false))}
      {spell.removed.map((t, i) => one(t, i, true))}
      {manaH > 0 && (
        <div
          className="absolute flex -translate-x-1/2 items-baseline gap-4 whitespace-nowrap"
          style={{ left: cx, top: manaTop ?? bottom - manaH * scale + 2, fontSize: 13.5 * (manaTop != null ? 0.92 : Math.max(scale, 0.85)), color: g.ink, textShadow: `0 0 2px rgba(4,8,30,.95), 0 1px 3px rgba(4,8,30,.9), ${g.shadow}`, fontFamily: face(look), letterSpacing: '.08em', animation: spell.casting ? 'none' : `fs-mana 1.2s ease-out ${300 + spell.tags.length * 230}ms both`, opacity: spell.casting ? 0 : 1, transition: 'opacity .35s ease-in' } as CSSProperties}
          data-testid="spell-mana"
        >
          <span>
            {spell.gold ? '上級魔法・' : ''}使うマナ <b style={{ fontSize: '1.45em', color: g.num, fontWeight: 400 }}>{formatMana(spell.price)}</b>
          </span>
          {spell.have != null && <span style={short ? { color: '#ffb4a0' } : { opacity: 0.8 }}>いま {spell.have}マナ</span>}
        </div>
      )}
    </div>
  );
}

/** the talk's record of a spell (scrolling back still shows what was cast): 「スペル：夏・海・ポップ…」 */
export function SpellRecord({ tags }: { tags: SpellTag[] }) {
  const words = tags.slice(0, 10).map((t) => t.ja).join('・') + (tags.length > 10 ? '…' : '');
  return (
    <span className="block text-[11.5px] font-medium leading-snug tracking-[.04em]" style={{ color: 'var(--talk-ink, currentColor)', opacity: 0.62 }} data-testid="spell-record">
      スペル：{words}
    </span>
  );
}
