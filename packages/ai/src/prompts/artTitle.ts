import { ART_TITLE_ASK_MAX, cleanArtTitle, spellWords, type SpellTag } from '@obolo/shared';

/**
 * Story 2026-11-25: {bati} names a picture painted in the Moon atelier — ONE short Japanese title from its spell, by the
 * writer a song's name comes from (LYRICS_LLM; a song's title is part of its lyrics, prompts/lyrics.ts). Asked again
 * (「ほかのタイトルにして」) with the title now, which is never given back.
 */
export function artTitleSystem(): string {
  return [
    'You name pictures in Japanese for a creative app used by children and teenagers, as the buddy character バティ.',
    `Give ONE short, poetic title (max ${ART_TITLE_ASK_MAX} characters) that fits the picture's spell and the request: natural Japanese, mostly hiragana and easy kanji, like the title of a painting (e.g. 夕焼けの町, 屋根の上のねこ, 月と海).`,
    'Never use the name of a real person, brand, existing work or character; no 「〜の絵」「〜のアート」, no quotes, no emoji. Nothing sexual, violent, hateful or scary.',
    'Return ONLY JSON: {"title": "…"}',
  ].join('\n');
}

export function artTitleRequest(a: { tags: SpellTag[]; said: string; before?: string }): string {
  return [
    a.tags.length ? `The picture's spell (Japanese tags): ${spellWords(a.tags)}` : '',
    a.said ? `The user's request (Japanese): ${a.said}` : '',
    a.before ? `The title now is 「${a.before}」: give a different one.` : '',
    'Name the picture.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** the writer's answer → the title (null: not usable) */
export function parseArtTitle(raw: string): string | null {
  const body = raw
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
  let t: unknown;
  try {
    t = (JSON.parse(body) as { title?: unknown }).title;
  } catch {
    t = /"title"\s*:\s*"([^"]+)"/.exec(body)?.[1];
  }
  const title = typeof t === 'string' ? cleanArtTitle(t) : '';
  return title || null;
}
