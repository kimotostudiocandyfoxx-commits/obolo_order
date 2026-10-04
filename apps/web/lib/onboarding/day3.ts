import type { Step } from './script';

/**
 * DAY 3 【宇宙行きの切符 → 月】 — client's script (2026-10-04), first part.
 * Starts after the [認証] screen. KIMORIN's poses are transparent images shown over motion 3-7
 * (画像1/2/3/8 → kimorin-1/-2/-3/-8).
 *
 * PLACEHOLDER (P-OB-11, confirm with the client):
 *  - "・宇宙行き切符": no motion given; the ticket is assumed to be part of motion 3-1.
 *    (3モーション2 / 3モーション5 have not been referenced or delivered.)
 *  - KIMORIN's "宇宙なめんな" reply is used for both "宇宙に行く" and "やめておく".
 *  - The client's script stops at "創って創って創りまくって…"; the rest of the day (choosing one of
 *    8 OBOLO NEO forms + a NEO name) uses provisional lines (P-OB-12).
 *  - BGM: none is specified for day 3; the opening track plays until KIMORIN's motion.
 */
export const DAY3: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'video', motion: '3-1' }, // 招待信号を受信しました → 宇宙行き切符
  { t: 'action', label: '本部の中にあるロケット発射場へ向かう' },

  { t: 'video', motion: '3-3' },
  { t: 'bgm', track: null },
  { t: 'loop', motion: '3-4' },
  { t: 'say', who: 'KIMORIN', text: '待ってたケン。宇宙、、、行くか？' },
  { t: 'choice', key: 'go', options: [{ label: '宇宙に行く' }, { label: 'やめておく' }] },
  { t: 'say', who: 'KIMORIN', text: 'いや、普通もっと話を聞いていくヤロ。\n宇宙なめんな。' },
  { t: 'action', label: 'はいはい、なめてました。話を聞かせてください。手短にな。' },

  { t: 'video', motion: '3-6' },
  { t: 'loop', motion: '3-7' },
  { t: 'sprite', image: 'kimorin-1' },
  { t: 'say', who: 'KIMORIN', text: 'ちなみに秘密結社は初めて？' },
  { t: 'choice', key: 'secret_society', options: [{ label: '初めて' }, { label: '２回目' }, { label: '３回以上' }] },
  { t: 'say', who: 'KIMORIN', text: 'そうか、、珍しいな。' },
  { t: 'sprite', image: 'kimorin-2' },
  { t: 'say', who: 'KIMORIN', text: 'OBOLO ORDERは秘密を守るために\n全員姿と名前を変えることになっている' },
  { t: 'say', who: 'KIMORIN', text: 'だから君も当然、姿と名前を変えてもらう。' },
  { t: 'sprite', image: 'kimorin-3' },
  { t: 'say', who: 'KIMORIN', text: 'ということで！今から君の新しい姿を創っちゃおう！' },
  { t: 'sprite', image: 'kimorin-8' },
  { t: 'say', who: 'KIMORIN', text: 'なぜなら、OBOLO ORDERは新しいものを生み出す者たち….' },
  { t: 'say', who: 'KIMORIN', text: '創って創って創りまくって、気に入った物を見つけるのだ！' },

  // ---- From here: provisional lines by Claude (client decision 2026-10-04: on Day 3 the visitor only
  // takes an apprentice "OBOLO NEO" form chosen from 8; Bati is created later, after joining ORDER
  // at the Sun temple, on a second visit to the Moon temple). Edit freely. PLACEHOLDER (P-OB-12)
  { t: 'sprite', image: 'kimorin-2' },
  { t: 'say', who: 'KIMORIN', text: '……と言いたいところだけど、君はまだ見習いだケン。' },
  { t: 'say', who: 'KIMORIN', text: '見習いのORDERは「OBOLO NEO（オボロネオ）」と呼ばれる。' },
  { t: 'say', who: 'KIMORIN', text: 'ネオの姿は、オレが用意した8つの中から選んでもらうケン。\n本当の姿を創るのは、ORDERになってからのお楽しみ！' },
  { t: 'sprite', image: null },
  { t: 'neo' },
  { t: 'sprite', image: 'kimorin-3' },
  { t: 'say', who: 'KIMORIN', text: 'おお！{neo}か！似合ってるケン！' },
  { t: 'sprite', image: 'kimorin-1' },
  { t: 'say', who: 'KIMORIN', text: 'じゃあ名前も変えよう。\nネオとしての名前は？' },
  { t: 'name', placeholder: 'ネオとしての名前', submit: 'この名前にする' },
  { t: 'say', who: 'KIMORIN', text: '{name}……いい名前だケン。' },
  { t: 'say', who: 'KIMORIN', text: '今日から君は見習いORDER、\nOBOLO NEO「{name}」だ。' },
  { t: 'sprite', image: 'kimorin-8' },
  { t: 'say', who: 'KIMORIN', text: '明日は土星に行くケン。\n土星には、声でつながる仲間がいる。' },
  { t: 'say', who: 'KIMORIN', text: '遅れるなよ！' },
  { t: 'sprite', image: null },
  { t: 'end' },
];
