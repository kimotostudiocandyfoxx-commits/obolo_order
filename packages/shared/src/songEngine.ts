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
/** when nothing says how long: a song of about a minute and a half */
export const SONG_SECONDS_DEFAULT = 105;

/** where a song is made: Runware (default), or our own GPU (the old path, kept as the fallback) */
export type MusicProvider = 'runware' | 'gpu';

/** a length the spell says (a 'length' talisman: 「30秒」「1分」「2分」「フル」…), in seconds; null when it says none */
export function spellSeconds(tags: SpellTag[] | undefined | null): number | null {
  const t = tags?.find((x) => x.group === 'length');
  if (!t) return null;
  const s = `${t.ja} ${t.en}`;
  const n = (x: string) => Number(x.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
  // the talisman's own word first (「1分30秒」), then its English
  for (const part of [t.ja, t.en]) {
    const min = part.match(/([0-9０-９]+(?:\.[0-9]+)?)\s*(?:分|min)/i);
    const sec = part.match(/([0-9０-９]+)\s*(?:秒|s(?:ec)?\b|seconds?)/i);
    if (min) return n(min[1]) * 60 + (sec ? n(sec[1]) : 0);
    if (sec) return n(sec[1]);
  }
  if (/two minutes|2 minutes/i.test(s)) return 120;
  if (/サビだけ|ショート|short/i.test(s)) return 45;
  if (/フル|まるごと|ぜんぶ|full|whole|long/i.test(s)) return 180;
  return null;
}

/**
 * how long the song is asked to be: the spell's length talisman, else what the design asked for when the lyrics fit in
 * it, else about four seconds a sung line (+ the instrumental parts); always 30–300 s, ~90–120 s when nothing says
 */
export function songSeconds(o: { tags?: SpellTag[] | null; lyrics?: Pick<SongLyrics, 'blocks'> | null; seconds?: number | null; bpm?: number }): number {
  const clamp = (x: number) => Math.round(Math.max(SONG_SECONDS_MIN, Math.min(SONG_SECONDS_MAX, x)));
  const said = spellSeconds(o.tags);
  if (said) return clamp(said);
  const lines = o.lyrics ? o.lyrics.blocks.reduce((a, b) => a + b.lines.length, 0) : 0;
  const breaks = o.lyrics ? o.lyrics.blocks.filter((b) => !b.lines.length).length : 0;
  // two bars a line at the song's tempo (ACE-Step sings ~6–10 syllables a line), a little less when it is fast
  const bar = (4 * 60) / Math.max(60, Math.min(200, o.bpm ?? 110));
  const need = lines ? lines * 2 * bar + breaks * 2 * bar + 8 : 0;
  const asked = o.seconds ?? 0;
  if (!need) return clamp(asked >= SONG_SECONDS_MIN ? Math.max(asked, 90) : SONG_SECONDS_DEFAULT);
  return clamp(Math.max(need, asked, 90));
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
  return /^(お願い|おねがい|頼む|たのむ|作って|つくって|唱えて|となえて|して|ね|よ)?(します|ね|よ|！)*$/.test(rest) ? '' : rest;
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
