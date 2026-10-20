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

/** A form named in how a line is said: （第2形態）（形態3）（二の姿） → 2 / 3 / 2; else null. */
export function formOf(act: string | undefined): number | null {
  if (!act) return null;
  const m = act.match(/(?:第\s*)?([1-9１-９一二三四五六七八九])\s*(?:形態|の姿|段階)|形態\s*([1-9１-９])/);
  if (!m) return null;
  const c = m[1] ?? m[2];
  const d = '１２３４５６７８９'.indexOf(c);
  const j = '一二三四五六七八九'.indexOf(c);
  return d >= 0 ? d + 1 : j >= 0 ? j + 1 : Number(c);
}

/**
 * A line that starts with a member's name and a pause (「{name}、\nお前は…」): the words after the name, so they
 * can be voiced ahead of time and spoken while the member's own voice of the whole line is not made yet.
 */
export function nameRest(text: string): string | null {
  const r = text.replace(/^\{[a-z_]+\}(?:[、,，]\s*\n?|\n)/, '');
  return r !== text && voiceable(r) ? r : null;
}
