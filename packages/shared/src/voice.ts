/**
 * Voice registration (client decision 2026-10-07): every member records two short samples —
 * their own voice (Saturn read-aloud, singing on Mercury) and a changed voice they give Bati.
 * They read the fixed script below so the transcript is known (Fish Audio voice cloning needs it).
 */
export type VoiceSlot = 'self' | 'bati';

export const VOICE_SCRIPTS: Record<VoiceSlot, string> = {
  self: 'こんにちは。これが、わたしの声です。今日は空がきれいで、なんだか歌いたい気分です。オボロオーダーで、新しい何かを、どんどん生み出していきます。',
  bati: 'やっほー！ぼくはバティ。きみの相棒だよ。いっしょに宇宙を旅して、歌って、おしゃべりして、いっぱい遊ぼうね！',
};

/** Recording length the voice cloning works best with. */
export const VOICE_SAMPLE_SECONDS = { min: 8, max: 30 } as const;
