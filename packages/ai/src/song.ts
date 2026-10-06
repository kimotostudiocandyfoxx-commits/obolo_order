/**
 * Mercury 作曲 (client decision 2026-10-06): talk with the partner → the LLM writes the song →
 * this file turns its answer into a SongDesign: lyrics in kana split into morae, a chord loop and a
 * singable melody of one note per mora. The melody is generated here (not by the LLM) so it always
 * fits the chords and the vocal range — it is what DiffSinger will sing later.
 */
import type { ComposeChatResult, SongDesign, SongLine, SongNote, SongSection } from '@obolo/shared';

export type ComposeGenre = 'pop' | 'rock' | 'hiphop' | 'ballad' | 'edm' | 'auto';

export interface ComposePartner {
  name: string;
  isBati: boolean;
}

const GENRE_JA: Record<Exclude<ComposeGenre, 'auto'>, string> = {
  pop: 'ポップ',
  rock: 'ロック',
  hiphop: 'ヒップホップ',
  ballad: 'バラード',
  edm: 'EDM',
};

function persona(p: ComposePartner) {
  return p.isBati
    ? `あなたは「${p.name}」。ユーザーの相棒のバティ（ユーザーが好きな食べ物から生まれた不思議な生き物）。明るくて素直、ユーザーが大好き。語尾は自然な話し言葉。`
    : `あなたは「KIMORIN（キモリン）」。秘密結社 OBOLO ORDER の案内人で、白いキツネのような姿。面倒見のいい兄貴分。語尾に「〜ケン」「〜だケン」をよく付ける。`;
}

/** The partner's side of the conversation before the song is made. */
export function composeChatSystem(p: ComposePartner): string {
  return `${persona(p)}
いまは水星で、ユーザーと一緒に「ユーザーの曲」を作っている。ユーザーが話した日常のこと・気持ちを歌にするのが目的。
会話のルール:
- 返事は1〜2文、短く。キャラクターとして話す。「AI」などのメタ発言はしない。
- まだ曲のテーマが見えないうちは、何があったか・どんな気持ちかを1つだけ質問する。
- テーマと気持ちが分かったら、「どんな感じの曲にする？」とジャンルを聞く（ready を true にする）。
- 2往復以上したら、内容が少なくても ready を true にしてよい。
- 子どもも使うので健全な言葉で。
出力は JSON だけ: {"reply": "返事", "ready": true か false}`;
}

/** Ask for the song itself (the marker SONG_DESIGN lets the offline mock recognise the call). */
export function songDesignSystem(p: ComposePartner, genre: ComposeGenre): string {
  const g = genre === 'auto' ? '会話の内容に一番合うもの（pop / rock / hiphop / ballad / edm から選ぶ）' : `${GENRE_JA[genre]}（${genre}）`;
  return `SONG_DESIGN
あなたは作詞作曲家。下の会話でユーザーが話したことから、ユーザーのための日本語の歌を1曲作る。
ジャンル: ${g}
ルール:
- 歌詞はユーザーの言葉・出来事を具体的に入れる。前向きで健全に。既存の曲の歌詞は使わない。
- Aメロ（verse）4行、サビ（chorus）4行。各行は歌いやすく、かなにして8〜16音（モーラ）。
- 各行に "kana"（全部ひらがな。漢字・カタカナ・英語も読みをひらがなで。句読点なし、行内の区切りは空白1つ）を付ける。
- progression はローマ数字で4つ（例 ["I","V","vi","IV"]）。
- instrumentalPrompt は英語。伴奏だけの指示（genre, instruments, mood, tempo in BPM, key）。"no vocals" を含める。
- comment は ${p.isBati ? `「${p.name}」` : 'KIMORIN（語尾「ケン」）'} が曲を渡すときのひとこと（1文）。
出力は JSON だけ:
{"title":"曲名","emoji":"曲を表す絵文字1つ","genre":"pop|rock|hiphop|ballad|edm","mood":"気分を短く","bpm":数値,"key":"C〜B（#可）","scale":"major|minor","progression":["I","V","vi","IV"],"verse":[{"text":"歌詞","kana":"かし"}],"chorus":[{"text":"歌詞","kana":"かし"}],"instrumentalPrompt":"...","comment":"..."}`;
}

// ---------------------------------------------------------------------------------------------

/** Pull the first JSON object out of a model answer (tolerates code fences / chatter). */
export function extractJson(raw: string): unknown {
  const t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error('no JSON in model answer');
  }
}

export function parseComposeChat(raw: string): ComposeChatResult {
  try {
    const j = extractJson(raw) as { reply?: unknown; ready?: unknown };
    const reply = typeof j.reply === 'string' && j.reply.trim() ? j.reply.trim().slice(0, 200) : '';
    if (reply) return { reply, ready: j.ready === true };
  } catch {
    /* plain text answer */
  }
  return { reply: raw.trim().slice(0, 200) || '……もう少し聞かせて！', ready: false };
}

// --- kana → morae ------------------------------------------------------------------------------

const SMALL = new Set([...'ゃゅょぁぃぅぇぉゎ']);

export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/**
 * Split kana into morae: small ゃゅょぁぃぅぇぉ join the previous kana, ー lengthens the previous
 * mora (kept as its own held note), っ and ん are morae of their own. Anything else is dropped;
 * spaces become phrase breaks (null).
 */
export function morae(kana: string): (string | null)[] {
  const out: (string | null)[] = [];
  for (const c of toHiragana(kana)) {
    if (/\s|、|。|,|\./.test(c)) {
      if (out.length && out[out.length - 1] !== null) out.push(null);
    } else if (SMALL.has(c) && out.length && out[out.length - 1]) {
      out[out.length - 1] += c;
    } else if (c === 'ー' && out.length && out[out.length - 1]) {
      out.push('ー');
    } else if (/[ぁ-ゖ]/.test(c)) {
      out.push(c);
    }
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

// --- harmony ------------------------------------------------------------------------------------

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] } as const;
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

export function keyRoot(name: string): number {
  const m = /^([A-Ga-g])([#♯b♭]?)/.exec(name.trim());
  if (!m) return 0;
  let pc = NAMES.indexOf(m[1].toUpperCase());
  if (m[2] === '#' || m[2] === '♯') pc++;
  if (m[2] === 'b' || m[2] === '♭') pc--;
  return (pc + 12) % 12;
}

export function romanToDegree(r: string): number {
  const d = ROMAN.indexOf(r.trim().toLowerCase().replace(/[^iv]/g, ''));
  return d < 0 ? 0 : d;
}

function chordTones(root: number, scale: 'major' | 'minor', degree: number): number[] {
  const s = SCALES[scale];
  return [0, 2, 4].map((k) => (root + s[(degree + k) % 7]) % 12);
}

export function chordName(root: number, scale: 'major' | 'minor', degree: number): string {
  const [a, b, c] = chordTones(root, scale, degree);
  const third = (b - a + 12) % 12;
  const fifth = (c - a + 12) % 12;
  return NAMES[a] + (third === 3 ? (fifth === 6 ? 'dim' : 'm') : '');
}

// --- melody -------------------------------------------------------------------------------------

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * One line = 2 bars of 4/4 (4 bars when it has more than 15 morae), one note per mora on eighth
 * notes, the last note held to fill the phrase. Strong beats take the nearest chord tone, weak beats
 * move by step; verse sits lower (C4–A4 area), chorus higher (E4–D5 area), all in the song's key.
 */
export function lineMelody(
  kana: string,
  opt: { root: number; scale: 'major' | 'minor'; progression: number[]; barOffset: number; section: 'verse' | 'chorus' | 'bridge'; seed: string },
): SongNote[] {
  const mora = morae(kana);
  const syll = mora.filter((m) => m !== null).length;
  const bars = syll > 15 ? 4 : 2;
  const total = bars * 4;
  const rand = rng(opt.seed);
  const [lo, hi] = opt.section === 'chorus' ? [64, 74] : [59, 69];
  const s: readonly number[] = SCALES[opt.scale];
  const inScale = (m: number) => s.includes((m - opt.root + 120) % 12);
  const scaleNotes: number[] = [];
  for (let m = lo; m <= hi; m++) if (inScale(m)) scaleNotes.push(m);

  const notes: SongNote[] = [];
  let beat = 0;
  let idx = Math.floor(scaleNotes.length / 2 + (rand() - 0.5) * 3);
  let prev = scaleNotes[Math.max(0, Math.min(scaleNotes.length - 1, idx))];
  const sung = mora.length;
  for (let k = 0; k < sung; k++) {
    const m = mora[k];
    const left = total - 0.5 - beat;
    if (left <= 0) break;
    if (m === null) {
      notes.push({ kana: '', midi: null, beats: 0.5 });
      beat += 0.5;
      continue;
    }
    const last = mora.slice(k + 1).every((x) => x === null);
    const bar = opt.barOffset + Math.floor(beat / 4);
    const tones = chordTones(opt.root, opt.scale, opt.progression[bar % opt.progression.length]);
    const strong = beat % 2 === 0 || last;
    let pitch: number;
    if (m === 'ー') pitch = prev;
    else if (strong) {
      const cands = scaleNotes.filter((n) => tones.includes(n % 12));
      pitch = cands.reduce((a, b) => (Math.abs(b - prev) < Math.abs(a - prev) || (Math.abs(b - prev) === Math.abs(a - prev) && rand() < 0.5) ? b : a), cands[0] ?? prev);
      // phrase ends on the chord root when possible
      if (last) pitch = cands.filter((n) => n % 12 === tones[0]).sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev))[0] ?? pitch;
    } else {
      idx = scaleNotes.indexOf(prev);
      const dir = idx <= 1 ? 1 : idx >= scaleNotes.length - 2 ? -1 : rand() < 0.5 ? -1 : 1;
      pitch = scaleNotes[Math.max(0, Math.min(scaleNotes.length - 1, idx + dir))] ?? prev;
    }
    const beats = last ? Math.max(0.5, left) : 0.5;
    notes.push({ kana: m, midi: pitch, beats });
    beat += beats;
    prev = pitch;
  }
  if (beat < total) notes.push({ kana: '', midi: null, beats: total - beat });
  return notes;
}

// --- the whole design ---------------------------------------------------------------------------

interface RawLine {
  text?: unknown;
  kana?: unknown;
}
interface RawDesign {
  title?: unknown;
  emoji?: unknown;
  genre?: unknown;
  mood?: unknown;
  bpm?: unknown;
  key?: unknown;
  scale?: unknown;
  progression?: unknown;
  verse?: unknown;
  chorus?: unknown;
  instrumentalPrompt?: unknown;
  comment?: unknown;
}

const str = (v: unknown, max: number, def: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : def);

function lines(v: unknown): { text: string; kana: string }[] {
  if (!Array.isArray(v)) return [];
  return (v as RawLine[])
    .map((l) => ({ text: str(l?.text, 40, ''), kana: str(l?.kana, 60, '') }))
    .filter((l) => l.text && morae(l.kana).some((m) => m))
    .slice(0, 6);
}

/** Validate / clamp the model's answer and add the melody. Throws when the answer is unusable. */
export function buildSongDesign(raw: string, partner: ComposePartner, genre: ComposeGenre): SongDesign {
  const j = extractJson(raw) as RawDesign;
  const verse = lines(j.verse);
  const chorus = lines(j.chorus);
  if (!verse.length || !chorus.length) throw new Error('song design without lyrics');
  const scale = j.scale === 'minor' ? 'minor' : 'major';
  const root = keyRoot(str(j.key, 4, 'C'));
  const prog = (Array.isArray(j.progression) ? (j.progression as unknown[]) : []).filter((r): r is string => typeof r === 'string').slice(0, 8).map(romanToDegree);
  const progression = prog.length >= 2 ? prog : scale === 'major' ? [0, 4, 5, 3] : [0, 5, 2, 6];
  const bpm = Math.round(Math.max(60, Math.min(180, Number(j.bpm) || 110)));
  const title = str(j.title, 30, '今日のうた');
  const g = genre !== 'auto' ? genre : (['pop', 'rock', 'hiphop', 'ballad', 'edm'].includes(String(j.genre)) ? String(j.genre) : 'pop');

  let bar = 0;
  const sections: SongSection[] = (
    [
      ['verse', verse],
      ['chorus', chorus],
    ] as const
  ).map(([name, ls]) => ({
    name,
    lines: ls.map((l, i): SongLine => {
      const notes = lineMelody(l.kana, { root, scale, progression, barOffset: bar, section: name, seed: `${title}/${name}/${i}` });
      bar += notes.reduce((a, n) => a + n.beats, 0) / 4;
      return { text: l.text, kana: toHiragana(l.kana), notes };
    }),
  }));
  const beats = sections.flatMap((s) => s.lines).flatMap((l) => l.notes).reduce((a, n) => a + n.beats, 0);
  return {
    title,
    emoji: str(j.emoji, 4, '🎵'),
    genre: g,
    mood: str(j.mood, 30, ''),
    bpm,
    keyRoot: root,
    scale,
    progression,
    chords: progression.map((d) => chordName(root, scale, d)),
    sections,
    instrumentalPrompt: str(j.instrumentalPrompt, 400, `${g} instrumental, ${bpm} bpm, ${NAMES[root]} ${scale}, no vocals`),
    comment: str(j.comment, 120, partner.isBati ? 'できたよ！聴いてみて。' : 'できたケン！聴いてみろ。'),
    seconds: Math.round((beats * 60) / bpm),
  };
}

/** Offline answer (no API key): a small song built from the visitor's words. */
export function mockSongDesign(said: string): string {
  const topic = [...said.replace(/[。、！？!?\s「」]/g, '')].slice(0, 6).join('') || 'きょう';
  return JSON.stringify({
    title: `${topic}のうた`,
    emoji: '🎵',
    genre: 'pop',
    mood: 'わくわく',
    bpm: 112,
    key: 'C',
    scale: 'major',
    progression: ['I', 'V', 'vi', 'IV'],
    verse: [
      { text: 'あさのひかり まどをあけて', kana: 'あさの ひかり まどを あけて' },
      { text: 'きょうもいちにち はじまるよ', kana: 'きょうも いちにち はじまるよ' },
      { text: 'ちいさなことが うれしくて', kana: 'ちいさな ことが うれしくて' },
      { text: 'こころがすこし かるくなる', kana: 'こころが すこし かるくなる' },
    ],
    chorus: [
      { text: 'ラララ うたにしよう', kana: 'ららら うたに しよう' },
      { text: 'きみのきょうを ぜんぶ', kana: 'きみの きょうを ぜんぶ' },
      { text: 'ラララ そらにとどけ', kana: 'ららら そらに とどけ' },
      { text: 'あしたもきっと いいひ', kana: 'あしたも きっと いいひ' },
    ],
    instrumentalPrompt: 'bright japanese pop instrumental, acoustic guitar, piano, light drums, 112 bpm, C major, no vocals',
    comment: 'できたよ！聴いてみて。',
  });
}
