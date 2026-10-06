import type { Step } from './script';

/**
 * DAY 9 【エクリプス】 — client's script (2026-10-06) + provisional lines by Claude (✏️, P-OB-19).
 * Flow: [認証] → wake up on Venus → KIMORIN: today, Pluto! → "あ、ちょっと待って" — Bati is weak:
 * it lives on the Sun's power "mana" and used it up on the planets → back to the society's HQ on
 * Earth (motion 9-1, not made yet; then Day 1's HQ motions 6 / 7 / 9) → MONBAN: "おかえり" →
 * the Eclipse: link your soul to the Sun at the Sun temple; whoever succeeds is an ORDER and can
 * give Bati mana → the secret rocket costs ¥88 a month → OK → payment (Stripe, inside the story)
 * → "エクリプス用のロケットに案内する" → ORDER (the Eclipse scene itself is the next script).
 * "もう少し考える" brings MONBAN's question back.
 */
export const DAY9: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'still', image: 'venus-market' },
  { t: 'caption', text: '金星で目を覚ました' }, // ✏️
  { t: 'sprite', image: 'kimorin-1' },
  { t: 'say', who: 'KIMORIN', text: 'おはよう、よく眠れたか？' },
  { t: 'say', who: 'KIMORIN', text: 'よし、今日行く場所は冥王星！\nロケットに乗れ！' },
  { t: 'sprite', image: null },
  { t: 'action', label: 'ロケットに乗る' }, // ✏️
  { t: 'sprite', image: 'kimorin-3' },
  { t: 'say', who: 'KIMORIN', text: 'あ、ちょっと待って。' },
  { t: 'sprite', image: '@bati-weak' },
  { t: 'caption', text: '{bati}の元気がない' }, // ✏️
  { t: 'sprite', image: ['kimorin-1', '@bati-weak'] },
  { t: 'say', who: 'KIMORIN', text: '{bati}は、太陽の力……\n「マナ」というエネルギーで生きているんだ。' },
  { t: 'say', who: 'KIMORIN', text: '土星、木星、火星、金星……\n{bati}は、マナを使っていろいろしたからな。' },
  { t: 'say', who: 'KIMORIN', text: 'マナが、なくなってきてるんだと思う。' },
  { t: 'say', who: 'KIMORIN', text: '一度、地球の結社に帰ろう。' },
  { t: 'sprite', image: null },
  { t: 'action', label: 'ロケットで地球に帰る' }, // ✏️
  { t: 'video', motion: '9-1' }, // ロケットで地球の本部へ（動画・未着）

  // the society's HQ on Earth (Day 1's motions)
  { t: 'loop', motion: 6 }, // 「本部に到着しました」is in the video itself
  { t: 'action', label: '中に入る' },
  { t: 'bgm', track: 'monban' },
  { t: 'video', motion: 7 },
  { t: 'loop', motion: 9 },
  { t: 'say', who: 'MONBAN', text: 'おかえり…。\n楽しめたか…？' },
  { t: 'say', who: 'KIMORIN', text: 'MONBAN、大変なんだ。\n{bati}のマナが、なくなりそうなんだ。' }, // ✏️ (KIMORIN explains)
  { t: 'say', who: 'MONBAN', text: '……{bati}のマナが、もうすぐ消えそうだ。' },
  { t: 'say', who: 'MONBAN', text: 'このままだと…{bati}は、消えてしまう。' },
  { t: 'say', who: 'MONBAN', text: '{name}、君は太陽の神殿に向かい…\n太陽と、君の魂の一部がつながる必要がある。' },
  { t: 'say', who: 'MONBAN', text: 'このことを、結社の言葉で\n「エクリプス」という。' },
  { t: 'say', who: 'MONBAN', text: 'エクリプスが無事に成功した者が、ORDERと呼ばれ…\n{bati}に「マナ」を渡せるようになる。' },
  { t: 'say', who: 'MONBAN', text: 'そして、自由に宇宙を遊んだり、\n旅をしたりすることができる。' },
  { t: 'say', who: 'MONBAN', text: 'ただ、太陽の神殿は、とてつもなく暑い。\n普通のロケットだったら、一瞬で溶けてしまう。' },
  { t: 'say', who: 'MONBAN', text: 'だから、結社の秘密ロケットを\n使わないといけない。' },
  { t: 'say', who: 'MONBAN', text: 'この秘密ロケットと君の魂の一部を、太陽とリンクさせておく間…\nどうしても経費がかかってしまう。' },
  { t: 'say', who: 'MONBAN', text: '日本円にしたら、月88円だ。' },
  { t: 'label', id: 'ask' },
  { t: 'say', who: 'MONBAN', text: '払えるなら、今からエクリプスを開始する。' },
  {
    t: 'choice',
    key: 'eclipse',
    options: [{ label: 'OK', goto: 'pay' }, { label: 'もう少し考える' }], // ✏️ the second option
  },
  // ✏️ not yet — MONBAN waits and asks again
  { t: 'label', id: 'later' },
  { t: 'say', who: 'MONBAN', text: '……そうか。\n{bati}のために、よく考えてくれ。' },
  { t: 'goto', id: 'ask' },

  { t: 'label', id: 'pay' },
  { t: 'order', cancel: 'later' },
  { t: 'say', who: 'MONBAN', text: 'よし、分かった。' },
  { t: 'say', who: 'MONBAN', text: 'それでは、エクリプス用のロケットに案内する。' },
  { t: 'end' },
];
