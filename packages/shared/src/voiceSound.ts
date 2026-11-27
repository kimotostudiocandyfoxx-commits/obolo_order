/**
 * ダチの声のメッセージの「おと」 (client 2026-11-27 — a TRIAL: the client tries it on a real phone, then chooses between
 * this and a paid read-aloud). A voice message is sent as the member's own recording, cleaned and a little faster
 * (apps/api/src/voice/voice-mix.ts), with its words shown as a caption and a small sound that fits the words mixed in
 * very quietly. The sound is picked from the words (the cheapest text model, packages/ai voiceMood.ts; the word rules
 * here when there is no model), can be changed before sending with the chips under 「おと」, and the one who gets it
 * can turn it off (〔おとをけす〕 plays the voice alone).
 *
 * The client's word: most people find BGM noisy. So the sounds are few notes with soft attacks (no melody against the
 * words, no drums, no bass), far under the voice, and where it fits a short accent at the start and the end instead of
 * a bed that goes on. The files are made once in code (apps/api/scripts/make-voice-sounds.mjs) and committed.
 */

/** the seven moods (the file names of the library: <mood>-a / -z / -bed .mp3) */
export const VOICE_MOODS = ['ureshii', 'wakuwaku', 'otsukare', 'bikkuri', 'shinmiri', 'omoshiro', 'oyasumi'] as const;
export type VoiceMood = (typeof VOICE_MOODS)[number];
/** a chip: a mood, or no sound */
export const VOICE_SOUNDS = [...VOICE_MOODS, 'none'] as const;
export type VoiceSound = (typeof VOICE_SOUNDS)[number];
export const isVoiceSound = (v: unknown): v is VoiceSound => typeof v === 'string' && (VOICE_SOUNDS as readonly string[]).includes(v);

/** PROVISIONAL wording (the story chat confirms): the heading and the chips */
export const VOICE_SOUND_HEADING = 'おと';
export const VOICE_SOUND_LABEL: Record<VoiceSound, string> = {
  ureshii: 'うれしい',
  wakuwaku: 'わくわく',
  otsukare: 'おつかれ',
  bikkuri: 'びっくり',
  shinmiri: 'しんみり',
  omoshiro: 'おもしろ',
  oyasumi: 'おやすみ',
  none: 'なし',
};

/**
 * What each mood is made of: `a` an accent as the message starts, `z` one as it ends, `bed` a sparse bed for its whole
 * length. (うれしい: a sparkly bell · わくわく: a bouncy short synth phrase · おつかれ: a soft piano · びっくり: a "poko" and
 * a small "!" · しんみり: a quiet pad · おもしろ: squishy, comical · おやすみ: a music box)
 */
export const VOICE_SOUND_PARTS: Record<VoiceMood, { a?: true; z?: true; bed?: true }> = {
  ureshii: { a: true, z: true },
  wakuwaku: { a: true, z: true },
  otsukare: { bed: true },
  bikkuri: { a: true },
  shinmiri: { bed: true },
  omoshiro: { a: true, z: true },
  oyasumi: { bed: true },
};

/** the sound of one message: `soft` = the weakest うれしい (the words gave no mood: one faint bell, never nothing) */
export interface VoiceSoundPick {
  sound: VoiceSound;
  soft?: boolean;
}
/** the words gave no mood: the weakest うれしい — not "none" (client 2026-11-27) */
export const VOICE_SOUND_FALLBACK: VoiceSoundPick = { sound: 'ureshii', soft: true };

// (how the voice itself is made — the speed, the key, the pitch correction, the silences cut — is voiceTune.ts)
/** PLACEHOLDER: how many voice messages one member may have made ready a day (each costs about ¥0.03) */
export const VOICE_MIX_DAILY_CAP = 100;
/** past the day's cap (the `n`-th of today, counted from 1) */
export const voiceMixCapped = (n: number, cap: number = VOICE_MIX_DAILY_CAP): boolean => n > cap;
/** what a member is told past the cap (PROVISIONAL wording) */
export const VOICE_MIX_CAP_WORDS = '今日は、声をたくさん送ったね。つづきは、文字で送ろう。';

/**
 * The mood of the words by plain rules — used when there is no model, and to check the model's answer is a mood at all.
 * The first rule that matches wins (a good-night is a good-night even with a laugh in it); null = cannot tell.
 */
const RULES: readonly [VoiceMood, RegExp][] = [
  ['oyasumi', /おやすみ|お休み|寝る|ねる[ねよ。！!]|眠|ねむ|また明日|またあした|いい夢|good ?night/i],
  ['bikkuri', /びっくり|ビックリ|驚|おどろ|まじ[でか]?[！!？?]|マジ[でか]?|えっ|ええっ|うそ[！!？?でだ]|嘘[！!？?でだ]|ほんと[にう]?[？?！!]|本当[に]?[？?！!]|信じられ|やばい|ヤバい|ヤバ/],
  ['omoshiro', /笑|わら[っい]|ウケ|うける|おもしろ|面白|おもろ|ｗｗ|ww|草$|爆笑|ふざけ|へんな|変な|ギャグ|ダジャレ/],
  ['shinmiri', /さみし|さびし|寂し|淋し|かなし|悲し|つらい|辛い|泣[いきけ]|ないちゃ|ごめん|すまん|申し訳|会いたい|あいたい|しんみり|落ち込|おちこ|心配|しんぱい|残念|ざんねん/],
  ['otsukare', /おつかれ|お疲れ|つかれた|疲れた|がんばった|頑張った|ごくろう|ご苦労|ゆっくり休|ゆっくりして|ありがとう|ありがと|おかえり|ただいま|無理しないで|むりしないで/],
  ['wakuwaku', /わくわく|ワクワク|楽しみ|たのしみ|早く[会あ見み行い聴き]|はやく[会あ見み行い聴き]|待ちきれ|まちきれ|行こう|いこう|やろう|作ろう|つくろう|あそぼ|遊ぼ|明日[はがも]|あした[はがも]|どきどき|ドキドキ/],
  ['ureshii', /うれし|嬉し|やった|よかった|良かった|おめでと|最高|さいこう|すごい|凄い|すげ|大好き|だいすき|すき|好き|できた|出来た|しあわせ|幸せ|たのしかった|楽しかった|いいね|かわいい|可愛い/],
];
export function moodByRules(text: string): VoiceMood | null {
  const t = text.normalize('NFKC');
  return RULES.find(([, re]) => re.test(t))?.[0] ?? null;
}

/** the model's one-word answer → a mood (null: 'none', nothing, or not one of the seven) */
export function parseMoodAnswer(answer: string | null | undefined): VoiceMood | null {
  const a = (answer ?? '').toLowerCase();
  const hits = VOICE_MOODS.filter((m) => a.includes(m) || a.includes(VOICE_SOUND_LABEL[m]));
  // exactly one mood named: the answer; none, or several (it could not decide): no answer
  return hits.length === 1 ? hits[0] : null;
}

/**
 * The sound for the words: the model's answer when it names one mood, else the word rules, else the weakest うれしい.
 * No words at all (nothing was heard) is the weakest うれしい too.
 */
export function pickVoiceSound(text: string, modelAnswer?: string | null): VoiceSoundPick {
  const mood = parseMoodAnswer(modelAnswer) ?? moodByRules(text);
  return mood ? { sound: mood } : VOICE_SOUND_FALLBACK;
}
