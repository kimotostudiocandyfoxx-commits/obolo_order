import { LYRIC_HINT_DEFS, LYRIC_SECTION_DEFS, lyricsNormalize, lyricsSheet, spellPrompt, spellWords, type SongLyrics, type SpellTag } from '@obolo/shared';

/**
 * R13 (client 2026-11-25): {bati} writes a song's スペル入りの歌詞 — Japanese lyrics in blocks, each opened by a metatag the
 * song engine (ACE-Step 1.5) reads. The writer is LYRICS_LLM (LYRICS_MODEL: Gemini Flash now, Claude by config). Only the
 * tags our engine benefits from are offered (LYRIC_SECTION_DEFS / LYRIC_HINT_DEFS in @obolo/shared, from ACE-Step's own
 * lyric conventions); the answer is read by lyricsNormalize (anything else is dropped).
 * Three asks: a fresh song (the request + the style spell), a change (the lyrics as they are + the words), the member's
 * own lyrics (structured with tags, the words kept). Original lyrics only: a real song's lyrics are never written, and
 * pasted ones are answered with {"copy": true} plus original lyrics in that mood.
 */
const SECTIONS = Object.values(LYRIC_SECTION_DEFS)
  .map((d) => `${d.en}${d.sung ? '' : ' (instrumental, no lines)'}`)
  .join(', ');
const HINTS = Object.values(LYRIC_HINT_DEFS)
  .map((d) => d.en)
  .join(', ');

export type LyricsAsk = { mode: 'new'; said: string; tags: SpellTag[] } | { mode: 'edit'; said: string; tags: SpellTag[]; lyrics: SongLyrics } | { mode: 'own'; said: string; tags: SpellTag[] };

export function lyricsSystem(): string {
  return [
    'You write song lyrics in Japanese for a music app used by children and teenagers, as the buddy character バティ. The lyrics are sung by an AI singer (ACE-Step), so they are laid out in blocks, each opened by one structure tag, with at most two performance tags.',
    `Structure tags (use only these): ${SECTIONS}.`,
    `Performance tags (optional, at most 2 per block, only when they help): ${HINTS}.`,
    'A usual song: Intro, Verse, Pre-Chorus, Chorus, Bridge, Final Chorus, Outro (about 18–26 sung lines). A short one may drop the Bridge. A second verse (2番) is a Verse + Pre-Chorus + Chorus after the first Chorus.',
    'Lines: natural singable Japanese (mostly hiragana and easy kanji), 6–14 characters, 2–6 lines per block, one breath each; lines in the same position have similar length; the chorus has a short hook that repeats; one core image through the song (no adjective stacking, no mixed metaphors). No tags, brackets or English inside the lines. Never write the tags as lyrics.',
    'Original lyrics only: never write or quote the lyrics of an existing song, a real singer or band, a brand or a character. If the user pasted lyrics that are clearly from an existing published song, answer with "copy": true and write NEW original lyrics in that mood and theme instead (never reuse its lines).',
    'Nothing sexual, violent, hateful, scary or about self-harm; kind words only. The tags agree with the style (a guitar solo only if a guitar fits; whispered only in a quiet part).',
    'Return ONLY JSON: {"title": short Japanese song title (max 12 characters), "copy": false, "blocks": [{"tag": "Verse", "hints": ["whispered"], "lines": ["…", "…"]}, …]}. Instrumental blocks have "lines": [].',
  ].join('\n');
}

export function lyricsRequest(a: LyricsAsk): string {
  const style = `Style spell: ${spellPrompt('song', a.tags)} (in Japanese: ${spellWords(a.tags)})`;
  if (a.mode === 'new') return [style, `The user's request (Japanese): ${a.said}`, 'Write the lyrics.'].join('\n');
  if (a.mode === 'own')
    return [
      style,
      "The user's own lyrics (keep their words and order exactly; fix only obvious typos; you may repeat their chorus lines). Put them into blocks with structure tags, add Intro / Outro and the performance tags that fit. If the user's words are too few for a song, keep them as they are in fewer blocks (do not invent more lines). If they are from an existing published song, set copy true and write original lyrics in that mood instead.",
      a.said,
    ].join('\n');
  return [
    style,
    'The lyrics now:',
    lyricsSheet(a.lyrics),
    `The user's change (Japanese): ${a.said}`,
    'Return the whole lyrics with the change made. Keep every block, tag and line the change does not touch exactly as it is (same words). Change only what was asked (e.g. "サビをもっと明るく" → rewrite the chorus lines brighter; "2番を足して" → add Verse + Pre-Chorus + Chorus for a second verse with new lines, after the first Chorus).',
  ].join('\n');
}

/** the writer's answer → lyrics (null: not usable) and whether it said the words were a real song's */
export function parseLyricsAnswer(raw: string): { lyrics: SongLyrics | null; copy: boolean } {
  let j: unknown;
  try {
    j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    try {
      j = m ? JSON.parse(m[0]) : null;
    } catch {
      j = null;
    }
  }
  const o = (j && typeof j === 'object' ? j : {}) as { copy?: unknown };
  return { lyrics: lyricsNormalize(j), copy: o.copy === true };
}
