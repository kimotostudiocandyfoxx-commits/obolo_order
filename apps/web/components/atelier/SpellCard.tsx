'use client';

import type { SpellTag } from '@obolo/shared';
import type { AtelierKind } from '@/lib/atelier/unlock';
import { KIND_WORD } from './intent';
import { KindMark } from './WorkCard';
import { FRAME, LOOK_CSS, Talisman, useSpellFont, type SpellLook } from './spellLooks';

/** the incantation face for the tags (Google Fonts, loaded in app/layout.tsx; OFL) */
export const SPELL_FONT = '"Yuji Syuku", "Shippori Mincho", "Hiragino Mincho ProN", serif';

const CSS = `
@keyframes fuda-drop{0%{opacity:0;transform:translateY(-46px) rotate(calc(var(--tilt) - 14deg))}55%{opacity:1;transform:translateY(5px) rotate(calc(var(--tilt) + 4deg))}78%{transform:translateY(-2px) rotate(calc(var(--tilt) - 1deg))}100%{opacity:1;transform:translateY(0) rotate(var(--tilt))}}
@keyframes fuda-fall{0%{opacity:1;transform:translateY(0) rotate(var(--tilt))}25%{transform:translateY(-4px) rotate(calc(var(--tilt) - 6deg))}100%{opacity:0;transform:translateY(70px) rotate(calc(var(--tilt) + 28deg))}}
@keyframes fuda-gone{0%,98%{max-width:220px}100%{max-width:0}}
@keyframes fuda-in{from{opacity:0;transform:translateY(6px) rotate(var(--tilt))}to{opacity:1;transform:translateY(0) rotate(var(--tilt))}}
@keyframes fuda-sway{0%,100%{transform:rotate(var(--tilt))}50%{transform:rotate(calc(var(--tilt) + 1.6deg))}}
`;

/** a small steady tilt per tag (the same tag always hangs the same way) */
const tiltOf = (s: string) => ((([...s].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7) % 9) - 4) * 0.9).toFixed(1);

/** one wooden tag: grain, a string hole at the top, the word in the incantation face */
function Fuda({ tag, mode, delay, onDrop }: { tag: SpellTag; mode: 'still' | 'drop' | 'fall'; delay: number; onDrop?: () => void }) {
  const tilt = `${tiltOf(tag.ja)}deg`;
  const anim = mode === 'drop' ? `fuda-drop .7s cubic-bezier(.3,.7,.3,1) ${delay}ms both` : mode === 'fall' ? `fuda-fall .9s ease-in ${delay}ms forwards, fuda-gone ${900 + delay}ms linear forwards` : `fuda-in .35s ease-out ${delay}ms both`;
  return (
    <span className="relative inline-block pt-[5px]" style={{ ['--tilt' as string]: tilt, transformOrigin: '50% 0', animation: anim }} data-fuda={mode} aria-label={tag.ja}>
      {/* the string it hangs from */}
      <span className="absolute left-1/2 top-0 block h-[7px] w-px -translate-x-1/2 bg-[#6b4a2a]/70" />
      <span
        className="relative flex min-w-[38px] items-center justify-center px-2 pb-[4px] pt-[10px] text-[14px] leading-none text-[#3a210d]"
        style={{
          fontFamily: SPELL_FONT,
          clipPath: 'polygon(14% 0, 86% 0, 100% 16%, 100% 100%, 0 100%, 0 16%)',
          background:
            'radial-gradient(circle at 50% 5px, #3b2410 0 2px, #8a5a2b 2.4px 3.1px, transparent 3.5px), repeating-linear-gradient(91deg, rgba(110,62,22,.13) 0 1.5px, transparent 1.5px 5px, rgba(110,62,22,.07) 5px 6px, transparent 6px 11px), linear-gradient(180deg, #f0d29c 0%, #e2b678 55%, #d3a061 100%)',
          boxShadow: 'inset 0 -2px 0 rgba(90,50,15,.25), inset 0 1px 0 rgba(255,240,210,.6)',
          textShadow: '0 1px 0 rgba(255,235,200,.55)',
        }}
      >
        {tag.ja}
        {onDrop && mode !== 'fall' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDrop();
            }}
            aria-label={`${tag.ja}を外す`}
            className="-mr-0.5 ml-1 flex h-[13px] w-[13px] items-center justify-center rounded-full bg-[#5a3714]/15 font-sans text-[9px] leading-none text-[#5a3714]"
          >
            ✕
          </button>
        )}
      </span>
    </span>
  );
}

/**
 * R11 (client): the スペル {bati} will cast, as many small 木札 in a row — Japanese only (the English behind each tag is
 * never shown). Tags put on by the last change drop in, ones taken off fall away; the mana it takes and the mana you
 * have under them (the buttons are the bubble's chips). `onDrop`: while the card is the one waiting, a tag's ✕.
 */
export function SpellCard({ spell, onDrop, variant = 'wood' }: { spell: { kind: AtelierKind; tags: SpellTag[]; added?: SpellTag[]; removed?: SpellTag[]; price: number; have: number | null; done?: string }; onDrop?: (en: string) => void; variant?: SpellLook }) {
  useSpellFont(variant);
  const added = new Set((spell.added ?? []).map((t) => t.en));
  const short = spell.have != null && spell.have < spell.price;
  let k = 0;
  if (variant !== 'wood') {
    // client 2026-11-24: the talisman looks (spellLooks.tsx); the same tags, drops and mana, dressed per look
    const f = FRAME[variant];
    return (
      <span className={`relative mt-1 block w-[min(340px,calc(100vw-72px))] overflow-hidden px-2 pb-2 pt-2 ${f.cardClass}`} style={f.card} data-testid="spell-card" data-look={variant}>
        <style>{LOOK_CSS}</style>
        {f.back}
        <span className="relative flex items-center gap-1.5 pl-0.5 pr-1" style={f.title}>
          <KindMark kind={spell.kind} className="h-3.5 w-3.5" />
          {KIND_WORD[spell.kind]}のスペル
          {f.titleMark}
        </span>
        <span className={`relative mt-1.5 flex flex-wrap ${f.row}`}>
          {spell.tags.map((t) => (
            <Talisman key={`${t.group}-${t.en}`} look={variant} tilt={Number(tiltOf(t.ja))} tag={t} mode={added.has(t.en) ? 'drop' : 'still'} delay={added.has(t.en) ? 120 + 160 * k++ : k++ * 40} onDrop={onDrop ? () => onDrop(t.en) : undefined} />
          ))}
          {(spell.removed ?? []).map((t, i) => (
            <Talisman key={`gone-${t.en}`} look={variant} tilt={Number(tiltOf(t.ja))} tag={t} mode="fall" delay={i * 120} />
          ))}
        </span>
        <span className={`relative mt-2 flex items-baseline justify-between gap-2 border-t pt-1.5 text-[11.5px] ${f.rule}`} style={f.mana}>
          <span>
            使うマナ <b style={f.price}>{spell.price}</b>
          </span>
          {spell.have != null && <span style={short ? f.short : f.have}>いま {spell.have}マナ</span>}
        </span>
      </span>
    );
  }
  return (
    <span className="mt-1 block w-[min(330px,78vw)] rounded-xl border border-[#4a3410]/15 bg-[linear-gradient(180deg,rgba(255,250,238,.75),rgba(244,230,200,.75))] px-2.5 pb-2 pt-1.5 text-[#4a3410]" data-testid="spell-card">
      <style>{CSS}</style>
      <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[.2em] text-[#4a3410]/65">
        <KindMark kind={spell.kind} className="h-3.5 w-3.5" />
        {KIND_WORD[spell.kind]}のスペル
      </span>
      <span className="mt-1 flex flex-wrap items-start justify-center gap-x-1 gap-y-0.5">
        {spell.tags.map((t) => (
          <Fuda key={`${t.group}-${t.en}`} tag={t} mode={added.has(t.en) ? 'drop' : 'still'} delay={added.has(t.en) ? 120 + 140 * k++ : k++ * 35} onDrop={onDrop ? () => onDrop(t.en) : undefined} />
        ))}
        {(spell.removed ?? []).map((t, i) => (
          <Fuda key={`gone-${t.en}`} tag={t} mode="fall" delay={i * 120} />
        ))}
      </span>
      <span className="mt-2 flex items-baseline justify-between gap-2 border-t border-[#4a3410]/12 pt-1.5 text-[11.5px]">
        <span>
          使うマナ <b className="text-[15px] text-[#2f5fa8]">{spell.price}</b>
        </span>
        {spell.have != null && <span className={short ? 'font-semibold text-[#b03a2e]' : 'text-[#4a3410]/70'}>いま {spell.have}マナ</span>}
      </span>
    </span>
  );
}
