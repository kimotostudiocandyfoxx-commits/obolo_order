import { P } from '@/lib/mercury/sea';
import type { Kind, Video } from './sky';

/**
 * PLACEHOLDER (P-MARS-3): "talk to KIMORIN / Bati and they make a video". Until real AI video
 * generation is wired, the video is built here from the visitor's words: a title, three scenes for a
 * storyboard, an emoji frame and a synth soundtrack.
 */
export const KINDS: { id: Kind; label: string }[] = [
  { id: 'MV', label: 'MV' },
  { id: '映画', label: '映画' },
  { id: '番組', label: '番組' },
];

const EMOJI: [RegExp, string][] = [
  [/ラーメン|麺/, '🍜'],
  [/ごはん|ご飯|おにぎり/, '🍙'],
  [/遅刻|寝坊|朝/, '⏰'],
  [/猫|ねこ/, '🐈'],
  [/犬|散歩/, '🐕'],
  [/雨/, '☔'],
  [/学校|授業|テスト/, '🏫'],
  [/海|夏/, '🌊'],
  [/恋|好き|デート/, '💘'],
  [/仕事|会社|バイト/, '💼'],
  [/夜|月|星/, '🌙'],
  [/旅|旅行/, '🧳'],
];

const TITLE: Record<Kind, (k: string) => string> = {
  MV: (k) => `${k}のMV`,
  映画: (k) => `${k} - The Movie`,
  番組: (k) => `${k}チャンネル #1`,
  LIVE: (k) => `${k} LIVE`,
};

const SCENES: Record<Kind, (t: string) => string[]> = {
  MV: (t) => [`オープニング：${t}`, 'サビでカメラがぐるっと回る', 'ラストは夕焼けにシルエット'],
  映画: (t) => [`静かな始まり：${t}`, '事件が起きる', 'エンドロール'],
  番組: (t) => [`「どうも！今日のテーマは」${t}`, 'スタジオでトーク', '「また来週！」'],
  LIVE: (t) => [t, '会場が盛り上がる', 'アンコール'],
};

const BGM: Record<Kind, ReturnType<typeof P>> = {
  MV: P(118, 62, 'major', [0, 4, 5, 3], 'square'),
  映画: P(76, 60, 'minor', [0, 3, 4, 3], 'triangle'),
  番組: P(104, 64, 'major', [0, 3, 4, 3], 'triangle'),
  LIVE: P(128, 57, 'minor', [0, 5, 3, 4], 'sawtooth'),
};

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11);

function keyword(text: string) {
  for (const [re] of EMOJI) {
    const m = text.match(re);
    if (m) return m[0];
  }
  const clean = text.replace(/[。、！？!?.,「」『』\s]+/g, ' ').trim();
  const first = (clean.split(' ')[0] || clean).replace(/^(今日|きょう)(の|は)?/, '');
  return [...first].slice(0, 8).join('') || '今日';
}

export function pickKind(text: string): Kind {
  if (/歌|曲|踊/.test(text)) return 'MV';
  if (/話|紹介|語/.test(text)) return '番組';
  return '映画';
}

export function makeVideo(text: string, kind: Kind, author: string): Video {
  const t = [...text.trim()].slice(0, 20).join('') || '今日のこと';
  const h = hash(text + kind);
  return {
    id: `mv-${Date.now().toString(36)}`,
    title: TITLE[kind](keyword(text)),
    kind,
    author,
    emoji: EMOJI.find(([re]) => re.test(text))?.[1] ?? '🎬',
    hue: h % 360,
    seconds: 60 + (h % 180),
    scenes: SCENES[kind](t),
    bgm: BGM[kind],
  };
}
