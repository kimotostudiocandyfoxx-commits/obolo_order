import type { Step } from './script';

/**
 * DAY 7 【火星】 — client's script (2026-10-05) + provisional lines by Claude (✏️, P-OB-16).
 * Mars comes before Venus (client, 2026-10-05): Venus is day 8.
 * Flow: [認証] → wake up on Mercury → KIMORIN: rocket to Mars (motion 7-1) → the future city of Mars
 * (7-2) → ヒポキン, the hippo king (KIMORIN's friend) → "Mars is the planet where videos gather"
 * → Mars play screen (the client's UI comes next: P-MARS-1, placeholder for now) → countdown.
 * Motions 7-1 / 7-2 are not made yet. Art: mars-city.jpg, hipokin.webp (client, 2026-10-05).
 */
export const DAY7: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'still', image: 'mercury-island' },
  { t: 'caption', text: '水星で目を覚ました' }, // ✏️
  { t: 'sprite', image: 'kimorin-1' },
  { t: 'say', who: 'KIMORIN', text: 'おはよう、よく眠れたか？' },
  { t: 'say', who: 'KIMORIN', text: '今日行くところは、火星。\nよし、ロケットに乗れ！' },
  { t: 'sprite', image: null },
  { t: 'action', label: 'ロケットに乗る' }, // ✏️
  { t: 'video', motion: '7-1' }, // ロケットで火星へ（動画・未着）
  { t: 'caption', text: '火星に到着した' }, // ✏️
  { t: 'sprite', image: 'kimorin-3' },
  { t: 'say', who: 'KIMORIN', text: '着いたケン！\nあの光ってるのが、火星の未来都市だ。' }, // ✏️
  { t: 'sprite', image: null },
  { t: 'action', label: '火星の未来都市へ向かう' }, // ✏️
  { t: 'video', motion: '7-2' }, // 未来都市へ（動画・未着）

  { t: 'still', image: 'mars-city' },
  { t: 'sprite', image: 'hipokin' },
  { t: 'caption', text: 'カバの王様、ヒポキンが現れた' }, // ✏️
  // ✏️ KIMORIN introduces his friend
  { t: 'sprite', image: ['kimorin-1', 'hipokin'] },
  { t: 'say', who: 'KIMORIN', text: 'ヒポキン、久しぶりだケン！\n今日は新入りを連れてきた。' },
  { t: 'sprite', image: 'hipokin' },
  // client's lines
  { t: 'say', who: 'ヒポキン', text: '火星へようこそ。' },
  { t: 'say', who: 'ヒポキン', text: '言葉だけだったり、画像だけ、音だけだったら\n物足りないぐらいの表現をしたいとき。' },
  { t: 'say', who: 'ヒポキン', text: 'そんな時は、映像がいい。' },
  { t: 'say', who: 'ヒポキン', text: '火星は、映像が集まる惑星だ。' },
  { t: 'say', who: 'ヒポキン', text: 'まあ、言葉では分かりにくいか。' },
  { t: 'say', who: 'ヒポキン', text: 'よし、実際に火星で遊んでみよう。' },

  { t: 'bgm', track: null },
  { t: 'sprite', image: null },
  { t: 'mars' },

  // ✏️ after playing
  { t: 'bgm', track: 'opening' },
  { t: 'sprite', image: 'hipokin' },
  { t: 'say', who: 'ヒポキン', text: '{name}の毎日も、一本の映画になる。\nまた見せに来い。' },
  { t: 'sprite', image: 'kimorin-8' },
  { t: 'say', who: 'KIMORIN', text: '明日は金星だ。\n金星にも、オレの友達がいるケン！' },
  { t: 'sprite', image: null },
  { t: 'end' },
];
