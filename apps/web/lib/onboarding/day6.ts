import type { Step } from './script';

/**
 * DAY 6 【水星】 — client's script (2026-10-05) + provisional lines by Claude (✏️, P-OB-15).
 * Flow: [認証] → wake up on Jupiter → KIMORIN: rocket to Mercury (motion 6-1) → Mercury: a sea with
 * floating islands, land on one (6-2) → Mercury temple (6-3) → フリージー (KIMORIN's friend)
 * → "have you ever put your feelings on sound?" ある / ない → Mercury sea chart tutorial (the
 * client's design: islands per genre, swipe through songs) → countdown.
 * Motions 6-1…6-3 are not made yet (placeholder screen). Art: freezy.webp (client, 2026-10-05).
 */
export const DAY6: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'still', image: 'jupiter-kaiser' },
  { t: 'caption', text: '木星で目を覚ました' }, // ✏️
  { t: 'sprite', image: 'kimorin-1' },
  { t: 'say', who: 'KIMORIN', text: 'おはよう、よく眠れたか？' },
  { t: 'say', who: 'KIMORIN', text: '今日は水星に行こう。\nロケットに乗れ！' },
  { t: 'sprite', image: null },
  { t: 'action', label: 'ロケットに乗る' }, // ✏️
  { t: 'video', motion: '6-1' }, // ロケットで水星へ（動画・未着）
  { t: 'video', motion: '6-2' }, // 水星：海に浮かぶ島に着陸（動画・未着）
  { t: 'caption', text: '水星に到着した' }, // ✏️
  { t: 'sprite', image: 'kimorin-3' },
  { t: 'say', who: 'KIMORIN', text: '着いたケン！\n神殿は、あの島の上だ。' }, // ✏️
  { t: 'sprite', image: null },
  { t: 'action', label: '水星の神殿へ向かう' }, // ✏️
  { t: 'video', motion: '6-3' }, // 水星の神殿へ（動画・未着）

  { t: 'sprite', image: 'freezy' },
  { t: 'caption', text: 'フリージーが現れた' }, // ✏️
  // ✏️ KIMORIN introduces his friend
  { t: 'sprite', image: ['kimorin-1', 'freezy'] },
  { t: 'say', who: 'KIMORIN', text: 'よっ、フリージー！\n今日は新入りを連れてきたケン。' },
  { t: 'sprite', image: 'freezy' },
  // client's lines
  { t: 'say', who: 'フリージー', text: '音楽の惑星、水星へようこそ。\nよく来たな、{name}。' },
  { t: 'say', who: 'フリージー', text: '自分の思いだったり、起こった出来事を\n音に乗っけたことはあるか？' },
  {
    t: 'choice',
    key: 'music',
    options: [
      { label: 'ある', goto: 'mer-yes' },
      { label: 'ない', goto: 'mer-no' },
    ],
  },
  { t: 'label', id: 'mer-yes' },
  { t: 'say', who: 'フリージー', text: 'ほう、なかなかやるな。' }, // ✏️
  { t: 'goto', id: 'mer-power' },
  { t: 'label', id: 'mer-no' },
  { t: 'say', who: 'フリージー', text: 'そうか。なら今日が、はじめての日だ。' }, // ✏️
  { t: 'label', id: 'mer-power' },
  { t: 'say', who: 'フリージー', text: '実はな、音に乗っけると\n100倍のパワーを持つ。' },
  { t: 'say', who: 'フリージー', text: '今日食べたラーメンが美味しかった。\n学校に遅刻しそうだ。' },
  { t: 'say', who: 'フリージー', text: 'そんな自分の日常のことを、\n歌にしてみよう。' },
  { t: 'say', who: 'フリージー', text: '……口で説明しても、わかりにくいよな。' },
  { t: 'say', who: 'フリージー', text: 'よし、それでは\n実際に遊んでみよう。' },

  { t: 'bgm', track: null },
  { t: 'sprite', image: null },
  { t: 'mercury' },

  // ✏️ after playing
  { t: 'bgm', track: 'opening' },
  { t: 'sprite', image: 'freezy' },
  { t: 'say', who: 'フリージー', text: '{name}の日常も、立派な歌になる。\nまた聴かせてくれ。' },
  { t: 'sprite', image: 'kimorin-8' },
  { t: 'say', who: 'KIMORIN', text: '明日は金星だ。\n金星にも、オレの友達がいるケン！' },
  { t: 'sprite', image: null },
  { t: 'end' },
];
