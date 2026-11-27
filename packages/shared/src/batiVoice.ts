import { z } from 'zod';
import type { BatiEggKind, BatiPersonality } from './batiPersona';
import { BATI_VOICE_DEFAULT_EGG, BATI_VOICE_SPEED } from './batiFixedVoice';
import { BirthYear } from './birthYear';

/**
 * The member's own voice (M-R246 / M-R247, D03-S005 「声を聞かせる」): on day 2, after {bati} is born and named, {name}
 * talks to it (held mic, about 10 s). The recording becomes a private Fish Audio voice model of the member's own voice.
 *
 * M-R342 (client 2026-11-27): {bati} no longer speaks in an imitation of that voice — every {bati} speaks in the fixed
 * voice of its egg (batiFixedVoice.ts). The member's voice model (users.voice_bati_id: the column keeps its old name; it
 * IS the member's voice model now) reads the member's own 「きれい」 ダチ voice messages (dachi/cute-voice.service.ts).
 * New models are made from the recording as it is (no pitch change); the ones made before M-R342 were made from the
 * recording pitched up two semitones and stay as they are.
 * Consent is the start-of-app agreement (MEDIA_CONSENT_VERSION) and, by age (M-R248, mediaAllowed): never under 13,
 * with the guardian's consent at 13〜15; otherwise nothing is recorded. 〔声を消す〕 in the settings deletes the recording
 * and the model.
 */

/**
 * +2 semitones: what the member's recording was pitched up by before M-R342 (the models made then keep it), and what the
 * default cute voice's source recording is still pitched up by (apps/api/scripts/make-default-bati-voice.ts).
 */
export const BATI_VOICE_BASE_SEMITONES = 2;
/** the light ring around the mic is full at this many seconds spoken (the script: 10秒くらいで満ちる) */
export const BATI_VOICE_TARGET_SECONDS = 10;
/** the server takes a recording from this long (a little slack under the ring's 10 s) */
export const BATI_VOICE_MIN_SECONDS = 8;
/** the takes (held presses, appended after 「、、、もう少し、聞かせてやれ。」) and their total length */
export const BATI_VOICE_MAX_TAKES = 8;
export const BATI_VOICE_MAX_SECONDS = 40;

/** the member's voice model: none; making = being made (queued job); ready; failed */
export type BatiVoiceState = 'none' | 'making' | 'ready' | 'failed';

/**
 * the ⓘ next to the mic (M-R247: shown only to those who tap it). M-R342: what the voice is used for now, after the
 * client's decision (「ユーザーの声は、ダチへの声メッセージに使う」); the start-of-app agreement says the same
 * (legal.ts, MEDIA_CONSENT_VERSION '2026-11-27.1').
 */
export const BATI_VOICE_EXPLAIN = 'あなたの声は、ダチへの声メッセージを、あなたの声できれいに読むために使います。ほかには使いません。あとで設定から消せます';

/** the speed {bati} speaks at: the base (BATI_VOICE_SPEED, or the server's setting) × `own` (a reading style's), within Fish's 0.5–2 */
export const batiSpeakSpeed = (own = 1, base = BATI_VOICE_SPEED) => Math.round(Math.min(2, Math.max(0.5, own * base)) * 100) / 100;

/**
 * M-R250: the Gemini voices {bati} falls back to where the Fish voice service is not connected (batiFixedVoice.ts is
 * {bati}'s voice everywhere else) — by egg (moon = girl-leaning, sun = boy-leaning) and a group of personalities:
 * the story TTS voice + `pitch` in semitones (as the story's old {bati} spec: Leda +3).
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
export const BATI_DEFAULT_VOICES: Record<BatiEggKind, Record<BatiVoiceGroup, { gemini: string; pitch: number }>> = {
  moon: { bright: { gemini: 'Leda', pitch: 3 }, calm: { gemini: 'Aoede', pitch: 2 }, rare: { gemini: 'Kore', pitch: 1 } },
  sun: { bright: { gemini: 'Puck', pitch: 3 }, calm: { gemini: 'Charon', pitch: 2 }, rare: { gemini: 'Orus', pitch: 0 } },
};
/** the fallback voice for this {bati} (no egg / personality known: the moon's bright one) */
export function batiDefaultVoice(egg?: BatiEggKind | null, personality?: BatiPersonality | null) {
  return BATI_DEFAULT_VOICES[egg ?? BATI_VOICE_DEFAULT_EGG][personality ? (BATI_VOICE_GROUP[personality] ?? 'bright') : 'bright'];
}

const take = z.object({
  mime: z
    .string()
    .regex(/^audio\//)
    .max(60),
  data: z.string().min(100).max(3_000_000),
});
/** POST /voice/bati (the member's own voice): the held takes, in order (appended), their total length and the words heard (optional) */
export const BatiVoiceBody = z.object({
  takes: z.array(take).min(1).max(BATI_VOICE_MAX_TAKES),
  seconds: z.number().min(0).max(BATI_VOICE_MAX_SECONDS + 5),
  text: z.string().trim().max(300).optional(),
});
export type BatiVoiceBody = z.infer<typeof BatiVoiceBody>;

/**
 * The start-of-app agreement (M-R247): the terms of use and the privacy policy, with what photos and voice are used for.
 * Raise the version when the words change; the server keeps the version agreed to.
 * M-R252: the words are the draft's (legal.ts: CONSENT_TEXT, TERMS_DRAFT, PRIVACY_DRAFT); '2026-11-22.2' = that draft.
 * '2026-11-27.1' (M-R342, client approved): the use of the voice changed — no longer to make {bati}'s voice; for the
 * ダチ voice messages (a voice model of the member that reads their words) and to turn what is said into words.
 * A new version asks EVERY account to agree again the next time the app opens (ConsentGate: agreedNow), 13〜15 with
 * the guardian again; until then the server treats the account as not recorded (canUseMedia false: no photo or
 * voice is used, nothing new is recorded).
 * PLACEHOLDER (P-LEGAL-1): the texts are drafts; the wording and the flow are checked by a specialist (a lawyer) before
 * launch (M-R248).
 */
export const MEDIA_CONSENT_VERSION = '2026-11-27.1';
/** the M-R247 summary lines (the agreement before M-R252; the screen now shows CONSENT_TEXT) */
export const CONSENT_POINTS = [
  '利用規約とプライバシーポリシーに同意します。',
  '写真は、あなたの姿を作るためだけに使います。声は、話した言葉を文字にするためと、ダチへの声メッセージ（あなたの声のモデルが、あなたの言葉を読みます）のためだけに使い、相方（バティ）の声を作るためには使いません。ほかのことには使いません。',
  '写真そのものは保存しません。声と、写真から作った姿は、設定からいつでも消せます。',
] as const;
/** M-R248: 13〜15歳 — the guardian's consent, confirmed once at the start (the one line to tick) */
/** the M-R248 guardian line (before M-R252; the screen now asks with CONSENT_TEXT.guardianAgreed) */
export const GUARDIAN_POINT = '13〜15歳の人：写真と声を使うことに、家の人が同意しています。';
/**
 * POST /me/consent. M-R252: with the branch chosen on the start screen — `media: false` when the photo and voice are not
 * to be used (under 13 / no year, or 13〜15 without the guardian), kept so a year given later cannot turn them on; and
 * the birth year asked there (kept once, as users.onboarding_json.birthYear, like PATCH /me), null = not answered.
 */
export const ConsentBody = z.object({
  version: z.string().min(1).max(40),
  guardian: z.boolean().optional(),
  media: z.boolean().optional(),
  // client 2026-11-27: an account with no year cannot agree without one (BIRTH_YEAR_REQUIRED, UsersService.consent)
  birthYear: BirthYear.nullable().optional(),
});
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
export function mediaAllowed(o: { birthYear: number | null | undefined; consent: boolean; guardian: boolean; media?: boolean }, now = new Date()): boolean {
  // M-R252: the start screen's branch said no photo and no voice
  if (o.media === false) return false;
  const a = mediaAge(o.birthYear, now);
  return a === 'adult' ? o.consent : a === 'teen' ? o.consent && o.guardian : false;
}
