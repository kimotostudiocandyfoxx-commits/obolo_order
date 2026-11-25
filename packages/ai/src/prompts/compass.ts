/**
 * 〔🧭 スペルコンパス〕 (M-R167/M-R168): a picture or a song → its spell, as many small Japanese cards grouped by
 * kind. The cards never carry a real person's, painter's, singer's, work's or character's name, nor the features
 * that would tell a real person's face. Nothing is kept.
 */
export type CompassKind = 'art' | 'song';
export const COMPASS_GROUPS: Record<CompassKind, string[]> = {
  art: ['絵のタッチ', 'キャラ', '背景', '色と光', '構図', '雰囲気'],
  song: ['ジャンル', '速さとリズム', '楽器', '声', '曲の形', '雰囲気'],
};

export function compassPrompt(kind: CompassKind, focus?: string): string {
  const groups = COMPASS_GROUPS[kind];
  const one = focus && groups.includes(focus) ? focus : null;
  return [
    kind === 'art' ? 'You read the style of the attached picture.' : 'You listen to the attached song (or the song at the given link) and read its style.',
    'Answer as JSON only: {"cards":[{"group":"…","text":"…"}]}.',
    `Groups (use these exact Japanese names): ${groups.join(' / ')}.`,
    one
      ? `Only the group "${one}": give 8 to 14 fine, specific cards for it.`
      : 'Give a rough read across all groups: 2 to 3 cards for each group that applies.',
    'Each card is short natural Japanese (1 to 10 characters), concrete and kid-friendly, e.g. 水彩 / にじみ / 二頭身 / 夕暮れの海辺 / 逆光 / 下から見上げる / なつかしい / シティポップ / 四つ打ち / ピアノ / ささやく声 / サビから始まる.',
    'Never write a real person, painter, singer, band, studio, work, brand or character name; describe the style instead. If a real person appears, do not describe features that would identify their face (only general things like 笑顔 or 帽子).',
    'No numbers, no English words unless they are common in Japanese (EDM, BPM is not allowed).',
  ].join(' ');
}

/**
 * R12 (the Moon's コンパス, {bati}'s tool): a picture or a song (a YouTube link) read straight into a spell — tags with a
 * short Japanese label and the English term a generator understands (the same shape as POST /moon/spell). A song is
 * read "in the style of" only: what it sounds like, never its words, its title, or the name of whoever made it.
 * COMPASS_SPELL marks the prompt (the offline provider answers it).
 */
export const COMPASS_SPELL_GROUPS: Record<CompassKind, string> = {
  art: 'theme (what is in it: the subject, the place), style (the touch: watercolor, anime style, oil painting, pixel art, pencil sketch, paper cut art, 3D render, crayon drawing, picture book illustration), mood, color, light, composition',
  song: 'theme (what it is about, as a scene or a feeling), genre, mood, tempo, instrument, voice (soft vocals, powerful vocals, female vocals, male vocals …)',
};
const SPELL_RULES = [
  'Answer as JSON only: {"tags":[{"ja":"…","en":"…","group":"…"}]}.',
  'Each "ja" is a short, plain Japanese label a child can read (1 to 8 characters). Each "en" is the short English term an image or music generator understands (1 to 6 words).',
  'Give 6 to 10 tags, at most one style / genre / tempo / voice / composition each.',
  'Never write a real person, painter, singer, band, producer, studio, label, song title, work, brand, character or place name, in either language; describe the sound or the look instead (e.g. "1980s city pop", not a singer). No lyrics, no words from the title.',
  'If a real person appears, do not describe features that would identify their face (only general things like smiling or a hat).',
  'Nothing sexual, violent or hateful.',
];
export function compassSpellPrompt(kind: CompassKind): string {
  return [
    'COMPASS_SPELL',
    kind === 'art'
      ? 'You read the attached picture as a generation spell for a new square illustration in the same spirit: its touch, colours, light, composition and what is in it.'
      : 'You listen to the song in the attached video and read it as a generation spell for a new, original song in the same style: its genre, mood, tempo, instruments, voice and what it is about.',
    `Groups (use these exact English group names): ${COMPASS_SPELL_GROUPS[kind]}.`,
    ...SPELL_RULES,
  ].join(' ');
}

/**
 * R12: the fallback when the video itself can not be read — only its title and channel (YouTube's oEmbed), from which
 * the model infers what the song probably sounds like. The names are only a hint; they never appear in the tags.
 */
export function compassTitlePrompt(): string {
  return [
    'COMPASS_SPELL',
    'You get the title and the channel of a song video on YouTube. Infer what the song most likely sounds like and write a generation spell for a new, original song in that style.',
    `Groups (use these exact English group names): ${COMPASS_SPELL_GROUPS.song}.`,
    ...SPELL_RULES,
    'If you can not tell, give a gentle, general guess (pop, bright, mid tempo).',
  ].join(' ');
}
