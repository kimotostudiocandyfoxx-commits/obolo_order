import type { SongMix, SongPhrase } from '@obolo/shared';
import { phraseStarts } from './mix';

/** one sung line of a finished song: when it starts and ends in the mix (seconds), its words, whether it is the chorus */
export interface TimedLyricLine {
  t: number;
  end: number;
  text: string;
  chorus: boolean;
}

/**
 * The lines of a song with their times in the mix, from what the song was made of (the lines' beats, the delay, the gaps
 * after each line, the whole-song tempo). Lines without words are left out (a song with none has no lyrics). The MV's
 * burnt-in lyrics and Mercury's lyrics under the disc (handoff 02 §2, M-R288) read the same times.
 */
export function timedLyrics(phrases: readonly SongPhrase[], design: { bpm?: unknown } | null | undefined, mix: Partial<SongMix> | null | undefined): TimedLyricLine[] {
  const all = [...(phrases ?? [])];
  if (!all.some((p) => p.text?.trim())) return [];
  const bpm = Number(design?.bpm) || 100;
  const tempo = Number(mix?.tempo) || 1;
  // every line's start (gaps are per line, so before leaving out the ones without words)
  const starts = phraseStarts(all, bpm, { delayBeats: mix?.delayBeats ?? 0, gaps: mix?.gaps ?? [] }).map((t) => t / tempo);
  const spb = 60 / bpm;
  return all
    .map((p, i) => ({ p, t: starts[i], next: i + 1 < all.length ? starts[i + 1] : Infinity }))
    .filter(({ p }) => p.text?.trim())
    .map(({ p, t, next }) => ({ t, end: Math.min(next - 0.05, t + (Math.max(p.seconds, p.beats * spb) + 0.4) / tempo), text: p.text.trim(), chorus: p.section === 'chorus' }));
}
