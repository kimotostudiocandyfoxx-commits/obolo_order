import type { Step } from './script';

/**
 * DAY 4 【土星】 — client outline (2026-10-04) + provisional lines by Claude (✏️, P-OB-13).
 * Flow: [認証] → motion 4-1 (Moon → Saturn) → Saturn temple → inside: たこ焼きブラザー & シスター
 * (their video is not made yet: motion 4-2 placeholder, then the temple still with both standing)
 * → how to enjoy Saturn (client's points) → "まぁまずは遊んでみよう！" → ころりん tutorial → countdown.
 *
 * Voices (✏️): ブラザー = rough and loud ("〜だ", "〜ねぇ"); シスター = quiet and gentle.
 */
export const DAY4: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'video', motion: '4-1' }, // 月から土星へ
  { t: 'still', image: 'saturn-temple' },
  { t: 'caption', text: '土星の神殿に到着した' },
  { t: 'action', label: '神殿の中に入る' },

  { t: 'video', motion: '4-2' }, // たこ焼きブラザーとシスターがいる（動画・未着）
  { t: 'still', image: 'saturn-temple' },
  { t: 'sprite', image: ['takoyaki-brother', 'takoyaki-sister'] },
  { t: 'caption', text: 'たこ焼きブラザーとたこ焼きシスターが現れた' },
  // ✏️ introductions
  { t: 'say', who: 'たこ焼きブラザー', text: 'よぉ、{name}。よく来たな。\n俺は、たこ焼きブラザー。' },
  { t: 'say', who: 'たこ焼きシスター', text: '……わたしは、たこ焼きシスター。\n土星の案内人。' },
  // client's points
  { t: 'say', who: 'たこ焼きブラザー', text: '土星は、原石の星だ。' },
  { t: 'say', who: 'たこ焼きシスター', text: 'ただただ、感情を呟きたいだけの時。' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'みんなの、何気ないリアルな感情を見てみたい時。' },
  { t: 'say', who: 'たこ焼きシスター', text: 'そんな時に、遊びにくる星。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '呟く時、文字だけだと半分も伝わらねぇ。' },
  { t: 'say', who: 'たこ焼きシスター', text: '間違って、伝わる。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '冷たく、見えちまう。' },
  { t: 'say', who: 'たこ焼きシスター', text: 'しかし、土星は\n文字に声を乗っけてくれる。' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'まぁ、まずは遊んでみよう！' },

  { t: 'bgm', track: null }, // voices take over in ころりん
  { t: 'sprite', image: null },
  { t: 'saturn' },

  // ✏️ after the tutorial
  { t: 'sprite', image: ['takoyaki-brother', 'takoyaki-sister'] },
  { t: 'say', who: 'たこ焼きシスター', text: '{name}の声、ちゃんと届いたよ。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '明日は木星だ。\n遅れんじゃねぇぞ。' },
  { t: 'sprite', image: null },
  { t: 'end' },
];
