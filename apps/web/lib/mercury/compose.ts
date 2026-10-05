import { P, type Song } from './sea';

/**
 * PLACEHOLDER (P-MER-3): "talk to KIMORIN / Bati and they make a song". Until real AI composition
 * (lyrics by the AI provider, music by the instrumental generator, spec §7) is wired, the song is
 * built here from the visitor's words: a title, four lines of lyrics, a record and a synth groove.
 */
export type Genre = 'pop' | 'rock' | 'hiphop' | 'ballad' | 'edm';

export const GENRES: { id: Genre; label: string }[] = [
  { id: 'pop', label: 'ポップ' },
  { id: 'rock', label: 'ロック' },
  { id: 'hiphop', label: 'ヒップホップ' },
  { id: 'ballad', label: 'バラード' },
  { id: 'edm', label: 'EDM' },
];

const EMOJI: [RegExp, string][] = [
  [/ラーメン|らーめん|麺/, '🍜'],
  [/カレー/, '🍛'],
  [/ごはん|ご飯|おにぎり|飯/, '🍙'],
  [/遅刻|ちこく|寝坊|朝/, '⏰'],
  [/猫|ねこ|ネコ/, '🐈'],
  [/犬|いぬ|イヌ|散歩/, '🐕'],
  [/雨|あめ/, '☔'],
  [/学校|授業|テスト|宿題/, '🏫'],
  [/海|うみ|夏/, '🌊'],
  [/恋|好き|すき|デート/, '💘'],
  [/仕事|会社|バイト/, '💼'],
  [/眠|ねむ|夜|月/, '🌙'],
  [/友達|ともだち|ダチ/, '🤝'],
  [/空|そら|星/, '🌌'],
];

const LINES: Record<Genre, (t: string) => string[]> = {
  pop: (t) => [t, 'それだけで 今日はいい日', 'ラララ 明日もきっと', `${t} ラララ`],
  rock: (t) => [`${t}！`, '止まらない 走り出せ', '叫べ 叫べ 今日の自分を', `${t}！ Yeah!`],
  hiphop: (t) => [`Yo ${t}`, 'それが俺のリアル チェケラ', '日常こそがネタ 今日もフロウ', `${t} Yeah`],
  ballad: (t) => [t, 'ふと思い出す あの景色', '何気ない日々が 宝物', `${t}…`],
  edm: (t) => [t, 'ドロップまで あと少し', 'Jump Jump 今夜は', `${t} (Drop)`],
};

const TITLE: Record<Genre, (k: string) => string> = {
  pop: (k) => `${k}のうた`,
  rock: (k) => `${k}ロック`,
  hiphop: (k) => `${k}・フリースタイル`,
  ballad: (k) => `${k}バラード`,
  edm: (k) => `${k} (EDM Mix)`,
};

const GROOVE: Record<Genre, ReturnType<typeof P>> = {
  pop: P(112, 64, 'major', [0, 4, 5, 3], 'triangle'),
  rock: P(150, 52, 'minor', [0, 6, 5, 6], 'sawtooth'),
  hiphop: P(92, 57, 'minor', [0, 5, 3, 4], 'square'),
  ballad: P(72, 62, 'major', [0, 4, 5, 3], 'sine'),
  edm: P(128, 57, 'minor', [0, 5, 3, 4], 'sawtooth'),
};

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** A key word for the title: a recognised topic ("ラーメン", "遅刻"…) or the start of what was said. */
function keyword(text: string) {
  for (const [re] of EMOJI) {
    const m = text.match(re);
    if (m) return m[0];
  }
  const clean = text.replace(/[。、！？!?.,「」『』\s]+/g, ' ').trim();
  const first = (clean.split(' ')[0] || clean).replace(/^(今日|きょう)(の|は)?/, '');
  return [...first].slice(0, 8).join('') || '今日';
}

export function pickGenre(text: string): Genre {
  if (/遅刻|走|急|最悪|ムカ/.test(text)) return 'rock';
  if (/ラーメン|飯|リアル|地元|仲間/.test(text)) return 'hiphop';
  if (/寂し|会いたい|思い出|泣/.test(text)) return 'ballad';
  if (/踊|クラブ|夜|テンション/.test(text)) return 'edm';
  return 'pop';
}

export interface MadeSong extends Song {
  lyrics: string[];
  genre: Genre;
}

export function makeSong(text: string, genre: Genre, artist: string): MadeSong {
  const t = [...text.trim()].slice(0, 24).join('') || '今日のこと';
  const emoji = EMOJI.find(([re]) => re.test(text))?.[1] ?? '🎵';
  const h = hash(text + genre);
  return {
    id: `d-${Date.now().toString(36)}`,
    title: TITLE[genre](keyword(text)),
    artist,
    emoji,
    hue: h % 360,
    seconds: 150 + (h % 90),
    preset: GROOVE[genre],
    lyrics: LINES[genre](t),
    genre,
  };
}
