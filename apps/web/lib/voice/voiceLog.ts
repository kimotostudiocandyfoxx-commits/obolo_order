/**
 * R9: when a line's bubble and its voice started (ms from the line arriving) — kept on window.__voiceLog for the review
 * shots and the console (debug level).
 */
export function logVoice(how: 'together' | 'words first', id: string, ms: number) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __voiceLog?: { how: string; id: string; ms: number; at: number }[] };
  (w.__voiceLog ??= []).push({ how, id, ms: Math.round(ms), at: Date.now() });
  console.debug(`[voice] ${how} after ${Math.round(ms)} ms (${id})`);
}
