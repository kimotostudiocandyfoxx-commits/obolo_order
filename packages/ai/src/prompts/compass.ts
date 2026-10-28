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
