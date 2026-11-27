import { z } from 'zod';
import type { CuteVoiceRate } from './cuteVoice';

/**
 * Client 2026-11-27 (after trying the ダチ voice messages): a member who is recorded chooses, with one button on the
 * draft card, which of two versions is sent — remembered per member on the server (users.onboarding_json
 * ['voice.dachi.version']; the default is kept as no entry; no migration):
 *
 *  'asis'  「そのまま」 (the default, the cheap one): the member's own recording made ready in their voice settings
 *          (voiceTune.ts). Its cost is the small cost 'voiceMix' (our CPU seconds, the words, the mood), added up per
 *          member and taken a whole mana at a time (docs/マナの値段.md 3.).
 *  'clean' 「きれい」: the caption — the words heard from the take, as the member fixed them — is read by Fish in the
 *          member's own voice model (from the day-2 recording; M-R342: not {bati}'s voice) when they have one, else by the default
 *          cute voice. The recording is heard as words and then gone: it is neither kept nor sent. Priced per message
 *          on its own words (MakeKind 'cuteVoice', cuteVoiceMana — the small 「−0.3」 beside 〔送る〕), taken before the
 *          voice is made and given back when none came; with no mana the words go alone with one calm line.
 *
 * Listening (client 2026-11-27, late: the sender hears their own voice again): 「そのまま」 can be heard on the draft card
 * before the send (〔▶ きいてみる〕); 「きれい」 cannot — it is the paid voice, made only at the send — and the card says so
 * in one line (`cleanLater`). After the send both play in the talk, for the sender as for the receiver.
 * A member who is not recorded has no choice to make: their words are read by the cute voice as before (cuteVoice.ts).
 */
export const VOICE_VERSIONS = ['asis', 'clean'] as const;
export type VoiceVersion = (typeof VOICE_VERSIONS)[number];
export const VOICE_VERSION_DEFAULT: VoiceVersion = 'asis';
/** users.onboarding_json key */
export const VOICE_VERSION_KEY = 'voice.dachi.version';
export const isVoiceVersion = (v: unknown): v is VoiceVersion => (VOICE_VERSIONS as readonly unknown[]).includes(v);
/** the member's choice as kept: none, or something else = the default */
export function voiceVersionOf(onboarding: unknown): VoiceVersion {
  const raw = (onboarding as Record<string, unknown> | null | undefined)?.[VOICE_VERSION_KEY];
  return isVoiceVersion(raw) ? raw : VOICE_VERSION_DEFAULT;
}

/** PUT /dachi/voice/version */
export const VoiceVersionBody = z.object({ version: z.enum(VOICE_VERSIONS) });
export type VoiceVersionBody = z.infer<typeof VoiceVersionBody>;
/** whether 「きれい」 can be chosen here (the voice service is on and there is a voice to read in), and its live price */
export interface VoiceCleanInfo {
  on: boolean;
  /** read in the member's own registered voice model (false: the default cute voice) */
  own: boolean;
  rate: CuteVoiceRate;
}
/** PUT /dachi/voice/version */
export interface VoiceVersionView {
  version: VoiceVersion;
  clean: VoiceCleanInfo;
}

/** PROVISIONAL wording (the story chat confirms) */
export const VOICE_VERSION_WORDS = {
  /** the one button on the draft card: its two sides */
  label: { asis: 'そのまま', clean: 'きれい' } as Record<VoiceVersion, string>,
  /** what the button is (for a screen reader) */
  heading: '声のえらび方',
  /** one small line under the button: what is sent now */
  note: {
    asis: '録った声を、ととのえて送るよ',
    cleanOwn: 'ことばを、きみの声のモデルが読んで送るよ',
    cleanCute: 'ことばを、かわいい声が読んで送るよ',
  },
  /** the take is being made ready the other way */
  switching: 'きりかえているよ…',
  /** 「きれい」 with no words heard: there is nothing to read */
  noWords: 'ことばが聞きとれなかったよ。ことばを入れるか、「そのまま」で送ってね',
  /** the other version could not be made ready */
  failed: 'いまは、きりかえられなかったみたい',
  /** 「きれい」 has no 〔▶ きいてみる〕: the voice is made (and paid for) at the send, and heard in the talk after it */
  cleanLater: '送ったあとで、聞けるよ',
} as const;
