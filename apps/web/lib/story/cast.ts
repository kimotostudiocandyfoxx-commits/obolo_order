/**
 * Who can speak in the story, with how their name shows and their standing picture
 * (public/onboarding/<sprite>.webp). A speaker the script uses that is not here is listed in the
 * import report; the player still shows the line, with the name as written and no picture.
 * {neo} / {bati} speak as the visitor's own names.
 */
export interface CastMember {
  /** the name in the script (before 「) */
  name: string;
  /** the standing picture(s), if there is one yet */
  sprite?: string;
}

export const CAST: CastMember[] = [
  { name: 'KIMORIN', sprite: 'kimorin-1' },
  { name: 'OBOLON' },
  { name: 'MONBAN' },
  { name: 'バティ', sprite: '@bati' },
  { name: 'たこ焼きブラザー', sprite: 'takoyaki-brother' },
  { name: 'たこ焼きシスター', sprite: 'takoyaki-sister' },
  { name: '大根カイザー' },
  { name: 'フリージー', sprite: 'freezy' },
  { name: 'ヒポキン', sprite: 'hipokin' },
  { name: 'ロングG' },
  { name: 'ハットG', sprite: 'hatg' },
  { name: 'ボスG', sprite: 'bossg' },
  { name: 'うんちピンポンくん' },
  { name: '小箱' },
];

export const STORY_SPEAKERS = CAST.map((c) => c.name);
