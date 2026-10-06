import type { Step } from './script';

/**
 * DAY 8 【金星】 — client's script (2026-10-05) + provisional lines by Claude (✏️, P-OB-17).
 * Venus is now the planet of making things: make in-game goods and items, buy and sell them with
 * the stars collected on the other planets (no real money, no real products). Replaces spec's reels.
 * Flow: [認証] → wake up on Mars → KIMORIN: off to Venus by rocket (motion 8-1) → the gorilla trio
 * ロングG / ハットG / ボスG (KIMORIN's friends) → Venus play screen (placeholder layout until the
 * client's design, P-VENUS-1) → countdown. The last planet; day 9 is the Eclipse day.
 * Art: longg/hatg/bossg.webp (client, 2026-10-05); the Venus backdrop is still generated.
 * Who says which of the client's lines is Claude's choice (✏️).
 */
export const DAY8: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'still', image: 'mars-city' },
  { t: 'caption', text: '火星で目を覚ました' }, // ✏️
  { t: 'sprite', image: 'kimorin-1' },
  { t: 'say', who: 'KIMORIN', text: 'おはよう、よく眠れたか？' },
  { t: 'say', who: 'KIMORIN', text: '次は、金星に行くぞ！' },
  { t: 'sprite', image: null },
  { t: 'action', label: 'ロケットに乗る' }, // ✏️
  { t: 'video', motion: '8-1' }, // ロケットで金星へ（動画・未着）

  { t: 'still', image: 'venus-market' },
  { t: 'caption', text: '金星に到着した' }, // ✏️
  { t: 'sprite', image: 'kimorin-3' },
  { t: 'say', who: 'KIMORIN', text: '着いたケン！\nここには、オレの友達のゴリラが3人いるんだ。' }, // ✏️
  { t: 'sprite', image: ['longg', 'bossg', 'hatg'] },
  { t: 'caption', text: 'ロングG、ハットG、ボスGが現れた' }, // ✏️
  { t: 'say', who: 'KIMORIN', text: 'よっ、ロングG、ハットG、ボスG！\n今日は新入りを連れてきたケン。' }, // ✏️
  // client's lines (split between the three by Claude ✏️)
  { t: 'say', who: 'ボスG', text: '金星へようこそ。' },
  { t: 'say', who: 'ハットG', text: '物を作りたくなったこと、あるか？' },
  { t: 'say', who: 'ロングG', text: '物を作ることで表現するのも、\nとっても楽しい。' },
  { t: 'say', who: 'ハットG', text: 'そして、人が作ったものを集めるのも、\nとっても楽しい。' },
  { t: 'say', who: 'ロングG', text: '……口で説明しても、わかんないか。' },
  { t: 'say', who: 'ボスG', text: 'よし、それでは実際、\n金星で遊んでみよう。' },

  { t: 'bgm', track: null },
  { t: 'sprite', image: null },
  { t: 'venus' },

  // ✏️ after playing — the last planet of the journey
  { t: 'bgm', track: 'opening' },
  { t: 'sprite', image: ['longg', 'bossg', 'hatg'] },
  { t: 'say', who: 'ボスG', text: '{name}の作ったもの、楽しみにしてるぜ。' },
  { t: 'sprite', image: 'kimorin-8' },
  { t: 'say', who: 'KIMORIN', text: 'これで、8つの星をぜんぶまわったケン。' },
  { t: 'say', who: 'KIMORIN', text: '明日は、もっと遠くの星へ行くケン。\n遅れるなよ！' }, // ✏️ (day 9 heads for Pluto)
  { t: 'sprite', image: null },
  { t: 'end' },
];
