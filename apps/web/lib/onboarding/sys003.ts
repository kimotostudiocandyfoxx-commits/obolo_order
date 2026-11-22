import type { Step } from './script';

/**
 * SYS-S003 「たまごが、育った」 (M-R218 / M-R224 / M-R230 / M-R231, script P02/c02.md).
 * M-R231: the mornings of the app's day 9 (the 2nd) and day 16 (the 3rd), the first time the app is opened — played
 * from the Moon / before a member's day (components/bati/EggMorning.tsx). `sys3.nth` (story vars) = 2 / 3: the 2nd hatches
 * from a sound (then its role is asked), the 3rd from a wish (「ねがいの子」, M-R230: its role from the words). After the
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
  { t: 'branch', key: 'sys3.nth', cases: { '3': 'sys3-wish' }, otherwise: 'sys3-sound' },
  { t: 'label', id: 'sys3-sound' },
  { t: 'say', who: 'OBOLON', text: '、、、このたまごは、音で、かえる。' },
  { t: 'say', who: 'OBOLON', text: '、、、好きな音は、何だ？' },
  { t: 'newbati', kind: 'sound' },
  { t: 'goto', id: 'sys3-born' },
  // M-R230: the third is 「ねがいの子」 — what kind of partner they want, in their own words
  { t: 'label', id: 'sys3-wish' },
  { t: 'say', who: 'OBOLON', text: '、、、最後のたまごは、、、お前の言葉で、かえる。' },
  { t: 'say', who: 'OBOLON', text: '、、、どんな相方が、ほしい？　言葉で、言ってみろ。' },
  { t: 'notice', text: 'たとえば「仕事を手伝ってくれる、落ち着いた子」「英語の先生みたいな子」「なんでもほめてくれるギャル」。役目・話し方・雰囲気を、自由に言えます' },
  { t: 'newbati', kind: 'wish' },
  { t: 'label', id: 'sys3-born' },
  { t: 'fx', fx: null },
  { t: 'sprite', image: '@bati' },
  // チャットの中に、新しい相方のカードが出る
  { t: 'baticard' },
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: '、、、名前を、つけてやれ。' },
  { t: 'batiname', placeholder: 'バティの名前', submit: 'この名前にする' },
  { t: 'sprite', image: '@bati' },
  // the role is asked of the 2nd only; the 3rd's comes from the wish (its card shows 「ねがいの子」)
  { t: 'branch', key: 'sys3.nth', cases: { '3': 'sys3-greet' }, otherwise: 'sys3-role' },
  { t: 'label', id: 'sys3-role' },
  { t: 'batirole', greet: '……{neo}！　よろしくね！', ask: 'ボクは、{neo}の、なんの相方になる？' },
  { t: 'goto', id: 'sys3-hop' },
  { t: 'label', id: 'sys3-greet' },
  { t: 'batirole', greet: '……{neo}！　よろしくね！' },
  { t: 'label', id: 'sys3-hop' },
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
