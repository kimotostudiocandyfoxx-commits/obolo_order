import { z } from 'zod';
import { LYRIC_HINT_DEFS, lyricsCaption, lyricsSheet, type LyricSection, type SongLyrics } from './lyrics';
import type { SpellTag } from './spell';
import type { TweakPlan } from './songTweak';

/**
 * R17 (client 2026-11-25, docs/DECISIONS.md 「曲：ふだんは Runware の ACE-Step 1.5 XL SFT、上級魔法は MiniMax Music 2.6」):
 * a normal song is sung by ACE-Step 1.5 XL SFT on Runware (fast, cheap: a 75 s song in ~13 s for ~$0.01); the secret
 * 上級魔法 by MiniMax Music 2.6 on Runware. Our own GPU (gpu/music) stays for what only it does — the vocal / instrumental
 * split (HTDemucs), the lyric line times, and singing in the member's own voice (Seed-VC) — and is woken lazily: only
 * when a change needs the stems or the times (SONG_SPLIT_NEEDS), never for every song.
 * Here: the Runware request bodies (built the same way for the API and the tests).
 */

export const RUNWARE_URL = 'https://api.runware.ai/v1';
/** the normal song engine (Runware AIR id) */
export const SONG_MODEL_NORMAL = 'runware:ace-step@v1.5-xl-sft';
/** the 上級魔法 song engine (Runware AIR id) */
export const SONG_MODEL_PREMIUM = 'minimax:music@2.6';
/** Runware's settings.lyrics limit */
export const RUNWARE_LYRICS_MAX = 3000;
/** ACE-Step on Runware: 30–300 s */
export const SONG_SECONDS_MIN = 30;
export const SONG_SECONDS_MAX = 300;
/**
 * R17 (client 2026-11-25: 「曲はふつう60秒。歌詞が60秒に入らない時か、長くしてと言われた時だけ長く」): a song is a minute
 * unless its lyrics do not fit in one (estimated from the sheet: songLyricsSeconds) or the member asked for a length
 */
export const SONG_SECONDS_DEFAULT = 60;

/** where a song is made: Runware (default), or our own GPU (the old path, kept as the fallback) */
export type MusicProvider = 'runware' | 'gpu';

/** a length the spell says (a 'length' talisman: 「30秒」「1分」「2分」「長め」「フルで」…), in seconds; null when it says none */
export function spellSeconds(tags: SpellTag[] | undefined | null): number | null {
  const t = tags?.find((x) => x.group === 'length');
  if (!t) return null;
  const s = `${t.ja} ${t.en}`;
  const n = (x: string) => Number(x.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
  // the talisman's own word first (「1分30秒」「1分半」), then its English
  for (const part of [t.ja, t.en]) {
    const min = part.match(/([0-9０-９]+(?:\.[0-9]+)?)\s*(?:分|min)/i);
    const sec = part.match(/([0-9０-９]+)\s*(?:秒|s(?:ec)?\b|seconds?)/i);
    if (min) return n(min[1]) * 60 + (sec ? n(sec[1]) : /分半/.test(part) ? 30 : 0);
    if (sec) return n(sec[1]);
  }
  if (/two minutes|2 minutes/i.test(s)) return 120;
  if (/サビだけ|ショート|short/i.test(s)) return 45;
  if (/フル|まるごと|ぜんぶ|full|whole|long/i.test(s)) return 180;
  return null;
}

/** whether the spell's length is a rough one (「長め」「フルで」: at least that long) rather than an exact one (「2分」) */
const roughLength = (tags: SpellTag[] | undefined | null) => {
  const t = tags?.find((x) => x.group === 'length');
  return !!t && !/[0-9０-９]/.test(t.ja);
};

/** the sung syllables of a line, about (a kanji is read as one and a half; small kana join the one before) */
const syllables = (line: string) => {
  let n = 0;
  for (const c of line.replace(/[\s　、。,.!?！？「」『』…・〜~-]/g, '')) n += /[一-鿿々]/.test(c) ? 1.5 : /[ゃゅょャュョぁぃぅぇぉァィゥェォ]/.test(c) ? 0 : 1;
  return n;
};

/**
 * how long the lyric sheet takes to sing at this tempo, in seconds: each sung line at about two syllables a beat (plus a
 * breath), in whole bars and never under two; an instrumental block (solo, build, drop …) four bars, the intro / outro two
 */
export function songLyricsSeconds(lyrics: Pick<SongLyrics, 'blocks'>, bpm = 110): number {
  const bar = (4 * 60) / Math.max(60, Math.min(200, bpm));
  let bars = 0;
  for (const b of lyrics.blocks) {
    if (b.lines.length) for (const l of b.lines) bars += Math.max(2, Math.ceil((syllables(l) / 2 + 1) / 4));
    else bars += b.section === 'intro' || b.section === 'outro' ? 2 : 4;
  }
  return bars ? Math.round(bars * bar + 2) : 0;
}

/**
 * how long the song is asked to be (always 30–300 s):
 *  - the spell's length talisman (「2分」 exactly; 「長め」「フルで」 at least that, longer when the lyrics need it)
 *  - else a minute (SONG_SECONDS_DEFAULT), longer only when the lyrics do not fit in one (songLyricsSeconds)
 * `atLeast`: never shorter than this (a song sung again with its lines changed, or made longer, keeps that length)
 */
export function songSeconds(o: { tags?: SpellTag[] | null; lyrics?: Pick<SongLyrics, 'blocks'> | null; atLeast?: number | null; bpm?: number }): number {
  const clamp = (x: number) => Math.round(Math.max(SONG_SECONDS_MIN, Math.min(SONG_SECONDS_MAX, x)));
  const need = o.lyrics ? songLyricsSeconds(o.lyrics, o.bpm) : 0;
  const said = spellSeconds(o.tags);
  if (said) return clamp(roughLength(o.tags) ? Math.max(said, need) : said);
  return clamp(Math.max(SONG_SECONDS_DEFAULT, need, o.atLeast ?? 0));
}

/**
 * R17 (client 2026-11-25: the app's signature sound): every song is delivered 1.2× faster, the pitch kept (young
 * listeners like them faster; an AI ballad drags). The engine sings `songSeconds × tempo` so the song delivered is the
 * length asked; the 1.0× take is kept as the original every free change is made from (the factor folded into its chain).
 * The API's SONG_DEFAULT_TEMPO sets it (1 = off).
 */
export const SONG_DEFAULT_TEMPO = 1.2;

/** the seconds the engine is asked to sing for a song delivered `seconds` long at `tempo` (30–300 s) */
export function songGenSeconds(seconds: number, tempo = SONG_DEFAULT_TEMPO): number {
  return Math.round(Math.max(SONG_SECONDS_MIN, Math.min(SONG_SECONDS_MAX, seconds * Math.max(0.5, tempo))));
}

/** the lyric line times of the take sung at 1.0× on the song delivered at `tempo` (each time and length ÷ tempo) */
export function phrasesAtTempo<P extends { startBeat: number; beats: number; seconds: number }>(phrases: P[], tempo: number): P[] {
  if (Math.abs(tempo - 1) < 0.001) return phrases;
  const r = (x: number, d: number) => Math.round(x * d) / d;
  return phrases.map((p) => ({ ...p, startBeat: r(p.startBeat / tempo, 1000), beats: r(p.beats / tempo, 1000), seconds: r(p.seconds / tempo, 100) }));
}

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** ACE-Step's key field: "C major" / "A minor" */
export const keyScaleOf = (keyRoot: number, scale: 'major' | 'minor') => `${KEY_NAMES[((keyRoot % 12) + 12) % 12]} ${scale}`;

/** the lyrics as ACE-Step reads them (our metatag sheet: [Intro] [Verse 1] [Pre-Chorus - building energy] …), ≤ 3000 */
export function aceLyrics(l: Pick<SongLyrics, 'blocks'>): string {
  return fitLyrics(lyricsSheet(l));
}

/**
 * our structure tags → MiniMax Music's ([Intro] [Verse] [Pre Chorus] [Chorus] [Bridge] [Outro] [Inst]); the
 * performance hints are not tags there (MiniMax reads them from the prompt: premiumPrompt adds their words)
 */
export const MINIMAX_TAG: Record<LyricSection, string> = {
  intro: 'Intro',
  verse: 'Verse',
  'pre-chorus': 'Pre Chorus',
  chorus: 'Chorus',
  'final-chorus': 'Chorus',
  bridge: 'Bridge',
  instrumental: 'Inst',
  'guitar-solo': 'Inst',
  'piano-solo': 'Inst',
  build: 'Inst',
  drop: 'Inst',
  outro: 'Outro',
};

/** the lyrics as MiniMax Music reads them: one tag a block, the lines under it (an instrumental block has none) */
export function minimaxLyrics(l: Pick<SongLyrics, 'blocks'>): string {
  const out: string[] = [];
  for (const b of l.blocks) {
    const tag = `[${MINIMAX_TAG[b.section]}]`;
    // two instrumental moments in a row are one
    if (!b.lines.length && out[out.length - 1] === tag) continue;
    out.push([tag, ...b.lines].join('\n'));
  }
  return fitLyrics(out.join('\n\n'));
}

/** at most RUNWARE_LYRICS_MAX characters, cut at a block (never mid-line) */
function fitLyrics(s: string): string {
  if (s.length <= RUNWARE_LYRICS_MAX) return s;
  const blocks = s.split('\n\n');
  let out = '';
  for (const b of blocks) {
    const next = out ? `${out}\n\n${b}` : b;
    if (next.length > RUNWARE_LYRICS_MAX) break;
    out = next;
  }
  return out || s.slice(0, RUNWARE_LYRICS_MAX);
}

/** the caption for MiniMax: the style prompt and the lyric tags' words (its tags carry no hints) */
export function premiumPrompt(stylePrompt: string, l: Pick<SongLyrics, 'blocks'> | undefined): string {
  const hints = l ? lyricsCaption(l).filter((c) => Object.values(LYRIC_HINT_DEFS).some((h) => h.caption === c) || /solo|interlude|build|drop/.test(c)) : [];
  return [stylePrompt, ...hints.filter((h) => !stylePrompt.toLowerCase().includes(h.toLowerCase()))].filter(Boolean).join(', ').slice(0, 2000);
}

export type RunwareAudioTask = {
  taskType: 'audioInference';
  taskUUID: string;
  model: string;
  positivePrompt: string;
  outputFormat: 'MP3';
  outputType: 'URL';
  includeCost: true;
  deliveryMethod: 'async' | 'sync';
  duration?: number;
  numberResults?: number;
  settings: { lyrics: string; vocalLanguage?: string; bpm?: number; keyScale?: string; timeSignature?: string };
  /** audio to audio (ACE-Step repaint / extend): the song made before and the seconds to make again */
  inputs?: { audio: string };
  repaintingStart?: number;
  repaintingEnd?: number;
};

/** a normal song on Runware (ACE-Step 1.5 XL SFT): the spell's English, our metatag sheet, the length, the language */
export function normalSongTask(o: {
  taskUUID: string;
  prompt: string;
  lyrics: Pick<SongLyrics, 'blocks'> | string;
  seconds: number;
  language?: string;
  bpm?: number;
  keyRoot?: number;
  scale?: 'major' | 'minor';
  timeSignature?: string;
  deliveryMethod?: 'async' | 'sync';
}): RunwareAudioTask {
  const lyrics = typeof o.lyrics === 'string' ? fitLyrics(o.lyrics) : aceLyrics(o.lyrics);
  return {
    taskType: 'audioInference',
    taskUUID: o.taskUUID,
    model: SONG_MODEL_NORMAL,
    positivePrompt: o.prompt.slice(0, 2000),
    duration: Math.round(Math.max(SONG_SECONDS_MIN, Math.min(SONG_SECONDS_MAX, o.seconds))),
    outputFormat: 'MP3',
    outputType: 'URL',
    includeCost: true,
    deliveryMethod: o.deliveryMethod ?? 'async',
    settings: {
      lyrics,
      vocalLanguage: o.language ?? 'ja',
      ...(o.bpm ? { bpm: Math.round(Math.max(40, Math.min(220, o.bpm))) } : {}),
      ...(o.keyRoot !== undefined && o.scale ? { keyScale: keyScaleOf(o.keyRoot, o.scale) } : {}),
      ...(o.timeSignature ? { timeSignature: o.timeSignature } : {}),
    },
  };
}

/**
 * a part made again / the song made longer on Runware (ACE-Step audio to audio): the song as it is (`audio`: a URL or a
 * data URI), the seconds from `start` to `end` sung again with the whole lyrics; `seconds` longer than the song extends it
 */
export function repaintSongTask(o: { taskUUID: string; prompt: string; lyrics: Pick<SongLyrics, 'blocks'> | string; audio: string; start: number; end: number; seconds: number; language?: string; bpm?: number; keyRoot?: number; scale?: 'major' | 'minor' }): RunwareAudioTask {
  return {
    ...normalSongTask({ ...o, deliveryMethod: 'async' }),
    inputs: { audio: o.audio },
    repaintingStart: Math.max(0, Math.round(o.start * 10) / 10),
    repaintingEnd: Math.round(Math.max(o.start + 1, o.end) * 10) / 10,
  };
}

/** a 上級魔法 song on Runware (MiniMax Music 2.6): its own tags, no length (it decides, ~1m45s) */
export function premiumSongTask(o: { taskUUID: string; prompt: string; lyrics: Pick<SongLyrics, 'blocks'> }): RunwareAudioTask {
  return {
    taskType: 'audioInference',
    taskUUID: o.taskUUID,
    model: SONG_MODEL_PREMIUM,
    positivePrompt: premiumPrompt(o.prompt, o.lyrics),
    outputFormat: 'MP3',
    outputType: 'URL',
    includeCost: true,
    deliveryMethod: 'async',
    settings: { lyrics: minimaxLyrics(o.lyrics) },
  };
}

/**
 * whether a free change needs our GPU's split (the stems: the voice / the music on their own) or the line times (a part
 * cut or repeated): a song from Runware is one mix, so these wake the GPU once (then the stems are kept). Tempo, key,
 * length and fades work on the mix alone.
 */
export function tweakNeedsSplit(plan: Pick<TweakPlan, 'cuts' | 'repeats' | 'vocalDb' | 'bgmDb' | 'stem' | 'room'>): boolean {
  return plan.cuts.length > 0 || plan.repeats.length > 0 || plan.vocalDb !== 0 || plan.bgmDb !== 0 || plan.stem !== 'both' || plan.room > 0;
}

// --- 上級魔法 (the secret spell) -------------------------------------------------------------------------------------

/** POST /moon/incant: words a member said to {bati} in the atelier (checked on the server only) */
export const IncantBody = z.object({ said: z.string().trim().min(1).max(400) });
export type IncantBody = z.infer<typeof IncantBody>;
/** not the passphrase, not a member, or turned off: always just { premium: false } (no sign the spell exists) */
export type IncantView = { premium: false } | { premium: true; grant: string; price: number; /** the words after the passphrase ('' = none) */ request: string };

/**
 * The passphrase itself is only on the server (the API's PREMIUM_SPELL_WORDS and its default — never in the web's code,
 * never in the story: word of mouth only). A message that has it anywhere is the secret spell; the rest is the request.
 */

/** the words as compared: width, case, spaces and punctuation do not matter */
export function incantNorm(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s、。，．,.!?！？「」『』"'`〜~…・-]/g, '');
}

/**
 * the request said with the passphrase (what is left once it is taken out: 「<passphrase>、夏の曲を唱えて」→「夏の曲を唱えて」);
 * '' when only the passphrase (and a word like お願い / 作って) was said; null when it was not said
 */
export function premiumRequest(said: string, words: string[]): string | null {
  if (!saidPremiumWords(said, words)) return null;
  let rest = said.normalize('NFKC');
  for (const w of words) {
    const re = new RegExp([...w.normalize('NFKC').replace(/\s+/g, '')].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s、。,.!?！？「」『』…・]*'), 'i');
    rest = rest.replace(re, ' ');
  }
  rest = rest.replace(/^[\s、。,.!?！？「」『』…・]+|[\s、。,.!?！？「」『』…・]+$/g, '').trim();
  if (/^(お願い|おねがい|頼む|たのむ|作って|つくって|唱えて|となえて|して|ね|よ)?(します|ね|よ|！)*$/.test(rest)) return '';
  // 「…を唱えて」 is a making (the spell reads 作って; 唱えて is not a talisman)
  return rest.replace(/(唱|とな)えて/g, '作って');
}

/** the passphrases from the setting (comma-, | - or 、-separated); unset / empty: `defaults` */
export function premiumWords(setting: string | undefined | null, defaults: string[] = []): string[] {
  const list = (setting ?? '')
    // commas (as asked), or | and 、 (a deploy's env list splits on commas)
    .split(/[,|、，]/)
    .map((w) => w.trim())
    .filter(Boolean);
  return list.length ? list : defaults;
}

/** whether the member's words carry one of the passphrases (anywhere in what they said) */
export function saidPremiumWords(said: string, words: string[]): boolean {
  const s = incantNorm(said);
  return words.some((w) => {
    const n = incantNorm(w);
    return n.length >= 2 && s.includes(n);
  });
}
