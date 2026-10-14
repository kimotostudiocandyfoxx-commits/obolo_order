import type { Step } from './script';

/**
 * DAY 5 【木星】 — client outline (2026-10-04) + provisional lines by Claude (✏️, P-OB-14).
 * Flow: [認証] → wake up on Saturn → to Jupiter (motion 5-1, not made yet) → Jupiter temple
 * (motion 5-2, not made yet) → KIMORIN introduces his friend 大根カイザー → Kaiser explains Jupiter
 * (client's lines) → Jupiter play screen (client is designing it: P-JUP-1, placeholder for now)
 * → countdown.
 * 大根カイザー ends his sentences with 「DA」 (client, 2026-10-04). KIMORIN travels along.
 * Art: jupiter-kaiser.jpg (client's Jupiter world with 大根カイザー).
 */
export const DAY5: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'still', image: 'saturn-temple' },
  { t: 'caption', text: '土星で目を覚ました' }, // ✏️
  // ✏️
  { t: 'sprite', image: 'kimorin-1' },
  { t: 'say', who: 'KIMORIN', text: 'おはようケン、{name}！' },
  { t: 'say', who: 'KIMORIN', text: '今日は木星に行くぞ。\nオレの古い友達がいるんだ。' },
  { t: 'sprite', image: null },
  { t: 'action', label: '木星へ向かう' }, // ✏️
  { t: 'video', motion: '5-1' }, // 土星から木星へ（動画・未着）
  { t: 'caption', text: '木星に到着した' }, // ✏️
  { t: 'sprite', image: 'kimorin-3' },
  { t: 'say', who: 'KIMORIN', text: '着いたケン！\n神殿はこっちだ。' }, // ✏️
  { t: 'sprite', image: null },
  { t: 'action', label: '木星の神殿へ向かう' }, // ✏️
  { t: 'video', motion: '5-2' }, // 木星の神殿へ（動画・未着）

  { t: 'still', image: 'jupiter-kaiser' },
  { t: 'caption', text: '大根カイザーが現れた' }, // ✏️
  // ✏️ KIMORIN introduces his friend
  { t: 'sprite', image: 'kimorin-3' },
  { t: 'say', who: 'KIMORIN', text: 'カイザー！\n久しぶりだケン！' },
  { t: 'sprite', image: null },
  { t: 'say', who: '大根カイザー', text: 'おお、KIMORIN。\n久しぶりDA！' },
  { t: 'sprite', image: 'kimorin-1' },
  { t: 'say', who: 'KIMORIN', text: '紹介するケン。\n新入りのOBOLO NEO、{name}だ。' },
  { t: 'sprite', image: null },
  { t: 'say', who: '大根カイザー', text: 'よく来たDA、{name}。\n我こそは木星の王、大根カイザーDA！' },
  // client's lines (ending 「DA」 added per the client)
  { t: 'say', who: '大根カイザー', text: '木星は、命が宿る星DA。' },
  { t: 'say', who: '大根カイザー', text: '君が見た風景だったり、\n今日食べたご飯だったり。' },
  { t: 'say', who: '大根カイザー', text: 'そんな何気ない日常でも、命を宿し、\nそして思い出になっていくのDA。' },
  { t: 'say', who: '大根カイザー', text: '……言葉だけじゃ分かりにくいか。' },
  { t: 'say', who: '大根カイザー', text: 'よし、それでは\n実際に木星で遊んでみるDA！' },

  { t: 'bgm', track: null }, // the photos' own sounds take over
  { t: 'jupiter' },

  // ✏️ after the tutorial
  { t: 'bgm', track: 'opening' },
  { t: 'say', who: '大根カイザー', text: '{name}。\n今日という日も、ひとつの命DA。' },
  { t: 'sprite', image: 'kimorin-8' },
  { t: 'say', who: 'KIMORIN', text: 'さすがカイザー、いいこと言うケン。' },
  { t: 'say', who: 'KIMORIN', text: '明日は水星だ。\n水星にも、オレの友達がいるケン！' },
  { t: 'sprite', image: null },
  { t: 'end' },
];
