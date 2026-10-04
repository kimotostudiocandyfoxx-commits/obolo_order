import type { Step } from './script';

/**
 * DAY 1 — from opening the invitation link to MONBAN's "また明日会おう".
 * Text is the client's script (2026-10-04) verbatim. All motions used here have been delivered
 * (motion 19 was added after the script, directly after 17).
 *
 * Interpretations (PLACEHOLDER P-OB-2, confirm with the client):
 *  - "→門開（モーション11）" plays automatically after MONBAN's line (no button).
 *  - The script does not say what "やめておく" leads to: OBOLON says "そうか。" and the story jumps to
 *    MONBAN's ending (without "おい！待て！" / "喋りすぎた").
 *  - Motion 8, 18 and 20–26 are not referenced by the script.
 *  - The invitation card (motion 4) has the inviter name baked into the video ("KIMORIN").
 */
export const DAY1: Step[] = [
  // BGM sections (PLACEHOLDER P-OB-8 — the file titles that name each section were lost in upload;
  // this split is inferred from the remaining "VIDEO11" / "OBOLO" in the names — confirm with client):
  //   bgm-video11: start → motion 11 · bgm-obolo: after motion 11 → "OBOLOとは" · bgm-3: MONBAN → end
  { t: 'bgm', track: 'video11' },
  { t: 'video', motion: 1 }, // 招待信号を受信しました
  { t: 'loop', motion: 2 },
  { t: 'action', label: '封を開く' },

  { t: 'video', motion: 3 }, // 本部招待状を開く
  { t: 'loop', motion: 4 }, // あなたは、この扉を開くための招待を受けています… (text is in the video)
  { t: 'action', label: '本部へ向かう' },

  { t: 'video', motion: 5 },
  { t: 'loop', motion: 6 }, // 「本部に到着しました」is in the video itself
  { t: 'action', label: '中に入る' },

  { t: 'video', motion: 7 },
  { t: 'caption', text: 'MONBANが現れた' },
  { t: 'loop', motion: 9 },
  { t: 'say', who: 'MONBAN', text: '誰だお前…ここは秘密結社だ…。' },
  { t: 'say', who: 'MONBAN', text: 'この先はORDERしか入れない…帰れ…。' },
  { t: 'action', label: '招待状を見せる' },

  { t: 'video', motion: 10 },
  { t: 'say', who: 'MONBAN', text: 'なるほど…。\n{inviter}から…招待されたのか…。' },
  { t: 'video', motion: 11 }, // 門開
  { t: 'bgm', track: 'obolo' },
  { t: 'say', who: 'MONBAN', text: '門を潜り、地球の神殿に行け…。' },
  { t: 'action', label: '門を潜り、地球の神殿に向かう' },

  { t: 'video', motion: 12 },
  { t: 'caption', text: '地球の神殿に到着した' },
  { t: 'video', motion: 13 },
  { t: 'caption', text: 'OBOLONが現れた' },
  { t: 'say', who: 'OBOLON', text: '俺の名前はOBOLON、双子座だ。' },
  { t: 'say', who: 'OBOLON', text: 'お前の名前は？' },
  { t: 'name', placeholder: '名前を記入', submit: '名乗る' },
  { t: 'say', who: 'OBOLON', text: '{name}か、いいな。' },
  { t: 'say', who: 'OBOLON', text: '{name}、残念だが。' },
  { t: 'say', who: 'OBOLON', text: '今日は、案内人が、いない。' },
  { t: 'say', who: 'OBOLON', text: '明日呼んでおく、明日また来てほしい。' },
  { t: 'say', who: 'OBOLON', text: '、、、、、ただ' },
  { t: 'say', who: 'OBOLON', text: 'せっかく、来てくれた。' },
  { t: 'say', who: 'OBOLON', text: '俺で良ければ、少し話す、どうする？' },
  {
    t: 'choice',
    key: 'listen',
    options: [{ label: '話を聞いてみる' }, { label: 'やめておく', goto: 'decline' }],
  },

  { t: 'say', who: 'OBOLON', text: 'そうか。' },
  { t: 'say', who: 'OBOLON', text: '、、、感じてると思うが\nここは、宇宙と、深く関わっている。' },
  { t: 'say', who: 'OBOLON', text: '{name}、\nお前は、宇宙に、行ってみたいと思うか？' },
  { t: 'choice', key: 'space', options: [{ label: '行きたい' }, { label: '行きたくない' }, { label: 'まだわかんない' }] },
  { t: 'say', who: 'OBOLON', text: 'そうか。' },
  { t: 'say', who: 'OBOLON', text: '実はな、お前は、、、' },
  { t: 'say', who: 'OBOLON', text: '、、、もう宇宙にいる。' },

  { t: 'video', motion: 14 },
  { t: 'loop', motion: 15 },
  { t: 'say', who: 'OBOLON', text: 'この星、地球は\n宇宙の中にある。' },
  { t: 'say', who: 'OBOLON', text: '地球にいる、ということは\n宇宙の中にいる、ということ。' },

  { t: 'video', motion: 16 },
  { t: 'say', who: 'OBOLON', text: '地球も、俺も、お前も。\n想像しうる全てが\n宇宙、そこで生まれる。' },

  // Client (2026-10-04): the lines below are read WHILE motion 17 plays; 19 follows right after 17.
  { t: 'bgvideo', motion: 17, then: [19] },
  { t: 'say', who: 'OBOLON', text: '何かの偶然、何かの欲望、何かの閃き、\nいつだって、何かによって、何かが生まれる。' },
  { t: 'say', who: 'OBOLON', text: '“OBOLO ORDER”\nそれは、新しい何かを、生み出す者達' },
  { t: 'say', who: 'OBOLON', text: '楽しむ心があれば\n曲、映像、物語、服、食べ物。' },
  { t: 'say', who: 'OBOLON', text: '万物が、創れる。' },
  { t: 'say', who: 'OBOLON', text: '想像した物を、創造する。' },
  { t: 'say', who: 'OBOLON', text: 'いや、創るだけじゃない。届ける。' },
  { t: 'say', who: 'OBOLON', text: '……伝わりにくいか….。' },
  { t: 'say', who: 'OBOLON', text: 'そうだな。' },
  { t: 'say', who: 'OBOLON', text: 'わかりやすく、言う。' },
  { t: 'say', who: 'OBOLON', text: 'OBOLOとは、、、、' },

  { t: 'bgm', track: '3' },
  { t: 'video', motion: 27 },
  { t: 'say', who: 'MONBAN', text: 'おい！待て！' },
  { t: 'loop', motion: 28 },
  { t: 'say', who: 'MONBAN', text: 'OBOLON、それは…喋りすぎた。' },
  { t: 'goto', id: 'ending' },

  { t: 'label', id: 'decline' },
  { t: 'say', who: 'OBOLON', text: 'そうか。' },
  { t: 'bgm', track: '3' },
  { t: 'video', motion: 27 },
  { t: 'loop', motion: 28 },

  { t: 'label', id: 'ending' },
  { t: 'say', who: 'MONBAN', text: '今日教えれることは…これ以上ない。' },
  { t: 'say', who: 'MONBAN', text: 'ここから先は…\n案内人のKIMORINが話す。' },
  { t: 'say', who: 'MONBAN', text: 'それにもしORDERに入るなら…金もかかる。' },
  { t: 'say', who: 'MONBAN', text: 'KIMORINの話を聞いて決めた方がいい。' },
  { t: 'say', who: 'MONBAN', text: '、、、そうだ。' },
  { t: 'say', who: 'MONBAN', text: '{inviter}から手紙を預かっている。受け取れ。' },
  { t: 'video', motion: 29 },
  { t: 'letter', text: '{name}へ\n宇宙で待ってる✌️ウヒョヒョ\nby {inviter}' },
  { t: 'say', who: 'MONBAN', text: '今日見たことはSNSなどに書くな。じゃあ、また明日会おう' },
  { t: 'end' },
];
