/**
 * Mercury 歌入れ (client decision 2026-10-07): Fish Audio has no separate singing endpoint — the
 * normal TTS (/v1/tts, model s2.1-pro) sings when the text starts with [singing]. Gemini Flash-Lite
 * reads the song design and picks the singing direction: style / emotion tags per section
 * ([pitch_up] for the chorus, [whisper], [sad], …), [breath] marks, speed and volume.
 * This file builds that prompt, validates the answer and writes the text Fish receives.
 */
import type { SingDirection } from '@obolo/shared';
import { extractJson } from './song';

type SectionName = SingDirection['sections'][number]['name'];

export interface SingSong {
  title: string;
  genre: string;
  mood: string;
  bpm: number;
  /** the instrumental's key (0 = C) and scale — sent to Fish so the vocal matches */
  keyRoot?: number;
  scale?: 'major' | 'minor';
  sections: { name: SectionName; lines: { text: string }[] }[];
}

/** The marker SING_DIRECTION lets the offline mock / tests recognise the call. */
export function singDirectionSystem(song: SingSong): string {
  const lyrics = song.sections.map((s) => `[${s.name}]\n${s.lines.map((l) => l.text).join('\n')}`).join('\n');
  return `SING_DIRECTION
あなたはボーカルディレクター。下の日本語の歌を AI 歌手（Fish Audio S2.1）が歌うときの指示を決める。
曲名: ${song.title} / ジャンル: ${song.genre} / 気分: ${song.mood || 'おまかせ'} / BPM: ${song.bpm}${song.keyRoot !== undefined && song.scale ? ` / キー: ${KEY_NAMES[song.keyRoot % 12]} ${song.scale}（伴奏と同じ。キーはこちらで指定するので、pitch_up / pitch_down は曲の中での上げ下げだけに使う）` : ''}
歌詞:
${lyrics}
ルール:
- style は曲全体の歌い方のタグ（英語の小文字1〜2語、例 bright / warm / powerful / gentle / cool）を1〜2個。
- sections は各パートの頭に付けるタグを0〜3個。キーは pitch_up（高く）/ pitch_down（低く）、感情は energetic / sad / whisper / soft / joyful / passionate など。サビは盛り上げることが多い。
- speed は歌う速さの倍率（0.8〜1.25）。BPM が速い曲は少し速く、バラードは遅く。
- volume は音量の調整（dB、-6〜6）。ささやく曲は小さく、ロックは大きく。
- breathEvery は何行ごとに息継ぎ [breath] を入れるか（0〜4、0 は入れない）。
出力は JSON だけ:
{"style":["bright"],"sections":[{"name":"verse","tags":["soft"]},{"name":"chorus","tags":["pitch_up","energetic"]}],"speed":1.0,"volume":0,"breathEvery":2}`;
}

const clamp = (v: unknown, lo: number, hi: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
};

/** A tag Fish can read: lowercase words / underscores, short. Anything else is dropped. */
function tags(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const t of v) {
    const s = typeof t === 'string' ? t.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\s+/g, '_') : '';
    if (/^[a-z][a-z_]{1,23}$/.test(s) && s !== 'singing' && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** Used when the LLM is unavailable or its answer is unusable. */
export function defaultSingDirection(song: Pick<SingSong, 'genre' | 'bpm' | 'sections'>): SingDirection {
  const g = song.genre;
  const style = g === 'ballad' ? ['warm'] : g === 'rock' ? ['powerful'] : g === 'hiphop' ? ['cool'] : ['bright'];
  const names = [...new Set(song.sections.map((s) => s.name))];
  return {
    style,
    sections: names.map((name) => ({ name, tags: name === 'chorus' ? ['pitch_up', g === 'ballad' ? 'passionate' : 'energetic'] : g === 'ballad' ? ['soft'] : [] })),
    speed: Math.round(clamp(song.bpm / 110, 0.85, 1.15, 1) * 100) / 100,
    volume: g === 'rock' || g === 'edm' ? 2 : g === 'ballad' ? -2 : 0,
    breathEvery: 2,
  };
}

export function parseSingDirection(raw: string, song: Pick<SingSong, 'genre' | 'bpm' | 'sections'>): SingDirection {
  const def = defaultSingDirection(song);
  let j: { style?: unknown; sections?: unknown; speed?: unknown; volume?: unknown; breathEvery?: unknown };
  try {
    j = extractJson(raw) as typeof j;
  } catch {
    return def;
  }
  const given = new Map<string, string[]>();
  if (Array.isArray(j.sections)) for (const s of j.sections as { name?: unknown; tags?: unknown }[]) if (typeof s?.name === 'string') given.set(s.name, tags(s.tags, 3));
  const style = tags(j.style, 2);
  return {
    style: style.length ? style : def.style,
    sections: def.sections.map((s) => ({ name: s.name, tags: given.get(s.name) ?? s.tags })),
    speed: Math.round(clamp(j.speed, 0.8, 1.25, def.speed) * 100) / 100,
    volume: Math.round(clamp(j.volume, -6, 6, def.volume) * 10) / 10,
    breathEvery: Math.round(clamp(j.breathEvery, 0, 4, def.breathEvery)),
  };
}

const tagText = (ts: string[]) => ts.map((t) => `[${t}]`).join('');
const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * The instrumental's key and tempo as natural-language tags (Fish S2.1 reads free-form tags), so
 * the vocal is asked to sit in the same key: "[key: C major][tempo: 120 BPM]".
 */
export function keyTags(o: { keyRoot: number; scale: 'major' | 'minor'; bpm: number }): string {
  return `[key: ${KEY_NAMES[((o.keyRoot % 12) + 12) % 12]} ${o.scale}][tempo: ${Math.round(o.bpm)} BPM]`;
}

/**
 * The text Fish sings: "[singing]", the instrumental's key / tempo, the style tags, then each
 * section with its tags, one lyric line per line, [breath] after every n lines.
 */
export function singText(song: Pick<SingSong, 'sections'> & Partial<Pick<SingSong, 'keyRoot' | 'scale' | 'bpm'>>, d: SingDirection): string {
  const key = song.keyRoot !== undefined && song.scale && song.bpm ? keyTags({ keyRoot: song.keyRoot, scale: song.scale, bpm: song.bpm }) : '';
  const out = [`[singing]${key}${tagText(d.style)}`];
  let n = 0;
  for (const s of song.sections) {
    const t = tagText(d.sections.find((x) => x.name === s.name)?.tags ?? []);
    s.lines.forEach((l, i) => {
      n++;
      const breath = d.breathEvery > 0 && n % d.breathEvery === 0 ? ' [breath]' : '';
      out.push(`${i === 0 && t ? `${t} ` : ''}${l.text.replace(/[[\]]/g, '')}${breath}`);
    });
  }
  return out.join('\n');
}

/**
 * The text for one lyric line sung on its own (each line is its own Fish call so it can be
 * re-sung / moved later): "[singing][key…][style][section tags] words".
 */
export function phraseText(
  song: { keyRoot: number; scale: 'major' | 'minor'; bpm: number },
  d: SingDirection,
  section: SectionName,
  text: string,
): string {
  const t = tagText(d.sections.find((x) => x.name === section)?.tags ?? []);
  return `[singing]${keyTags(song)}${tagText(d.style)}${t} ${text.replace(/[[\]]/g, '')}`;
}
