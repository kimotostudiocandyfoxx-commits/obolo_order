import type { Step } from './script';

/**
 * DAY 2 — client's script (2026-10-04). Starts after the [認証] screen (StoryDay).
 * Motions marked "前回同様" reuse Day 1's videos: 本部到着 = 6, MONBAN = 7 (+ loop 9),
 * 門開 = 11, 地球の神殿 = 12, OBOLON = 13.
 *
 * PLACEHOLDER (P-OB-10, confirm with the client):
 *  - "承諾しない" / "話さずに帰る" / "やめておく" have no written outcome: a short line is shown and the
 *    same choice is offered again (the story can only move forward).
 *  - "OBOLON「そう来なくっちゃ」（2モーション9）": the line is shown first, then motion 2-9 plays.
 *    Motion 2-9 was delivered at 480×854 (upload limit) — replace with a full-quality file later.
 *  - The invitation card in motion 2-2 has its own text baked in ("この前、本部にきてくれてありがとう！
 *    今日はゾロ目の日！…"), which differs from the script's "昨日いなかったケン！…".
 *  - The BGM fades out before KIMORIN's motions (2-9, 2-10) so his voice is clear.
 */
export const DAY2: Step[] = [
  { t: 'bgm', track: 'opening' },
  { t: 'video', motion: '2-1' }, // 招待信号を受信しました → 本部招待状を開く
  { t: 'loop', motion: '2-2' },
  { t: 'action', label: '本部へ向かう' },

  { t: 'video', motion: '2-3' },
  { t: 'loop', motion: 6 }, // 本部に到着（前回同様・文字は動画内）
  { t: 'action', label: '中に入る' },

  { t: 'bgm', track: 'monban' },
  { t: 'video', motion: 7 },
  { t: 'caption', text: 'MONBANが現れた' },
  { t: 'loop', motion: 9 },
  { t: 'say', who: 'MONBAN', text: '来たか…入れ。' },
  { t: 'video', motion: 11 }, // 門開（前回同様）
  { t: 'label', id: 'promise' },
  { t: 'say', who: 'MONBAN', text: '本日も一切の他言を禁ず\n承諾できるなら地球の神殿に行け\nあいつが待ってる' },
  {
    t: 'choice',
    key: 'promise',
    options: [{ label: '承諾し、地球の神殿に向かう', goto: 'temple' }, { label: '承諾しない' }],
  },
  { t: 'say', who: 'MONBAN', text: '…承諾できぬなら、ここは通せない。' },
  { t: 'goto', id: 'promise' },

  { t: 'label', id: 'temple' },
  { t: 'video', motion: 12, captions: [{ text: '地球の神殿に到着した', from: 4.5, to: 7 }] },
  { t: 'bgm', track: 'obolon' },
  { t: 'loop', motion: 13 },
  { t: 'caption', text: 'OBOLONが現れた' },
  { t: 'say', who: 'OBOLON', text: '{name}、待ってた。' },
  { t: 'label', id: 'talk' },
  { t: 'say', who: 'OBOLON', text: '今日はKIMORIN、いる、話すか？' },
  { t: 'choice', key: 'talk', options: [{ label: '話す', goto: 'kimorin' }, { label: '話さずに帰る' }] },
  { t: 'say', who: 'OBOLON', text: '…KIMORIN、さみしがる。もう一度、聞く。' },
  { t: 'goto', id: 'talk' },

  { t: 'label', id: 'kimorin' },
  { t: 'say', who: 'OBOLON', text: 'そう来なくっちゃ' },
  { t: 'bgm', track: null }, // KIMORIN speaks in 2-9 and 2-10: music out so his voice is clear
  { t: 'video', motion: '2-9' }, // KIMORIN appears (delivered at 480×854 because of the 30 MB upload limit)
  { t: 'label', id: 'trip' },
  {
    t: 'choice',
    key: 'trip',
    options: [{ label: 'KIMORINと宇宙旅行に行ってみる。', goto: 'go' }, { label: 'やめておく。' }],
  },
  { t: 'caption', text: '……KIMORINが、じっとこちらを見ている。' },
  { t: 'goto', id: 'trip' },

  { t: 'label', id: 'go' },
  { t: 'video', motion: '2-10' }, // KIMORIN
  { t: 'end' },
];
