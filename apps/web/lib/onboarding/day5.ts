import type { Step } from './script';

/**
 * DAY 5 【木星】 — client outline (2026-10-04) + provisional lines by Claude (✏️, P-OB-14).
 * Flow: [認証] → wake up on Saturn → to Jupiter (motion 5-1, not made yet) → Jupiter temple
 * (motion 5-2, not made yet) → 大根カイザー explains Jupiter (client's lines) → Jupiter play screen
 * (client is designing it: P-JUP-1, placeholder tutorial for now) → countdown.
 * Art: jupiter-kaiser.jpg (client's Jupiter world with 大根カイザー).
 */
export const DAY5: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'still', image: 'saturn-temple' },
  { t: 'caption', text: '土星で目を覚ました' }, // ✏️
  { t: 'action', label: '木星へ向かう' }, // ✏️
  { t: 'video', motion: '5-1' }, // 土星から木星へ（動画・未着）
  { t: 'caption', text: '木星に到着した' }, // ✏️
  { t: 'action', label: '木星の神殿へ向かう' }, // ✏️
  { t: 'video', motion: '5-2' }, // 木星の神殿へ（動画・未着）

  { t: 'still', image: 'jupiter-kaiser' },
  { t: 'caption', text: '大根カイザーが現れた' }, // ✏️
  // ✏️ introduction
  { t: 'say', who: '大根カイザー', text: 'よく来たな、{name}。\n我こそは木星の王、大根カイザー。' },
  // client's lines
  { t: 'say', who: '大根カイザー', text: '木星は、命が宿る星。' },
  { t: 'say', who: '大根カイザー', text: '君が見た風景だったり、\n今日食べたご飯だったり。' },
  { t: 'say', who: '大根カイザー', text: 'そんな何気ない日常でも、命を宿し、\nそして思い出になっていく。' },
  { t: 'say', who: '大根カイザー', text: '……言葉だけじゃ分かりにくいか。' },
  { t: 'say', who: '大根カイザー', text: 'よし、それでは\n実際に木星で遊んでみよう。' },

  { t: 'bgm', track: null }, // the photos' own sounds take over
  { t: 'jupiter' },

  // ✏️ after the tutorial
  { t: 'bgm', track: 'opening' },
  { t: 'say', who: '大根カイザー', text: '{name}。\n今日という日も、ひとつの命だ。' },
  { t: 'say', who: '大根カイザー', text: '明日は水星へ行くといい。\n大事に過ごせよ。' },
  { t: 'end' },
];
