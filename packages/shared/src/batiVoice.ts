import { z } from 'zod';
import type { BatiEggKind, BatiPersonality } from './batiPersona';

/**
 * {bati}'s voice from the member's own voice (M-R246 / M-R247, D03-S005 「たまごに声を聞かせる」): on day 2, before
 * {bati} hatches, {name} talks to the egg (held mic, about 10 s). The recording becomes a private Fish Audio voice model
 * made from it pitched up two semitones, and that is {bati}'s voice. The 2nd and 3rd {bati} speak in the same base voice
 * with a small pitch / speed change for their personality (BATI_VOICE_TUNING). The voice is used for {bati}'s voice only.
 * Consent is the start-of-app agreement (MEDIA_CONSENT_VERSION) and, by age (M-R248, mediaAllowed): never under 13,
 * with the guardian's consent at 13〜15; otherwise no model is made and {bati} keeps the default voice. 〔声を消す〕 in the settings deletes the recording and the model.
 */

/** the recording is pitched up this much before the model is made from it (「少し高くして使います」) */
export const BATI_VOICE_BASE_SEMITONES = 2;
/** the light ring around the mic is full at this many seconds spoken (the script: 10秒くらいで満ちる) */
export const BATI_VOICE_TARGET_SECONDS = 10;
/** the server takes a recording from this long (a little slack under the ring's 10 s) */
export const BATI_VOICE_MIN_SECONDS = 8;
/** the takes (held presses, appended after 「、、、もう少し、聞かせてやれ。」) and their total length */
export const BATI_VOICE_MAX_TAKES = 8;
export const BATI_VOICE_MAX_SECONDS = 40;

/** none = the default voice; making = the model is being made (queued job); ready; failed (the default voice for now) */
export type BatiVoiceState = 'none' | 'making' | 'ready' | 'failed';

/** the ⓘ next to the mic (M-R247: shown only to those who tap it; the words of M-R246's screen) */
export const BATI_VOICE_EXPLAIN = 'あなたの声は、相方の声のもとになります（少し高くして使います）。相方の声のためだけに使い、ほかには使いません。あとで設定から消せます';

/**
 * The 2nd / 3rd {bati}'s small changes on the same base voice, by personality: semitones on top of the base (+2) and a
 * speed multiplier for the TTS. The 1st {bati} always speaks in the base voice as it is.
 */
export const BATI_VOICE_TUNING: Record<BatiPersonality, { semitones: number; speed: number }> = {
  genki: { semitones: 1, speed: 1.05 },
  teinei: { semitones: 0, speed: 0.97 },
  kansai: { semitones: 0, speed: 1.06 },
  cool: { semitones: -1, speed: 0.96 },
  mellow: { semitones: -1, speed: 0.92 },
  amae: { semitones: 2, speed: 0.97 },
  gal: { semitones: 1, speed: 1.06 },
  galfuwa: { semitones: 2, speed: 0.98 },
  galane: { semitones: 0, speed: 1.0 },
  galcool: { semitones: -1, speed: 1.0 },
  galkansai: { semitones: 1, speed: 1.07 },
  hakata: { semitones: 0, speed: 1.03 },
  tohoku: { semitones: 0, speed: 0.94 },
  okinawa: { semitones: 1, speed: 0.95 },
  bushi: { semitones: -2, speed: 0.93 },
  butler: { semitones: -2, speed: 0.95 },
  king: { semitones: -2, speed: 0.92 },
};

/** the {bati}'s voice change on top of the model: the 1st (nth 1) none; the 2nd / 3rd by personality */
export function batiVoiceTuning(nth: number, personality?: BatiPersonality | null): { semitones: number; speed: number } {
  if (nth <= 1 || !personality) return { semitones: 0, speed: 1 };
  return BATI_VOICE_TUNING[personality] ?? { semitones: 0, speed: 1 };
}

/** the whole pitch shift {bati} speaks in, from the member's own voice */
export const batiVoicePitch = (nth: number, personality?: BatiPersonality | null) => BATI_VOICE_BASE_SEMITONES + batiVoiceTuning(nth, personality).semitones;

/**
 * M-R250: the prepared voices {bati} speaks in when no voice of the member's own may be used (under 13, 13〜15 without the
 * guardian's consent), or none was recorded / it was deleted — by egg (moon = girl-leaning, sun = boy-leaning) and a group
 * of personalities. `gemini`: the story TTS voice (+ `pitch` in semitones, as the story's {bati} spec: Leda +3); `fish`: a
 * Fish Audio voice model id, or null = the server's FISH_DEFAULT_VOICE_ID.
 * PROVISIONAL (P-VOICE-BATI-4): no Fish preset voices are chosen yet (all null); the Gemini voices are a first pick by ear.
 */
export type BatiVoiceGroup = 'bright' | 'calm' | 'rare';
export const BATI_VOICE_GROUP: Record<BatiPersonality, BatiVoiceGroup> = {
  genki: 'bright',
  kansai: 'bright',
  amae: 'bright',
  gal: 'bright',
  galfuwa: 'bright',
  galkansai: 'bright',
  teinei: 'calm',
  cool: 'calm',
  mellow: 'calm',
  galane: 'calm',
  galcool: 'calm',
  hakata: 'rare',
  tohoku: 'rare',
  okinawa: 'rare',
  bushi: 'rare',
  butler: 'rare',
  king: 'rare',
};
export const BATI_DEFAULT_VOICES: Record<BatiEggKind, Record<BatiVoiceGroup, { gemini: string; pitch: number; fish: string | null }>> = {
  moon: { bright: { gemini: 'Leda', pitch: 3, fish: null }, calm: { gemini: 'Aoede', pitch: 2, fish: null }, rare: { gemini: 'Kore', pitch: 1, fish: null } },
  sun: { bright: { gemini: 'Puck', pitch: 3, fish: null }, calm: { gemini: 'Charon', pitch: 2, fish: null }, rare: { gemini: 'Orus', pitch: 0, fish: null } },
};
/** the prepared voice for this {bati} (no egg / personality known: the story's {bati} voice, the moon's bright one) */
export function batiDefaultVoice(egg?: BatiEggKind | null, personality?: BatiPersonality | null) {
  return BATI_DEFAULT_VOICES[egg ?? 'moon'][personality ? (BATI_VOICE_GROUP[personality] ?? 'bright') : 'bright'];
}

const take = z.object({
  mime: z
    .string()
    .regex(/^audio\//)
    .max(60),
  data: z.string().min(100).max(3_000_000),
});
/** POST /voice/bati: the held takes, in order (appended), their total length and the words heard (optional) */
export const BatiVoiceBody = z.object({
  takes: z.array(take).min(1).max(BATI_VOICE_MAX_TAKES),
  seconds: z.number().min(0).max(BATI_VOICE_MAX_SECONDS + 5),
  text: z.string().trim().max(300).optional(),
});
export type BatiVoiceBody = z.infer<typeof BatiVoiceBody>;

/**
 * The start-of-app agreement (M-R247): the terms of use and the privacy policy, with what photos and voice are used for.
 * Raise the version when the words change; the server keeps the version agreed to.
 * PLACEHOLDER (P-LEGAL-1): the terms and the privacy policy themselves are not written yet; the wording and the flow are
 * checked by a specialist (a lawyer) before launch (M-R248).
 */
export const MEDIA_CONSENT_VERSION = '2026-11-22';
export const CONSENT_POINTS = [
  '利用規約とプライバシーポリシーに同意します。',
  '写真と声は、あなたの姿と相方（バティ）を作るためだけに使い、ほかのことには使いません。',
  '写真そのものは保存しません。声と、写真から作った姿は、設定からいつでも消せます。',
] as const;
/** M-R248: 13〜15歳 — the guardian's consent, confirmed once at the start (the one line to tick) */
export const GUARDIAN_POINT = '13〜15歳の人：写真と声を使うことに、家の人が同意しています。';
export const ConsentBody = z.object({ version: z.string().min(1).max(40), guardian: z.boolean().optional() });
export type ConsentBody = z.infer<typeof ConsentBody>;

/**
 * M-R248: whether this member's photo and voice may be used, by age (birth year) from day 1:
 *  - under 13, or no birth year yet → never (the default voice; the look made without a photo)
 *  - 13〜15 → only with the guardian's consent (confirmed once at the start), as well as the agreement
 *  - 16 and over → their own consent in the agreement
 */
export type MediaAge = 'under13' | 'teen' | 'adult';
export function mediaAge(birthYear: number | null | undefined, now = new Date()): MediaAge {
  if (!birthYear) return 'under13';
  const age = now.getFullYear() - birthYear;
  return age < 13 ? 'under13' : age < 16 ? 'teen' : 'adult';
}
export function mediaAllowed(o: { birthYear: number | null | undefined; consent: boolean; guardian: boolean }, now = new Date()): boolean {
  const a = mediaAge(o.birthYear, now);
  return a === 'adult' ? o.consent : a === 'teen' ? o.consent && o.guardian : false;
}
