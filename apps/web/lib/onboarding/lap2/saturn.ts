import type { Step } from '../script';
import { chapterEnd, flight } from './common';

/**
 * L2 chapter 1 【土星】 — review/L2_地球_月_土星.md (L2-SATURN-S001, S004, S010).
 * The siblings welcome the Obolo Order: outside, words fly like stones; here a quiet invitation spreads.
 * KIMORIN smells a pyramid scheme (it is the other way round: the one who invites buys the gem, ¥88).
 * 〔✉ 招待状〕 / 〔🔍 名前で探す〕 (18+), then the sister's ひろば and KIMORIN's accidental 「問いかけの広場」;
 * the visitor may make their own (only me at first).
 */
export const L2_SATURN: Step[] = [
  ...flight('土星に着いた'),
  { t: 'bgm', track: 'saturn' },
  { t: 'still', image: 's/saturn-inside' }, // 赤茶の石の円い段々。輪の下に、コロリンが、ころころ
  { t: 'sprite', image: ['takoyaki-brother', 'takoyaki-sister'] },
  { t: 'say', who: 'たこ焼きブラザー', text: 'おかえりだZE!!' },
  { t: 'say', who: 'たこ焼きシスター', text: 'おかえり。Obolo Orderになったのね。' },
  // 映像（約8秒）：文字だけの言葉が石のように飛びかう嵐→コロリンが転がりこみ、声で石が光の粒にほどける — a still for now (videos come last)
  { t: 'still', image: 's/saturn-sky' },
  { t: 'say', who: 'たこ焼きシスター', text: '外では、文字だけの言葉が、石みたいに飛びかってるの。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '声に出せば、伝わりかたが、ぜんぜん違うZE。' },
  { t: 'say', who: 'たこ焼きシスター', text: 'ここは、静かな招待だけで、広がるワ。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '今日からは、{neo}が、招く側だZE。' },

  // L2-SATURN-S004 招待状と、シスターの広場
  { t: 'still', image: 's/saturn-inside' },
  { t: 'sprite', image: ['kimorin-sun', 'takoyaki-sister'] },
  { t: 'say', who: 'KIMORIN', text: 'と言っても、{neo}しか、Obolo Orderの知り合い、いませんから、、、招待など、可能なのですか？' },
  { t: 'say', who: 'たこ焼きシスター', text: '招待したかったら、してもいいのよ。' },
  { t: 'say', who: 'KIMORIN', text: 'はい、来ました。招待マルチ、確定。おつ。' },
  { t: 'say', who: 'KIMORIN', text: '化けの皮が、剥がれましたね。' },
  { t: 'say', who: 'KIMORIN', text: '誘えば誘うほど、安くなる。そんなんなんでしょ？' },
  { t: 'sprite', image: ['kimorin-sun', 'takoyaki-brother'] },
  { t: 'say', who: 'たこ焼きブラザー', text: '逆だZE。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '招待された人は、まだ、自分で、マナを作れないZE。だから、マナジェムを買って、送ってあげるんだZE。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '88円だZE。' },
  { t: 'say', who: 'KIMORIN', text: 'なんて、不合理な仕組み。' },
  { t: 'say', who: 'KIMORIN', text: '人を招待するのに、なんで、招待する人が、お金を払わないといけないんだ。' },
  { t: 'say', who: 'KIMORIN', text: 'バカバカしい。招待する、バカは、いません。' },
  { t: 'l2', what: 'dachi-rules' },
  { t: 'say', who: 'KIMORIN', text: '……念のため、お伺いしますが。招待状は、どこから、書くのですか。' },
  { t: 'say', who: 'KIMORIN', text: 'いえ、送りませんよ。書き方を、知っておくだけです。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '〔✉ 招待状〕からだZE。' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'invite' },
  { t: 'still', image: 's/saturn-sky' }, // 輪の上に、垣根のある小さな広場。札『入れる人：わたしだけ』
  { t: 'sprite', image: ['kimorin-sun', 'takoyaki-sister'] },
  { t: 'say', who: 'たこ焼きシスター', text: 'ここは、今日のわたしだけの広場。' },
  { t: 'say', who: 'たこ焼きシスター', text: '話したいことから、君の広場も作れるワ。' },
  { t: 'say', who: 'たこ焼きシスター', text: '作り方は、三つだけ。一つ、〔＋ ひろばをつくる〕を押す。二つ、どんな話をする場所かを、言う。三つ、〔ひろばのしるし〕と入れる人を選んで、〔このひろばをつくる〕、だワ。' },
  { t: 'say', who: 'KIMORIN', text: '三つなら、私にも、できます。' },
  { t: 'say', who: 'KIMORIN', text: '……これは、どこに向かって、話せばいいのですか？' },
  { t: 'notice', text: 'どんな話をする場所？『……これは、どこに向かって、話せばいいのですか？』（言ったことが、そのまま広場の看板の名前になります）' },
  { t: 'se', sound: 'pop' }, // シスターの垣根の隣に、ござ一枚の広場。看板に、さっきの問いが、そのまま
  { t: 'wait', s: 1 },
  { t: 'say', who: 'KIMORIN', text: '……問いかけの広場です。哲学ですので、わざとです。' },
  { t: 'say', who: 'たこ焼きシスター', text: '名前は、あとから変えられるワ。' },
  { t: 'say', who: 'KIMORIN', text: '変えません。' },
  { t: 'say', who: 'たこ焼きシスター', text: 'どんな話をする場所にしたい？　声で、言ってみて。' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'plaza' },

  // L2-SATURN-S010 木星が開いた
  { t: 'sprite', image: ['takoyaki-brother', 'takoyaki-sister'] },
  { t: 'say', who: 'たこ焼きシスター', text: '招待状も、広場も、急がなくていいワ。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '次は、木星だZE!!' },
  { t: 'caption', text: '木星が開いた' },
  { t: 'notice', text: '〔✉ 招待状〕〔🔍 名前で探す〕（18歳以上）と、自分の広場は、このあとも土星で自由に使えます。増えたダチを、ダチのまま〔推し〕からだけ外すこともできます（相手には知らせません）' },
  { t: 'sprite', image: null },
  ...chapterEnd(1),
];
