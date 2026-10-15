import type { Step } from './script';

/**
 * DAY 1 【地球の本部】 — the story of 2026-10-14 (docs/story-rewrite/土星まで_UI引き継ぎ.md §9,
 * D01-S001〜D01-S012). From the invitation to MONBAN's 「じゃあ、また明日会おう…。」.
 * The client's Day-1 motions are kept where they match the story (client, 2026-10-14: "1日目は今の画像や
 * 動画でそのまんま"): 1–4 invitation, 5–6 HQ, 7/9 MONBAN, 10 the invitation floats, 11 the gate opens,
 * 12–13 the temple and OBOLON, 14–17/19 the universe, 27–28 MONBAN steps in, 29 the letter.
 * The age question and the 「少し話す、どうする？」 choice were cut (client 2026-10-15): after the name OBOLON goes
 * straight on to 「ここは、宇宙秘密結社だ。」.
 * Saved: name, choice1 (day 7 quotes it), the riddle book (seals 1・7・8),
 * the letter and the mana gem.
 */
export const DAY1: Step[] = [
  // BGM (client, 2026-10-04): opening → MONBAN's theme from MONBAN → OBOLON's theme from OBOLON.
  { t: 'bgm', track: 'opening' },
  { t: 'motes', count: 36 }, // 金色の光の粒（演出）
  { t: 'caption', text: '1日目' },
  // D01-S001 招待状
  { t: 'video', motion: 1 }, // 招待信号を受信しました（文字は動画の中）
  { t: 'loop', motion: 2 },
  { t: 'action', label: '封を開く' },
  { t: 'video', motion: 3 },
  { t: 'loop', motion: 4 }, // 招待状（文字は動画の中）
  { t: 'action', label: '本部へ向かう' },

  // D01-S003 本部とMONBAN
  { t: 'video', motion: 5 },
  { t: 'loop', motion: 6 }, // 「本部に到着しました」は動画の中
  { t: 'action', label: '中に入る' },
  { t: 'bgm', track: 'monban' },
  { t: 'motes', count: 0 },
  { t: 'video', motion: 7 }, // 門の前に黒い煙が湧き、MONBANが現れる
  { t: 'loop', motion: 9 },
  { t: 'cam', move: 'shake' },
  { t: 'caption', text: 'MONBANが現れた' },
  { t: 'cam', move: 'in', focus: '50% 30%' }, // 喋るMONBANに寄る
  { t: 'say', who: 'MONBAN', text: '誰だお前…ここは秘密結社だ…。' },
  { t: 'say', who: 'MONBAN', text: 'この先はORDERしか入れない…帰れ…。' },
  { t: 'cam', move: 'out' },
  { t: 'action', label: '招待状を見せる' },
  { t: 'video', motion: 10 }, // 招待状が、MONBANの両手の上に光りながら浮かぶ
  { t: 'cam', move: 'in', focus: '50% 30%' },
  { t: 'say', who: 'MONBAN', text: 'なるほど…。\n{inviter}から…招待されたのか…。' },
  { t: 'say', who: 'MONBAN', text: '門をくぐり、地球の神殿に行け…。' },
  { t: 'video', motion: 11 }, // 門が開く
  { t: 'action', label: '門をくぐり、地球の神殿に向かう' },

  // D01-S006 OBOLON
  { t: 'video', motion: 12 },
  { t: 'bgm', track: 'obolon' },
  { t: 'loop', motion: 13 },
  { t: 'caption', text: 'OBOLONが現れた' },
  { t: 'say', who: 'OBOLON', text: '俺の名前はOBOLON、双子座だ。' },
  { t: 'say', who: 'OBOLON', text: 'お前の名前は？' },
  { t: 'name', placeholder: '名前', submit: '名乗る' },
  { t: 'say', who: 'OBOLON', text: '{name}か、いいな。' },
  { t: 'say', who: 'OBOLON', text: 'ここは、宇宙秘密結社だ。' },
  { t: 'say', who: 'OBOLON', text: '{name}、\nお前は、宇宙に、行ってみたいと思うか？' },
  { t: 'choice', key: 'choice1', options: [{ label: '行きたい' }, { label: '行きたくない' }, { label: 'まだわかんない' }] },
  { t: 'say', who: 'OBOLON', text: 'そうか。' },
  { t: 'say', who: 'OBOLON', text: '実はな、お前は、、、' },
  { t: 'say', who: 'OBOLON', text: '、、、もう宇宙にいる。' },
  { t: 'video', motion: 14 }, // 天井が夜空になる
  { t: 'loop', motion: 15 },
  { t: 'say', who: 'OBOLON', text: 'この星、地球は\n宇宙の中にある。' },
  { t: 'video', motion: 16 },
  { t: 'say', who: 'OBOLON', text: '地球も、俺も、お前も。\n想像しうる全てが\n宇宙、そこで生まれる。' },
  // the lines below are read WHILE motion 17 plays; 19 follows right after (client, 2026-10-04)
  { t: 'bgvideo', motion: 17, then: [19] },
  { t: 'say', who: 'OBOLON', text: '何かの偶然、何かの欲望、何かの閃き、\nいつだって、何かによって、何かが生まれる。' },
  { t: 'say', who: 'OBOLON', text: '“OBOLO ORDER”\nそれは、新しい何かを、生み出す者達' },
  { t: 'say', who: 'OBOLON', text: '楽しむ心があれば\n曲、映像、物語、服、食べ物。' },
  { t: 'say', who: 'OBOLON', text: '万物が、創れる。' },
  { t: 'say', who: 'OBOLON', text: 'いや、創るだけじゃない。届ける。' },
  { t: 'say', who: 'OBOLON', text: '……伝わりにくいか…。' },
  { t: 'say', who: 'OBOLON', text: 'わかりやすく、言う。' },
  { t: 'say', who: 'OBOLON', text: 'OBOLOとは、、、、' },
  // 暗転 → MONBAN steps in front of OBOLON
  { t: 'bgm', track: 'monban' },
  { t: 'black' },
  { t: 'say', who: 'MONBAN', text: 'おい、そこまでだ。' },
  { t: 'video', motion: 27 },
  { t: 'loop', motion: 28 },

  // D01-S012 8つの謎の札、手紙とマナジェム
  { t: 'label', id: 'riddles' },
  { t: 'say', who: 'MONBAN', text: 'この秘密結社には…謎が、8個ある…。' },
  { t: 'say', who: 'MONBAN', text: '宇宙へ行き…解き明かしてこい…。' },
  { t: 'say', who: 'MONBAN', text: 'そして…コスモスを見つけよ…。宝は、そこにある…。' },
  { t: 'riddles' }, // 8枚の札 → 1・7・8に字 → 謎の書
  { t: 'se', sound: 'chime' },
  { t: 'caption', text: '謎の書を手に入れた' },
  { t: 'notice', text: '謎の書は、いつでも開けます。\n残りの札は旅の中で文字が浮かび、答えは旅を進めると読めるようになります' },
  { t: 'say', who: 'OBOLON', text: '{name}。もし、宇宙に興味があるなら、、、' },
  { t: 'say', who: 'OBOLON', text: '明日、宇宙行きの切符を送る。' },
  { t: 'say', who: 'MONBAN', text: 'それにもしORDERになるなら…金もかかる。' },
  { t: 'say', who: 'MONBAN', text: '決めるのは…旅を見てからで、いい…。' },
  { t: 'say', who: 'MONBAN', text: '、、、そうだ。' },
  { t: 'say', who: 'MONBAN', text: '{inviter}から手紙を預かっている。受け取れ。' },
  { t: 'video', motion: 29 },
  { t: 'letter', text: '{name}へ\n宇宙で待ってる✌️ウヒョヒョ\nby {inviter}' },
  { t: 'say', who: 'MONBAN', text: '手紙と…いっしょに、これも…。' },
  { t: 'still', image: 's/gem' },
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: 'マナジェムを手に入れた' },
  { t: 'say', who: 'MONBAN', text: 'マナジェムだ…。\n{inviter}が、お前に宛てて、用意した…。' },
  { t: 'say', who: 'MONBAN', text: '使い方は…そのうち、わかる…。' },
  { t: 'loop', motion: 28 },
  { t: 'say', who: 'MONBAN', text: 'じゃあ、また明日会おう…。' },
  { t: 'end' },
];
