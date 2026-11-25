'use client';

import type { SpellTag } from '@obolo/shared';
import type { AtelierKind } from '@/lib/atelier/unlock';
import { KIND_WORD } from './intent';
import { KindMark } from './WorkCard';
import { FRAME, LOOK_CSS, Talisman, spellLookFor, useSpellFont, type TalismanLook } from './spellLooks';

/** a small steady tilt per tag (the same tag always hangs the same way) */
const tiltOf = (s: string) => (([...s].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7) % 9) - 4) * 0.9;

/**
 * R11 (client): the スペル {bati} will cast, as many small talismans (札) in a row — Japanese only (the English behind each
 * tag is never shown). Tags put on by the last change come in, ones taken off go away (burn, dust, light, peel — per look);
 * the mana it takes and the mana you have under them (the buttons are the bubble's chips). `onDrop`: while the card is the
 * one waiting, a tag's ✕. Client 2026-11-25: the look follows the work kind (spellLookFor); `variant` overrides it.
 */
export function SpellCard({ spell, onDrop, variant }: { spell: { kind: AtelierKind; tags: SpellTag[]; added?: SpellTag[]; removed?: SpellTag[]; price: number; have: number | null; done?: string }; onDrop?: (en: string) => void; variant?: TalismanLook }) {
  const look = variant ?? spellLookFor(spell.kind);
  useSpellFont(look);
  const added = new Set((spell.added ?? []).map((t) => t.en));
  const short = spell.have != null && spell.have < spell.price;
  const f = FRAME[look];
  let k = 0;
  return (
    <span className={`relative mt-1 block w-[min(340px,calc(100vw-72px))] overflow-hidden px-2 pb-2 pt-2 ${f.cardClass}`} style={f.card} data-testid="spell-card" data-look={look}>
      <style>{LOOK_CSS}</style>
      {f.back}
      <span className="relative flex items-center gap-1.5 pl-0.5 pr-1" style={f.title}>
        <KindMark kind={spell.kind} className="h-3.5 w-3.5" />
        {KIND_WORD[spell.kind]}のスペル
        {f.titleMark}
      </span>
      <span className={`relative mt-1.5 flex flex-wrap ${f.row}`}>
        {spell.tags.map((t) => (
          <Talisman key={`${t.group}-${t.en}`} look={look} tilt={tiltOf(t.ja)} tag={t} mode={added.has(t.en) ? 'drop' : 'still'} delay={added.has(t.en) ? 120 + 160 * k++ : k++ * 40} onDrop={onDrop ? () => onDrop(t.en) : undefined} />
        ))}
        {(spell.removed ?? []).map((t, i) => (
          <Talisman key={`gone-${t.en}`} look={look} tilt={tiltOf(t.ja)} tag={t} mode="fall" delay={i * 120} />
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
