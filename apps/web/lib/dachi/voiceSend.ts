import { cuteVoiceMana, CUTE_VOICE_WORDS, formatMana, type CuteVoiceRate, type DachiMessageView, type SendDachiMessageBody, type VoiceSound, type VoiceVersion } from '@obolo/shared';

/**
 * Client 2026-11-27 (after trying the ダチ voice messages; shared voiceVersion.ts): what the draft card sends, and what a
 * voice message looks like in the talk. No DOM here (tests: voiceSend.test.ts).
 *
 *  - 「そのまま」: the made-ready recording (its draft's media id), with its caption and its sound.
 *  - 「きれい」: the caption itself — the server reads it as the voice (the member's own voice model, else the cute
 *    voice). The recording is not sent; a 「そのまま」 draft made from the same take is named so that it is thrown away.
 *  - Both sides play a voice message in the talk, the sender too (the client took "the sender does not hear their own
 *    voice" back the same day, before it was released).
 */
export type VoiceToSend =
  | { mediaId: string; seconds: number; caption?: string; sound?: VoiceSound; soft?: boolean }
  | { clean: true; text: string; sound: VoiceSound; soft: boolean; drop?: string };

/** the draft as the card holds it: the version chosen now, and the 「そのまま」 file when one was made from this take */
export interface DraftNow {
  version: VoiceVersion;
  mediaId: string | null;
  seconds: number;
  /** made ready by the server (false: the take as it is — no caption, no sound, no choice of version) */
  ready: boolean;
}

/** what 〔送る〕 sends now; null: nothing can be sent (「きれい」 with no words to read, 「そのまま」 with no file yet) */
export function voiceToSend(d: DraftNow, caption: string, sound: VoiceSound, soft: boolean): VoiceToSend | null {
  const words = caption.trim();
  const softNow = sound === 'ureshii' && soft;
  if (d.ready && d.version === 'clean') return words ? { clean: true, text: words, sound, soft: softNow, ...(d.mediaId ? { drop: d.mediaId } : {}) } : null;
  if (!d.mediaId) return null;
  return { mediaId: d.mediaId, seconds: d.seconds, ...(d.ready ? { caption: words || undefined, sound, soft: softNow } : {}) };
}

/** the body of POST /dachi/threads/:id/messages */
export function voiceSendBody(v: VoiceToSend): SendDachiMessageBody {
  if ('clean' in v) return { text: v.text, spoken: true, sound: v.sound, soft: v.soft, ...(v.drop ? { drop: v.drop } : {}) };
  return { ...v, seconds: Math.max(0.1, Math.round(v.seconds * 10) / 10) };
}

/**
 * 〔▶ きいてみる〕 on the draft card: only the 「そのまま」 draft can be heard before the send (its file is there). 「きれい」
 * is the paid voice, made at the send — nothing is made just to listen; the card says so in one line instead.
 */
export const canPreview = (d: DraftNow): d is DraftNow & { mediaId: string } => !!d.mediaId && !(d.ready && d.version === 'clean');

/** the small price beside 〔送る〕 for 「きれい」 (the app's 「−0.3」); null: nothing to read yet */
export function cleanCost(caption: string, rate: CuteVoiceRate): { text: string; label: string } | null {
  if (!caption.trim()) return null;
  const mana = formatMana(cuteVoiceMana(caption, rate));
  return { text: CUTE_VOICE_WORDS.price(mana), label: CUTE_VOICE_WORDS.priceLabel(mana) };
}

/** a voice message in the talk: the same play control for the one who sent it and the one who got it */
export function voicePartOf(m: Pick<DachiMessageView, 'kind' | 'audioUrl' | 'seconds' | 'sound'>): { voice?: { url: string | null; seconds: number | null; plainUrl?: string | null } } {
  if (m.kind !== 'voice') return {};
  return { voice: { url: m.audioUrl, seconds: m.seconds, plainUrl: m.sound?.plainUrl } };
}
