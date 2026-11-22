import type { Step } from './script';

/**
 * SYS-S003 「たまごが、育った」 (M-R218 / M-R224, script P02/c02.md): the morning 88 days after the first {bati} (the
 * 3rd: 176 days), the first time the app is opened — played from the Moon when the egg is ready (components/bati/
 * EggMorning.tsx). `sys3.nth` (story vars) = 2 / 3: the 2nd hatches from a sound, the 3rd from a word. After the
 * 2nd the shell becomes a small egg again; after the 3rd no egg is born any more. Each {bati} keeps its own egg: the
 * moon or the sun egg is chosen here (f_egg), before the seed.
 */
export const SYS003: Step[] = [
  { t: 'scene', id: 'SYS-S003' },
  { t: 'still', image: 's/moon-temple' },
  // 親指くらいだった小さなたまごが、両手で抱えるほどの大きさになって、ゆっくり光っている
  { t: 'fx', fx: 'grown-egg' },
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '、、、{neo}。たまごが、育った。' },
  { t: 'sprite', image: '@bati' }, // {bati}が、たまごのまわりを、ころころ回る
  { t: 'say', who: 'バティ', text: 'うわぁ！　ボクの、きょうだいだ！' },
  { t: 'sprite', image: 'obolon' },
  // the egg can still be the moon's or the sun's: the two lights take turns on it; the egg picture is tapped (f_egg)
  { t: 'say', who: 'OBOLON', text: '、、、このたまごは、まだ、月にも、太陽にも、なれる。どちらにする？' },
  { t: 'fx', fx: 'grown-egg-choose' },
  { t: 'sprite', image: null },
  // PROVISIONAL (P-BATI-EGGS): the moon egg's picture is the old earth-and-moon egg's
  { t: 'choice', key: 'egg', pics: ['/onboarding/egg-pick-earth.webp', '/onboarding/egg-pick-sun.webp'], options: [{ label: '月のたまご', goto: 'sys3-moon' }, { label: '太陽のたまご', goto: 'sys3-sun' }] },
  { t: 'label', id: 'sys3-moon' },
  { t: 'set', key: 'f_egg', value: 'moon' },
  { t: 'fx', fx: 'grown-egg-moon' }, // 選んだ方の光が、たまごに、すっと染みこむ
  { t: 'goto', id: 'sys3-chosen' },
  { t: 'label', id: 'sys3-sun' },
  { t: 'set', key: 'f_egg', value: 'sun' },
  { t: 'fx', fx: 'grown-egg-sun' },
  { t: 'label', id: 'sys3-chosen' },
  { t: 'se', sound: 'sparkle' },
  { t: 'sprite', image: 'obolon' },
  { t: 'branch', key: 'sys3.nth', cases: { '3': 'sys3-word' }, otherwise: 'sys3-sound' },
  { t: 'label', id: 'sys3-sound' },
  { t: 'say', who: 'OBOLON', text: '、、、このたまごは、音で、かえる。' },
  { t: 'say', who: 'OBOLON', text: '、、、好きな音は、何だ？' },
  { t: 'newbati', kind: 'sound' },
  { t: 'goto', id: 'sys3-born' },
  { t: 'label', id: 'sys3-word' },
  { t: 'say', who: 'OBOLON', text: '、、、このたまごは、言葉で、かえる。' },
  { t: 'say', who: 'OBOLON', text: '、、、大事にしている言葉を、一つ、言ってみろ。' },
  { t: 'newbati', kind: 'word' },
  { t: 'label', id: 'sys3-born' },
  { t: 'fx', fx: null },
  { t: 'sprite', image: '@bati' },
  // チャットの中に、新しい相方のカードが出る
  { t: 'baticard' },
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '、、、名前を、つけてやれ。' },
  { t: 'batiname', placeholder: 'バティの名前', submit: 'この名前にする' },
  { t: 'sprite', image: '@bati' },
  { t: 'batirole', greet: '……{neo}！　よろしくね！', ask: 'ボクは、{neo}の、なんの相方になる？' },
  { t: 'se', sound: 'boing' }, // {bati}（1体目）が、新しい相方と、ぴょんぴょん跳ねる
  { t: 'branch', key: 'sys3.nth', cases: { '3': 'sys3-last' }, otherwise: 'sys3-egg' },
  { t: 'label', id: 'sys3-egg' },
  // 割れた殻が、また光って集まり、祭壇の上で、小さなたまごになる
  { t: 'fx', fx: 'shell-egg' },
  { t: 'wait', s: 3 },
  { t: 'fx', fx: null },
  { t: 'goto', id: 'sys3-end' },
  { t: 'label', id: 'sys3-last' },
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '、、、これで、三つ。たまごは、もう、生まれない。' },
  { t: 'label', id: 'sys3-end' },
  { t: 'notice', text: 'チャットの相方は、上の顔を押すと入れかえられます。新しい相方も、最初の相方も、{neo}のことを同じように覚えています' },
  { t: 'end' },
];
