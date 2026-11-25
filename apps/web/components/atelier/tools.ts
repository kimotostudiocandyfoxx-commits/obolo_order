import { isHappy, isNo, shouldOfferSave, spellSaid, spellToolIntent, SPELL_BOOK_KINDS, SPELL_TOOL_MEMORY_EMPTY, youtubeLink, type SpellBookKind, type SpellKind, type SpellToolMemory } from '@obolo/shared';
import { isYes } from './plan';

/**
 * R12 (client 2026-11-25): what the member's words do with {bati}'s two tools in the Moon chat (AtelierChat runs the
 * step): a YouTube link → the compass reads it; 「コンパス出して」; 「スペルブック出して」 and, while it is open, its pages,
 * 「〇〇使って」 and 「とじて」; 「しまっておいて」 / 「名前を〇〇にして」 / 「〇〇は捨てて」; the answers to {bati}'s questions
 * (しまっておく？ / 捨てていい？ / もとにする？); and, a work just done and liked, {bati}'s offer to keep its spell.
 * Nothing here → the chat goes on as before (null).
 */
export type ToolAsk = 'save' | 'drop' | 'base' | 'compass';
export type ToolCtx = {
  /** {bati}'s own question waiting (or the compass out, waiting for something to read) */
  asked: ToolAsk | null;
  /** a spell waiting for its yes: only a link / the compass / the book's words go before it */
  plan: boolean;
  bookOpen: boolean;
  /** a spell was cast in this talk, and its work is done */
  cast: boolean;
  castDone: boolean;
  /** that spell is in the book already */
  kept: boolean;
  /** R13: a spell to show now (one waiting for its yes, or the one cast last) */
  spell?: boolean;
  mem: SpellToolMemory;
};
export type ToolAction =
  | { do: 'compassLink'; url: string }
  | { do: 'compassOpen' }
  | { do: 'bookOpen' }
  /** R13: 「スペル（プロンプト）見せて」 — the spell now shown again; `none`: there is no spell yet ({bati} offers to make one) */
  | { do: 'show' }
  | { do: 'noSpell' }
  | { do: 'bookClose'; quiet?: boolean }
  | { do: 'page'; step: 1 | -1 }
  | { do: 'save' }
  | { do: 'rename'; name: string }
  | { do: 'discard'; query: string }
  | { do: 'use'; query: string; named: boolean }
  | { do: 'offer' }
  | { do: 'yes'; to: Exclude<ToolAsk, 'compass'> }
  | { do: 'no'; to: Exclude<ToolAsk, 'compass'> };

const SAVE_YES = /^(しまって|しまっといて|しまっておいて|しまう|入れて|いれて|保存|お願い|おねがい|よろしく)/;

export function toolStep(text: string, c: ToolCtx): ToolAction | null {
  // R13: プロンプト / 呪文 / 指示文 are said for the spell
  const t = spellSaid(text.trim());
  const url = youtubeLink(t);
  if (url) return { do: 'compassLink', url };
  if (c.asked && c.asked !== 'compass') {
    const yes = isYes(t) || (c.asked === 'save' && SAVE_YES.test(t.replace(/[\s、。！!]/g, ''))) || (c.asked === 'drop' && /^(捨てて|すてて|いいよ|うん)/.test(t));
    if (yes) return { do: 'yes', to: c.asked };
    if (isNo(t)) return { do: 'no', to: c.asked };
  }
  const it = spellToolIntent(t, c.bookOpen);
  if (it) {
    switch (it.tool) {
      case 'compass':
        return { do: 'compassOpen' };
      case 'book':
        return { do: 'bookOpen' };
      case 'show':
        // 「プロンプト出して」 with no spell now is the book; 「プロンプト見せて」 with none: {bati} says so
        if (c.spell || c.plan) return { do: 'show' };
        return it.out ? { do: 'bookOpen' } : { do: 'noSpell' };
      case 'close':
        return { do: 'bookClose' };
      case 'page':
        return { do: 'page', step: it.step };
      case 'save':
        return { do: 'save' };
      case 'rename':
        return { do: 'rename', name: it.name };
      case 'discard':
        return { do: 'discard', query: it.query };
      case 'use':
        return { do: 'use', query: it.query, named: it.named };
    }
  }
  if (!c.plan && !c.asked && c.cast && c.castDone && shouldOfferSave(c.mem, { happy: isHappy(t), kept: c.kept })) return { do: 'offer' };
  if (c.bookOpen) return { do: 'bookClose', quiet: true };
  return null;
}

/** the kept kinds (a chapter's small spell is not kept) */
export const bookKindOf = (k: SpellKind | null | undefined): SpellBookKind | null => (k && (SPELL_BOOK_KINDS as readonly string[]).includes(k) ? (k as SpellBookKind) : null);

const MEM_KEY = 'obolo.spelltools.v1';
/** this device's memory of {bati}'s offers (works made, when it last offered / suggested) */
export function toolMemory(): SpellToolMemory {
  try {
    const m = JSON.parse(localStorage.getItem(MEM_KEY) ?? 'null') as Partial<SpellToolMemory> | null;
    return { ...SPELL_TOOL_MEMORY_EMPTY, ...(m ?? {}) };
  } catch {
    return { ...SPELL_TOOL_MEMORY_EMPTY };
  }
}
export function saveToolMemory(m: SpellToolMemory) {
  try {
    localStorage.setItem(MEM_KEY, JSON.stringify(m));
  } catch {
    /* not kept on this device */
  }
}

/** where the tools float: the compass over the bowl (its centre), the book's spread (its width and top) */
export function compassAt(bowl: { x: number; y: number }, bottom: number, scale: number, top: number): { x: number; y: number; size: number } {
  const size = Math.max(118, Math.min(176, (bottom - top) * 0.62));
  const y = Math.max(top + size / 2 + 8, bottom - size / 2 - 26 * scale);
  return { x: bowl.x, y, size };
}
export function bookAt(w: number, bottom: number, top: number): { w: number; top: number; h: number } {
  let bw = Math.min(w - 32, 400);
  // the spread is 0.66 as tall as it is wide (and the page number under it)
  const room = bottom - top - 30;
  if (bw * 0.66 + 22 > room) bw = Math.max(220, (room - 22) / 0.66);
  const h = bw * 0.66 + 22;
  return { w: bw, top: Math.max(top + 4, bottom - h - 6), h };
}
