import { CUTE_VOICE_CPU_SECONDS, CUTE_VOICE_MOOD_USD, CUTE_VOICE_STORED_BYTES_PER_BYTE, DEFAULT_COST_RATES, DEFAULT_PRICE_RULE, DEFAULT_STORAGE_GB_MONTH_USD, DEFAULT_STORAGE_PRICE_MONTHS, FISH_USD_PER_MBYTE, manaExact, storedUsd, type CostRates, type PriceRule } from './manaPrice';
import { speakText } from './storyVoice';

/**
 * Client 2026-11-27: the ダチ voice message of a member who is NOT recorded (under 13; 13〜15 without the guardian's
 * consent; the start screen's branch without photo and voice — Me.mediaOk false). Their own voice is never kept and
 * never sent anywhere beyond the dictating mic (POST /voice/dictate, not stored). Instead the words they said or typed
 * are read by the DEFAULT cute voice — the shared {bati} voice model (the API's FISH_DEFAULT_VOICE_ID, the one constant)
 * — and sent as a voice message like any other: the words as its caption, the audio, the quiet sound picked from the
 * words (the receiver's 〔おとをけす〕 as built).
 *
 * It costs mana by the one rule, on the real cost of THESE words (MakeKind 'cuteVoice'; shown before the send as 「−0.3」):
 *   yen  = the mood's small model + our CPU for the mix  (once a message)
 *        + UTF-8 bytes of what is spoken × (Fish per byte + the two MP3s kept 12 months per byte)
 *   mana = max(0.1, ceil( yen ÷ (1 − fee) × 1.08 × 10 ) / 10)
 * With no mana / not enough the message goes as words only — no voice, no error, one calm line (CUTE_VOICE_WORDS).
 * A member who IS recorded never gets here: their recorded voice message is unchanged.
 */

/** the UTF-8 bytes Fish is paid for: the words as they are spoken (speakText: the readings, no line breaks) */
export function cuteVoiceBytes(text: string): number {
  return new TextEncoder().encode(speakText(text.trim())).length;
}

/** the two parts of one message's cost in yen at these rates: once a message, and per spoken byte */
export function cuteVoiceCostParts(rates: CostRates = DEFAULT_COST_RATES): { baseJpy: number; perByteJpy: number } {
  const stored = storedUsd(CUTE_VOICE_STORED_BYTES_PER_BYTE, rates.storageMonths ?? DEFAULT_STORAGE_PRICE_MONTHS, rates.storageGbMonthUsd ?? DEFAULT_STORAGE_GB_MONTH_USD);
  return {
    baseJpy: CUTE_VOICE_MOOD_USD * rates.usdJpy + CUTE_VOICE_CPU_SECONDS * rates.cpuSecondJpy,
    perByteJpy: (FISH_USD_PER_MBYTE / 1e6 + stored) * rates.usdJpy,
  };
}
/** what reading these words costs us (yen) */
export function cuteVoiceCostJpy(text: string, rates: CostRates = DEFAULT_COST_RATES): number {
  const p = cuteVoiceCostParts(rates);
  return p.baseJpy + cuteVoiceBytes(text) * p.perByteJpy;
}

/** the live price as two numbers the browser can use (GET /dachi/voice/cute): mana before rounding, once and per byte */
export interface CuteVoiceRate {
  baseMana: number;
  manaPerByte: number;
}
export function cuteVoiceRate(rates: CostRates = DEFAULT_COST_RATES, rule: PriceRule = DEFAULT_PRICE_RULE): CuteVoiceRate {
  const p = cuteVoiceCostParts(rates);
  return { baseMana: manaExact(p.baseJpy, rule), manaPerByte: manaExact(p.perByteJpy, rule) };
}
/** the fallback (160 JPY/USD, Stripe 3.6%, 8%) until the live one arrives */
export const CUTE_VOICE_RATE: Readonly<CuteVoiceRate> = Object.freeze(cuteVoiceRate());

/** THE price of these words in the cute voice: to the tenth, rounded up, a tenth at least (0 for no words) */
export function cuteVoiceMana(text: string, rate: CuteVoiceRate = CUTE_VOICE_RATE): number {
  const bytes = cuteVoiceBytes(text);
  if (!bytes) return 0;
  // manaExact is linear in the yen, so base + bytes × perByte is exactly manaExact(cuteVoiceCostJpy(text))
  const exact = rate.baseMana + bytes * rate.manaPerByte;
  return Math.max(0.1, Math.ceil(exact * 10 - 1e-8) / 10);
}

/** why a message asked for in the cute voice went as words only */
export type CuteVoiceMiss = 'noMana' | 'failed';
/** GET /dachi/voice/cute — whether this member's ダチ words are read by the cute voice, and the price's two numbers */
export interface CuteVoiceInfo {
  /** the member is not recorded AND the voice service has the default voice: the talk shows the switch and the price */
  on: boolean;
  rate: CuteVoiceRate;
}

/** PROVISIONAL wording (the story chat confirms) */
export const CUTE_VOICE_WORDS = {
  /** the small switch above the mic: on = the words are read by the cute voice */
  toggle: 'こえをつける',
  toggleOn: 'こえをつけて送るよ',
  toggleOff: 'いまは、文字だけ送るよ',
  /** the price beside 〔送る〕, the app's small 「−0.3」 */
  price: (mana: string) => `−${mana}`,
  priceLabel: (mana: string) => `マナ ${mana} をつかうよ`,
  /** sent as words only: one calm line, never an error */
  noMana: 'マナがたりないから、文字だけ送ったよ',
  failed: 'いまは声にできなかったから、文字だけ送ったよ',
} as const;
export const cuteVoiceMissWords = (why: CuteVoiceMiss): string => CUTE_VOICE_WORDS[why];
