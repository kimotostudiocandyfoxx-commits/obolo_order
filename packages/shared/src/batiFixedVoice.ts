/**
 * {bati}'s voice (client decision M-R342, 2026-11-27): every {bati} speaks in a FIXED cute anime-style Fish Audio voice,
 * kept per egg — no longer an imitation of the member's own voice.
 * Client 2026-11-27 (later the same day): BOTH eggs use the same voice, 「活発なマスコットキャラ」 (the same voice as the
 * character サーぽん). The ♂ voice first chosen (「元気な少年」, ed07fac0ac144ba6b7f6b208d57ace05) is not used. The two
 * constants / settings stay, so the eggs can be given different voices again by changing one id.
 * Both at BATI_VOICE_SPEED (1.3×) with the pitch as it is (Fish's prosody.speed, or ffmpeg atempo for the story's lines).
 * The 2nd / 3rd {bati} (SYS-S003) speak in their own egg's voice; under-13 members' {bati} in the same voices.
 * The ids are not secrets; the API can override them (FISH_BATI_MOON_VOICE_ID / FISH_BATI_SUN_VOICE_ID).
 *
 * No imports here: apps/web/scripts/story-voices.ts reads this file by path, without an install.
 */
export const BATI_FIXED_VOICES: Readonly<Record<'moon' | 'sun', string>> = {
  moon: '270c409c18d14a60a81ad8c2f24007b9',
  sun: '270c409c18d14a60a81ad8c2f24007b9',
};

/**
 * The egg whose voice speaks when none is known (no {bati} born yet, a record without an egg): the Moon egg (♀) — the
 * story's {bati} voice has always been the moon's (batiDefaultVoice's default too).
 */
export const BATI_VOICE_DEFAULT_EGG = 'moon' as const;

/** the fixed Fish voice of a {bati} born from this egg (`ids`: the server's own setting, when it has one) */
export function batiFixedVoice(egg?: 'moon' | 'sun' | null, ids: Partial<Record<'moon' | 'sun', string | null | undefined>> = {}): string {
  const e = egg === 'sun' || egg === 'moon' ? egg : BATI_VOICE_DEFAULT_EGG;
  return ids[e] || BATI_FIXED_VOICES[e];
}

/**
 * How fast {bati} speaks (M-R342: 1.3×, the pitch unchanged; R14 had 1.2). Fish's prosody.speed in the chat (no
 * chipmunk); the story's lines get the story tempo (design/story-voices.json "tempo": 1.3, ffmpeg atempo) — the same
 * number. The API's BATI_VOICE_SPEED overrides it; 1 = the voice as it is.
 */
export const BATI_VOICE_SPEED = 1.3;

/**
 * The speaker the story's pre-made {bati} lines are kept under: voiceKey(batiStoryVoice(egg), act, text). One per
 * DISTINCT voice, not per egg: an egg whose voice is the same as an earlier egg's shares that egg's files (both eggs
 * the same voice → every line is made once, under "バティ:moon"); eggs with different voices each get their own.
 */
export function batiStoryVoice(egg: 'moon' | 'sun', voices: Readonly<Record<'moon' | 'sun', string>> = BATI_FIXED_VOICES): string {
  const first = (['moon', 'sun'] as const).find((e) => voices[e] === voices[egg]) ?? egg;
  return `バティ:${first}`;
}
