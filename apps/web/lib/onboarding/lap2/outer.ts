import type { Step } from '../script';
import { chapterEnd, flight } from './common';

/**
 * L2 chapter 6 【天王星】 — wip/P09/c01 (L2-URANUS-S001〜S005, story M-R158): the planet of stories, turning like the
 * pages of a book. 〔✒️ 書く〕 a short story with {bati} (spell cards, mana asked first) → 絵本にする → my図書館 from
 * the part cards → the {neo} owl carries the book to the dachi. KIMORIN's autobiography 『天才の一生』 is three lines.
 */
export const L2_URANUS: Step[] = [
  ...flight('天王星に着いた'),
  // 映像（豪華・約12秒）：横倒しの星が、雲を本のページのようにめくりながら回る→雲の上の野原、紙の道、小さな図書館 — a still for now
  { t: 'bgm', track: 'city' },
  { t: 'still', image: 's/uranus-field' },
  { t: 'sprite', image: 'takoyaki-brother' }, // バイカに乗って、{neo}の前に止まりながら
  { t: 'say', who: 'たこ焼きブラザー', text: 'よく来たZE、{neo}。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '地図で、扉だけ見えてた星だZE。Obolo Orderになった者だけが、入れるZE。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '天王星は、物語の星だZE。星ごと、本のページをめくるみたいに回ってるZE。ここは、俺が受け持ってるZE。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '今日から、お話を書いて、絵本にして、自分の図書館の本棚に並べられるZE。' },
  { t: 'notice', text: '天王星｜下に〔🦉 本の空〕〔✒️ 書く〕〔📚 my図書館〕。行きたい場所をタップすると、バイカでそこまで走ります。どこへでも、自由に行けます' },

  // L2-URANUS-S002 お話を書く — 野原のまん中に、大きな本の形の台。開いたページの上に、羽ペンが一本
  { t: 'say', who: 'たこ焼きブラザー', text: 'お話は、{bati}と話して書くZE。' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'novel' },
  { t: 'branch', key: 'novel', cases: { none: 'unone' }, otherwise: 'uwrote' },
  { t: 'label', id: 'unone' },
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '書かない日も、あっていいZE。ページは、逃げないZE。' },
  { t: 'goto', id: 'ulib' },
  { t: 'label', id: 'uwrote' },
  { t: 'notice', text: 'お話を、{neo}だけの〔🔒 机の引き出し〕にしまいました。誰にも送られていません' },
  // となりの台で、KIMORINが、Bluenaに長いこと吹きこんでいる。身ぶり手ぶりも、ついている
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……では、私も、一冊。自伝です。題は『天才の一生』。' },
  { t: 'l2', what: 'kimorin-life' }, // ページに字が浮かぶ。三行で、止まる
  { t: 'say', who: 'KIMORIN', text: '……三行やん。なんやこれ。' }, // サングラスが、鼻先までずり落ちる
  { t: 'say', who: 'KIMORIN', text: '……失礼。要点だけに、なりましたね。' }, // こほん。サングラスを、指でかけ直す
  { t: 'sprite', image: ['takoyaki-brother', 'kimorin-sun'] },
  { t: 'say', who: 'たこ焼きブラザー', text: '三行でも、一冊は、一冊だZE。' },

  // L2-URANUS-S003 絵本にする — お話のページが、ひとりでにめくれる
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '次は、絵本だZE。お話をページに分けて、ページごとに絵をつけるZE。' },
  { t: 'sprite', image: null },
  { t: 'choice', key: 'picturebook', options: [{ label: '絵本にする', goto: 'upb' }, { label: '今は、お話のままにする', goto: 'utext' }] },
  { t: 'label', id: 'utext' },
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '絵は、いつでもつけられるZE。' },
  { t: 'goto', id: 'usong' },
  { t: 'label', id: 'upb' },
  { t: 'l2', what: 'picturebook' },
  { t: 'branch', key: 'picturebook', cases: { make: 'upbdone' }, otherwise: 'usong' },
  { t: 'label', id: 'upbdone' },
  { t: 'caption', text: '絵本ができた' },
  { t: 'notice', text: '絵本を、{neo}だけの〔🔒 机の引き出し〕にしまいました。誰にも送られていません' },
  { t: 'label', id: 'usong' },
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'お話に主題歌がほしくなったら、水星で作れるZE。' },

  // L2-URANUS-S004 my図書館と、ダチの空へ — 野原のはしに、何もない一区画。{neo}の名前の札
  { t: 'label', id: 'ulib' },
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '書いた本を並べる場所だZE。図書館は、自分で建てるZE。' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'library' },
  { t: 'branch', key: 'library', cases: { hold: 'uhold' }, otherwise: 'ubuilt' },
  { t: 'label', id: 'uhold' },
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '土地は、待ってるZE。' },
  { t: 'goto', id: 'uend' },
  { t: 'label', id: 'ubuilt' },
  { t: 'caption', text: 'my図書館ができた' },
  { t: 'branch', key: 'has_book', cases: { yes: 'usend' }, otherwise: 'uempty' },
  { t: 'label', id: 'uempty' },
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '棚は、書いた分だけ、埋まるZE。' },
  { t: 'goto', id: 'ukowl' },
  { t: 'label', id: 'usend' },
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '次は、届けるZE。' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'owl-send' },
  { t: 'branch', key: 'sent_book', cases: { keep: 'ukeep' }, otherwise: 'ukowl' },
  { t: 'label', id: 'ukeep' },
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '届けるのは、いつでもいいZE。' },
  { t: 'notice', text: '〔🦉 届ける〕は、棚の本から、いつでも押せます' },
  { t: 'label', id: 'ukowl' },
  { t: 'sprite', image: null },
  { t: 'notice', text: '上の〔推し〕に、ダチのフクロウが本を抱えて飛んできます。タップすると本が開きます' },
  { t: 'l2', what: 'kimorin-owl' }, // 丸いサングラスをかけた、小さなKIMORINの顔のフクロウ。『天才の一生』。三行
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……軽いので、すぐに着きました。' },

  // L2-URANUS-S005 海王星が開いた
  { t: 'label', id: 'uend' },
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '次は、海王星だZE。' },
  { t: 'caption', text: '海王星が開いた' },
  { t: 'notice', text: '天王星でお話を書く・絵本にする、my図書館を飾る・本を届けることは、このあとも自由にできます' },
  { t: 'sprite', image: null },
  ...chapterEnd(6),
];

/**
 * L2 chapter 7 【海王星】 — wip/P09/c02 (L2-NEPTUNE-S001〜S003, M-R160〜M-R164): the city at the bottom of the sea, the
 * order's game centre. Only the conch-shell hall is lit: the trial of 『ナガレを越えて』 (Saturn and Jupiter stages,
 * little {neo} as the hero). No score, no ranking, no counts; only クリア. KIMORIN sees his small self waving a flag
 * (「…………オレや。」).
 */
export const L2_NEPTUNE: Step[] = [
  ...flight('海王星に着いた'),
  // 映像（豪華・約12秒）：白い嵐の渦→潜水艇が海に沈む→ネオンの貝・巻き貝・さんごの都 — a still for now
  { t: 'bgm', track: 'tender' },
  { t: 'still', image: 's/neptune-islands' },
  { t: 'notice', text: '潜水艇の中の札『ようこそ、Obolo Order。ここは、扉の奥の星。深海の都。建物の一つ一つが、遊びの館。何度でも、潜りに来ていい。』' },
  { t: 'notice', text: '海王星｜深海の都。灯りの入った建物に、潜水艇を寄せると入れます。遊ぶのに、マナは使いません。点数の順位や、人と比べる数は出ません。灯りの入る建物は、これから少しずつ増えます' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……海の底に、遊ぶためだけの都、ですか。' },
  { t: 'say', who: 'KIMORIN', text: '……結社にも、こういう所が、あるのですね。' }, // サングラスを、指で押し上げる

  // L2-NEPTUNE-S002 『ナガレを越えて』体験版 — 巻き貝の館。いちばん奥の丸い部屋の壁いっぱいに、すごろくの地図
  { t: 'sprite', image: null },
  { t: 'choice', key: 'neptune_play', options: [{ label: '遊んでみる', goto: 'ntrial' }, { label: '今は、館の中を見るだけ', goto: 'nnone' }] },
  { t: 'label', id: 'nnone' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……では、また今度。館は、逃げませんね。' },
  { t: 'goto', id: 'nend' },
  { t: 'label', id: 'ntrial' },
  { t: 'l2', what: 'game' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '…………オレや。' },
  { t: 'say', who: 'KIMORIN', text: '……失礼。私の小さい方も、旗を、振っていましたね。' }, // 咳ばらい
  { t: 'sprite', image: null },
  { t: 'choice', key: 'neptune_again', options: [{ label: 'もう一回', goto: 'ntrial' }, { label: '館を出る', goto: 'nout' }] },
  { t: 'label', id: 'nout' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'ほかの館にも、これから灯りが入るそうですよ。……楽しみですね。' },

  // L2-NEPTUNE-S003 地球に帰る
  { t: 'label', id: 'nend' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '次は、地球ですね。' },
  { t: 'notice', text: '深海の都の『ナガレを越えて』の館の体験版は、このあとも自由に遊べます。灯りの入る館は、これから増えます' },
  { t: 'sprite', image: null },
  ...chapterEnd(7),
];

/**
 * L2 chapter 8 【地球に帰る】 — L2-RETURN-S005: MONBAN lays a card for each planet (only what was made; the
 * rest is the planet's little picture), the route on the map, and the 「星めぐりの証」 — not a title (still
 * Obolo Order; KIMORIN hoped for 『封印されし巡礼者』).
 */
export const L2_HOME: Step[] = [
  { t: 'bgm', track: 'space' },
  { t: 'se', sound: 'rocket' },
  { t: 'still', image: 's/rocket-earth' },
  { t: 'caption', text: '地球に帰る' },
  { t: 'bgm', track: 'morning' },
  { t: 'still', image: 's/earth-hall' }, // 本部の広間。大きな掲示板に、住人たちのおかえりの紙
  { t: 'caption', text: '地球に帰ってきた' },
  { t: 'sprite', image: 'monban' },
  { t: 'l2', what: 'round-cards' }, // 月〈姿〉／土星〈広場〉／木星〈ジャケット〉／水星〈曲〉／火星〈映像〉／金星〈一曲〉／天王星〈グッズ〉／海王星〈ゲーム〉
  { t: 'sprite', image: ['monban', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '結社の星を、ひと巡りできましたね。' },
  { t: 'branch', key: 'cards_many', cases: { yes: 'hmany' }, otherwise: 'hfew' },
  { t: 'label', id: 'hmany' },
  { t: 'say', who: 'KIMORIN', text: '自分の場所が育って、絵がグッズになって、\n遊べる世界にも会えましたね。' },
  { t: 'goto', id: 'hjoin' },
  { t: 'label', id: 'hfew' },
  { t: 'say', who: 'KIMORIN', text: 'いろんな星の、いろんな人に、会えましたね。' },
  { t: 'label', id: 'hjoin' },
  { t: 'say', who: 'MONBAN', text: 'よく回ってきたな、Obolo Order…。' },
  { t: 'say', who: 'MONBAN', text: '門は、開いた…。\nいつでも、戻ってこい…。' },
  { t: 'l2', what: 'route' }, // 地図：地球→月→土星→木星→水星→火星→金星→天王星→海王星→地球の光
  { t: 'se', sound: 'paper' }, // 小さな紙に日付を書き入れて、渡す
  { t: 'say', who: 'MONBAN', text: 'これは、星めぐりの証だ…。\n称号は、Obolo Orderのままだ…。' },
  { t: 'notice', text: '星めぐりの証を受け取りました。旅の記録に、日付とともに保存しました。証は、称号や順位ではありません。称号は、Obolo Orderのままです' },
  { t: 'say', who: 'KIMORIN', text: '……称号は、増えないのですか？　『封印されし巡礼者』ですとか……' },
  { t: 'say', who: 'MONBAN', text: '……Obolo Orderのままだ…。' },
  { t: 'say', who: 'KIMORIN', text: '……二回、おっしゃいましたね。' },
  { t: 'say', who: 'MONBAN', text: '……称号は、集めるものでは、ない…。' },
  { t: 'sprite', image: null },
  ...chapterEnd(8, [{ t: 'sprite', image: 'monban' }, { t: 'say', who: 'MONBAN', text: '……証は、渡した…。' }]),
];

/** L2 chapter 9 【その夜】 — L2-RETURN-S006: the order's purpose (riddle 3). */
export const L2_NIGHT: Step[] = [
  { t: 'bgm', track: 'night' },
  { t: 'still', image: 's/earth-hall' },
  { t: 'caption', text: 'その夜' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] }, // 人のいない広間。光の柱の中に、OBOLONの黒い球
  { t: 'say', who: 'OBOLON', text: '、、、結社の、目的だが、、、' },
  { t: 'say', who: 'KIMORIN', text: '木星で言いかけましたが。……お金を集める組織、でしょう？' },
  { t: 'wait', s: 1.2 },
  { t: 'say', who: 'KIMORIN', text: '……違うようですね。では、宇宙平和。銀河の、暗黒の、平和。' },
  { t: 'sprite', image: ['obolon', 'unchi-pinpon', 'kimorin-sun'] },
  { t: 'say', who: 'うんちピンポンくん', text: 'ピンポンピンポン♪' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '、、、違う。' },
  { t: 'say', who: 'OBOLON', text: '平和は、、、大事だ。だが、、、ゴールでは、ない。' },
  { t: 'say', who: 'OBOLON', text: '争いが、なくても、、、毎日が、つまらなかったら。' },
  { t: 'say', who: 'OBOLON', text: '心も、体も、、、ずっと、疲れていたら。' },
  { t: 'say', who: 'OBOLON', text: '、、、それは、ゴールか？' },
  { t: 'say', who: 'KIMORIN', text: '……違います、ね。' },
  { t: 'say', who: 'OBOLON', text: '結社の目的は、、、一人ひとりが、心も、体も、健やかに。楽しく、、、生きることだ。', hold: true },
  { t: 'say', who: 'KIMORIN', text: '……楽しくない日は？' },
  { t: 'say', who: 'OBOLON', text: '、、、ある。それも、込みだ。' },
  { t: 'se', sound: 'riddle' },
  { t: 'seal', n: 3, open: true }, // 謎の書：札3「結社の目的とは」の続きに「一人ひとりが、心も体も健やかに、楽しく生きること」
  { t: 'caption', text: '謎3が開いた' },
  { t: 'say', who: 'KIMORIN', text: '……では、仲間をたくさん増やさないといけない、などは？' },
  { t: 'say', who: 'OBOLON', text: '、、、ない。増やすのも、増やさないのも、自由だ。' },
  { t: 'say', who: 'KIMORIN', text: '……ほっとしました。' },
  { t: 'sprite', image: null },
  ...chapterEnd(9, [{ t: 'sprite', image: 'obolon' }, { t: 'say', who: 'OBOLON', text: '、、、夜だな。' }]),
];

/**
 * L2 chapter 10 【次の朝】 — L2-RETURN-S008 / S010: the comms room opens (mail / calls with dachi only, both
 * sides' permission; story companions have no lamps), the invitation and 〔名前で探す〕 desk, KIMORIN's
 * endless letter; then OBOLON: 「何を、作りたい？」 — free to roam the stars.
 */
export const L2_ROOM: Step[] = [
  { t: 'bgm', track: 'morning' },
  { t: 'still', image: 's/earth-comms' },
  { t: 'caption', text: '次の朝' },
  { t: 'sprite', image: 'monban' }, // 一周目からずっと閉まっていた鉄の扉。MONBANが鍵を回す
  { t: 'se', sound: 'knock' },
  { t: 'say', who: 'MONBAN', text: '地球の連絡室も、開こう…。\n許可した仲間と、メールや電話ができる…。' },
  { t: 'caption', text: '連絡室がひらいた' },
  { t: 'l2', what: 'switchboard' }, // 壁一面の古い交換台。まん中に{neo}の名札。隣に『ダチ　KIMORIN⭐︎』『ダチ　{inviter}』（MIKIE⭐︎）
  { t: 'notice', text: 'Obolo Orderどうしのメール・電話。相手は、ダチだけです。つながるには、相手と自分、両方の連絡の許可が必要です。メールに既読は表示されません' },
  { t: 'notice', text: '名札の自分の側のランプは、〔連絡OK〕で点き、もう一度押すと消えます。消しても、相手には知らせません' },
  { t: 'notice', text: '物語の仲間の名札には、連絡できません' },
  { t: 'sprite', image: ['monban', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'では、試しにMONBANに。' }, // 交換台の端から端まで、『MONBAN』の穴を探す。どこにもない
  { t: 'say', who: 'KIMORIN', text: '……私とMONBANの仲なのに、穴がありません。' },
  { t: 'say', who: 'MONBAN', text: '……ここは…ダチどうしで…両方が許可した時だけ、つながる…。' },
  { t: 'say', who: 'KIMORIN', text: '……片思い、でしたか。' },
  { t: 'notice', text: '電話は、〔📞 電話をかける〕を自分で押して、相手が受けた時だけつながります（使えるようになるまでは、薄い色で『準備中』）。この部屋が開いても、誰かに勝手にかかることはありません' },
  { t: 'say', who: 'MONBAN', text: '招待してくれた者に、旅の話をしてみても、いい…。' },
  { t: 'notice', text: '〔招待状〕と〔名前で探す〕は、二周目の土星で覚えたものと同じです。ここの机からも使えます' },
  { t: 'say', who: 'MONBAN', text: '紹介したい者がいたら、でいい…。\nひとりで作るのも、仲間と遊ぶのも、自由だ…。' },
  { t: 'say', who: 'KIMORIN', text: '……母のほかに、招待する相手は、いませんが。' }, // 『禁断の結社より、選ばれし者へ——』。二枚目、三枚目と続く
  { t: 'say', who: 'MONBAN', text: '……一行でも、届く…。' },
  { t: 'say', who: 'KIMORIN', text: '……では、下書きということで。' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'comms' },
  { t: 'branch', key: 'comms', cases: { none: 'rnone' }, otherwise: 'rnext' },
  { t: 'label', id: 'rnone' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '私も、まだ送っていません。' }, // ローブの胸もとを、ぽんと叩く

  // L2-RETURN-S010 何を、作りたい？
  { t: 'label', id: 'rnext' },
  { t: 'still', image: 's/earth-hall' }, // 朝の広間。光の柱の中に、OBOLONの黒い球
  { t: 'sprite', image: 'obolon' },
  { t: 'say', who: 'OBOLON', text: 'できることは、知った。\n次は、、、お前が、決める。' },
  { t: 'say', who: 'OBOLON', text: '何を、作りたい？', hold: true },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……私は、作りかけのものが、少し。完成したら、お見せします。' },
  { t: 'sprite', image: ['obolon', '@bati'] },
  { t: 'say', who: 'バティ', text: '今すぐ決めなくてもいいよ。……好きな星に、戻ってみる？' },
  { t: 'sprite', image: null },
  { t: 'choice', key: 'free', options: [{ label: '自由に星をめぐる・作る', goto: 'rfree' }, { label: '今日はここまで', goto: 'rstop' }] },
  { t: 'label', id: 'rfree' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'では、また。{neo}。' }, // 扇の尾をふわりと広げて、発射場のほうへ
  { t: 'goto', id: 'rmap' },
  { t: 'label', id: 'rstop' },
  { t: 'sprite', image: 'monban' },
  { t: 'say', who: 'MONBAN', text: '……門は、開いている…。' },
  { t: 'label', id: 'rmap' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'route' }, // 地図の上で、星をつないだ道筋が、一本につながる
  ...chapterEnd(10),
];
