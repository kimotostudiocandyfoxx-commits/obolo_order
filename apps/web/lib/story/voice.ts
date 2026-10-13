/**
 * Story voices (client plan 2026-10-13): one audio file per spoken line, named by what is said — the
 * speaker, how (〔…〕/（…）) and the words — so a line keeps its voice when lines around it change, and
 * a changed line gets a new one. Lines with names that differ per member ({name}, {neo}, …) are not
 * pre-voiced.
 */
export function voiceKey(who: string, act: string | undefined, text: string): string {
  const s = `${who}|${act ?? ''}|${text}`;
  let h1 = 2166136261;
  let h2 = 5381;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = (Math.imul(h2, 33) + c) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

/** A line that can be voiced ahead of time: no per-member names, and words to say (「…………。」 is a silence). */
export const voiceable = (text: string) => !/\{[a-z_]+\}/.test(text) && /[\p{L}\p{N}]/u.test(text.replace(/[ー〜～]/g, ''));
