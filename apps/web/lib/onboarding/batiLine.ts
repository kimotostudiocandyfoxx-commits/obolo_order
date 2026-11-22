/**
 * {bati}'s story lines in its own manner (M-R215 / M-R216 / M-R217), deterministic and without a model at runtime:
 * the common styles and the gal kinds use the hand-written variants (@obolo/shared BATI_VARIANTS), a rare one the lines
 * rewritten once at its birth (Me.bati.lines); a line missing from both: the rule fallback (ordinary) or the line as
 * written (rare). Then the 一人称 and the member's own 呼び方. Only {bati}'s say-lines come here (sayText).
 */
import { BATI_VARIANTS, batiRuleTransform, isBatiRare, normalizeBatiPersonality, resolveBatiSpeech, type BatiEggKind, type BatiPersonality, type BatiVariantSet } from '@obolo/shared';

export interface BatiLineVoice {
  personality: BatiPersonality;
  egg?: BatiEggKind;
  /** the 一人称 the birth gave, and the member's own */
  bornSelf?: string | null;
  self?: string | null;
  /** the member's own 呼び方 */
  call?: string | null;
  /** a rare personality's lines, rewritten at birth */
  lines?: Record<string, string>;
}

/** the line in this {bati}'s manner, before fill() (no voice → the line as written) */
export function batiLine(text: string, v?: BatiLineVoice): string {
  if (!v) return text;
  // M-R225: a retired style is said as the nearest current one
  const p = normalizeBatiPersonality(v.personality);
  let said: string;
  if (p === 'genki') said = text;
  else if (isBatiRare(p)) said = v.lines?.[text] ?? text;
  else said = BATI_VARIANTS[text]?.[p as keyof BatiVariantSet] ?? batiRuleTransform(text, p);
  return resolveBatiSpeech(said, { personality: p, egg: v.egg, self: v.self, bornSelf: v.bornSelf, call: v.call });
}

/**
 * Whether the line is said in other words than the script's (a personality's variant, another 一人称 or 呼び方): its
 * pre-made voice (one file per line as written, 元気な子) would say other words, so it plays without a voice.
 */
export function batiLineVaried(text: string, v?: BatiLineVoice): boolean {
  return !!v && batiLine(text, v) !== text;
}

/** the voice of a {bati} from Me.bati (the story's vars) */
export function batiLineVoiceOf(b: { personality?: BatiPersonality; egg?: BatiEggKind; self?: string; selfCustom?: string | null; callCustom?: string | null; lines?: Record<string, string> } | null | undefined): BatiLineVoice | undefined {
  if (!b?.personality) return undefined;
  return { personality: b.personality, egg: b.egg, bornSelf: b.self, self: b.selfCustom, call: b.callCustom, lines: b.lines };
}
