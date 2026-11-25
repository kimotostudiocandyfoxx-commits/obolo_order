import { z } from 'zod';
import { MakeConfirm } from './makeConfirm';
import { DEFAULT_COST_RATES, DEFAULT_PRICE_RULE, quoteMana, SONG_VOICE_CPU_SECONDS, SONG_VOICE_GPU_SEED, type CostRates, type PriceRule } from './manaPrice';

/**
 * R18 (client 2026-11-25): 君の声にする魔法 — a finished song sung again in the member's OWN registered voice (Seed-VC on
 * our GPU, from the song's stems). A paid spell with the member's yes (MakeConfirm, kind 'songVoice'): {bati} tells the
 * mana (「君の声にする魔法は、◯マナだよ。唱える？」), the yes charges it, the job splits the song when it never was and
 * converts the vocal; a failure gives the mana back. Both versions stay on the work (the original voice and 君の声): a
 * switch between them is free, and the free changes (tempo, cuts …) are rendered from the stems of the version in use.
 * Only the member's own voice: never another person's or a famous one.
 */

/** the parts of our GPU's work and the meter's names for them (gen_costs.model: their recorded seconds refine the quote) */
export const SONG_VOICE_GPU_MODELS = { cold: 'music:cold', split: 'music:split', convert: 'music:voice' } as const;
export type SongVoicePart = keyof typeof SONG_VOICE_GPU_MODELS;
export type SongVoiceSeconds = Record<SongVoicePart, number>;

/** the GPU seconds of one voice spell: waking up + the split (only when the song was never split) + the conversion */
export function songVoiceGpuSeconds(o: { split: boolean }, p90: Partial<SongVoiceSeconds> = {}): number {
  const s = (k: SongVoicePart) => (p90[k] != null && p90[k]! > 0 ? p90[k]! : SONG_VOICE_GPU_SEED[k]);
  return s('cold') + (o.split ? s('split') : 0) + s('convert');
}

export interface SongVoiceQuote {
  /** the mana {bati} says (and the yes is charged) */
  mana: number;
  /** the song must be split first (no stems yet) — a quote without it is only the conversion */
  split: boolean;
  gpuSeconds: number;
  costJpy: number;
}

/** THE price of the voice spell: the price rule (manaFor) of its estimated GPU (and CPU) seconds */
export function songVoiceQuote(o: { split: boolean }, rates: CostRates = DEFAULT_COST_RATES, rule: PriceRule = DEFAULT_PRICE_RULE, p90: Partial<SongVoiceSeconds> = {}): SongVoiceQuote {
  const gpuSeconds = songVoiceGpuSeconds(o, p90);
  const costJpy = gpuSeconds * rates.gpuSecondJpy + SONG_VOICE_CPU_SECONDS * rates.cpuSecondJpy;
  return { mana: quoteMana(costJpy, rule), split: o.split, gpuSeconds, costJpy };
}

/** the yes's spell key: the song and whether its split was in the price (a split done meanwhile is a new quote) */
export const songVoiceKey = (songId: string, split: boolean) => `voice:${songId.slice(0, 40)}:${split ? 'split' : 'stems'}`;

/** which voice a song is heard in: the studio's own (the original) or the member's */
export type SongVoiceVersion = 'original' | 'own';

/** POST /compose/songs/:id/voice/quote — what {bati} answers to 「自分の声にして」 */
export type SongVoiceQuoteView =
  | { status: 'quote'; price: number; spell: string; split: boolean }
  /** already sung in the member's voice: only a switch (free) */
  | { status: 'has'; using: SongVoiceVersion }
  /** no registered voice: {bati} tells how to register it (nothing charged) */
  | { status: 'noVoice' }
  /** consent / age does not allow the member's voice (M-R248 rules) */
  | { status: 'noConsent' }
  /** a song this cannot be done for (no studio, not a sung song) */
  | { status: 'off' };

/** POST /compose/songs/:id/voice — the yes (charged once per yes; the job converts) */
export const SongVoiceBody = z.object({ confirm: MakeConfirm.extend({ spell: z.string().max(64) }) });
export type SongVoiceBody = z.infer<typeof SongVoiceBody>;

/** POST /compose/songs/:id/voice/use — the version switch (free) */
export const SongVoiceUseBody = z.object({ use: z.enum(['original', 'own']) });
export type SongVoiceUseBody = z.infer<typeof SongVoiceUseBody>;
export interface SongVoiceUseView {
  using: SongVoiceVersion;
  song: { url: string; seconds: number };
  /** the versions there are (a song not sung in the member's voice has only the original) */
  versions: SongVoiceVersion[];
}

// --- the words ------------------------------------------------------------------------------------------------------

/** the member's own voice (「自分の声にして」「僕の声で歌って」「君の声にする魔法」) */
const OWN = /自分の声|じぶんの声|わたしの声|私の声|あたしの声|ボクの声|僕の声|ぼくの声|俺の声|おれの声|オレの声|うちの声|ウチの声|君の声にする魔法|きみの声にする魔法|キミの声にする魔法|君の声にして|きみの声にして/;
/** back to the voice the song was made with */
const ORIGINAL = /元の声|もとの声|最初の声|さいしょの声|はじめの声|前の声|まえの声|オリジナルの声/;
/** someone else's voice (a person, a singer, a famous one) — never; studio voices (男の人の声 …) are a new song instead */
const OTHER = /(さん|ちゃん|くん|様|さま|先生|せんせい|歌手|アイドル|有名人|芸能人|タレント|声優|友だち|友達|ともだち|ママ|パパ|お母さん|お父さん|おかあさん|おとうさん|母さん|父さん|兄ちゃん|姉ちゃん|お兄ちゃん|お姉ちゃん|おにいちゃん|おねえちゃん|弟|妹|彼氏|彼女|あの人|ほかの人|他の人|誰か|だれか|みんな)の声(で|に)/;

/**
 * What words about a finished song's voice ask: the member's own ('own'), the original back ('original'), another
 * person's ('other': {bati} declines kindly) — null: not about this.
 */
export function voiceAskOf(said: string): 'own' | 'original' | 'other' | null {
  const t = said.normalize('NFKC');
  if (ORIGINAL.test(t)) return 'original';
  // 「田中君の声で」 is someone else; 「君の声にして」 (as {bati} calls the member) is the member's own
  if (/[一-龯ァ-ヶa-zA-Z]君の声(で|に)/.test(t)) return 'other';
  if (OWN.test(t)) return 'own';
  if (OTHER.test(t)) return 'other';
  return null;
}

// --- the invitation after a song ------------------------------------------------------------------------------------

/** after the first invitation, at most once every this many finished songs (never twice in a row) */
export const VOICE_INVITE_EVERY = 3;
/** where the app keeps it (me.story `sys.${VOICE_INVITE_KEY}` = "<songs>:<song count at the last invitation>") */
export const VOICE_INVITE_KEY = 'voice_invite';

export interface VoiceInviteState {
  /** finished songs counted so far */
  songs: number;
  /** the count at the last invitation (null: never invited) */
  last: number | null;
}
export const parseVoiceInvite = (v: string | undefined | null): VoiceInviteState => {
  const [a, b] = String(v ?? '').split(':');
  const songs = Math.max(0, Math.floor(Number(a)) || 0);
  const last = b === undefined || b === '' || !Number.isFinite(Number(b)) ? null : Math.max(0, Math.floor(Number(b)));
  return { songs, last };
};
export const voiceInviteValue = (s: VoiceInviteState) => `${s.songs}:${s.last ?? ''}`;

/**
 * A song just finished: does {bati} add 「君の声にする魔法も、唱えられるよ。」 to its line? Only with a registered voice
 * and media consent (canUseMedia: under 13 / 13–15 without a guardian's yes never), never for a song already in the
 * member's voice; the first finished song (once allowed), then at most once every VOICE_INVITE_EVERY songs. Returns the
 * state to keep (the song counted; the invitation, when said).
 */
export function voiceInvite(st: VoiceInviteState, gate: { hasVoice: boolean; mediaOk: boolean; voiced?: boolean }): { invite: boolean; next: VoiceInviteState } {
  const songs = st.songs + 1;
  const allowed = gate.hasVoice && gate.mediaOk && !gate.voiced;
  const due = st.last == null || songs - st.last >= VOICE_INVITE_EVERY;
  const invite = allowed && due;
  return { invite, next: { songs, last: invite ? songs : st.last } };
}
