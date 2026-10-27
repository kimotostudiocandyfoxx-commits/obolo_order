import type { Step } from '../script';
import { chapterEnd, flight } from './common';

/**
 * L2 chapter 6 【天王星】 — review/L2_天王星.md (L2-URANUS-S001, S003, S004, S005).
 * Above the clouds, white planet ateliers and the obolo shop; the brother rides his three-wheeled バイカ.
 * Goods from your own pictures (a sample only — nothing is ordered), KIMORIN's 「封印されし黒虎竜の聖杯」,
 * the shop (made to order, paid in money apart from the ¥88, never with mana) and KIMORIN's empty shelf.
 */
export const L2_URANUS: Step[] = [
  ...flight('天王星に着いた'),
  // 映像（豪華・約12秒）：横倒しの輪→雲の上の野原、白いプラネットのアトリエ→バイカ→看板『obolo商店』 — a still for now
  { t: 'bgm', track: 'city' },
  { t: 'still', image: 's/uranus-field' },
  { t: 'sprite', image: 'takoyaki-brother' }, // バイカに乗って、プラネットの前に止まりながら
  { t: 'say', who: 'たこ焼きブラザー', text: 'よく来たZE、{neo}。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '地図で、扉だけ見えてた星だZE。Obolo Orderになった者だけが、入れるZE。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '天王星のアトリエは、俺が受け持ってるZE。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '今日から、自分の絵でグッズを作って、自分のアトリエに飾れるZE。' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'それと、まん中のobolo商店を、見て回れるZE。' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'この野原は、いつか、プラネットの並ぶ町になるらしいZE。' },
  { t: 'notice', text: '天王星では、行きたいアトリエやobolo商店をタップすると、バイカでそこまで走ります。どこへでも、自由に行けます' },

  // L2-URANUS-S003 天空のアトリエ
  { t: 'still', image: 's/uranus-press' }, // 輪の根元の浮島。黒い鉄の大きな刷り台に、ハンドルが一本
  { t: 'say', who: 'たこ焼きブラザー', text: '形を選んで、絵をのせて、ハンドルを回す。それだけだZE。' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'goods' },
  { t: 'branch', key: 'goods', cases: { none: 'unone' }, otherwise: 'uvisit' },
  { t: 'label', id: 'unone' },
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '作るのは、いつでもいいZE。' },
  { t: 'label', id: 'uvisit' },
  { t: 'notice', text: '〔ダチのアトリエ〕の札を押すと、ダチのアトリエを訪ねられます（あなたのアトリエを見に来られるのも、ダチだけです）' },
  { t: 'l2', what: 'kimorin-mug' }, // 黒地に虎じまのブラタゴン島のマグ。札：『封印されし黒虎竜の聖杯　——素手で触れるな』
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……そういう設計です。' },

  // L2-URANUS-S004 obolo商店
  { t: 'sprite', image: null },
  { t: 'still', image: 's/uranus-shop' }, // 店番はいない。棚に、住人たちのグッズの見本。『受注生産』の札
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '品物に触ると、札が出るZE。見て回るだけでもいいZE。' },
  { t: 'notice', text: '支払いはお金で、月額88円（毎月のマナの代金）とは別の料金です。売り買いに、マナは使いません。自分のグッズを並べる申請は、三周目の旅から開きます' },
  { t: 'sprite', image: null },
  { t: 'choice', key: 'shop', options: [{ label: '棚の品物に触ってみる', goto: 'ulook' }, { label: '今はいい', goto: 'uskip' }] },
  { t: 'label', id: 'ulook' },
  { t: 'l2', what: 'shop' }, // たこ焼き柄のトートバッグの札。いちばん下に〔購入〕
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '注文すれば、家に届くZE。値段と送料と届け先を見て、欲しかったら注文するZE。' },
  { t: 'goto', id: 'ushelf' },
  { t: 'label', id: 'uskip' },
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '見るのは、いつでもいいZE。' },
  { t: 'label', id: 'ushelf' },
  // いちばん奥の『空き棚』。KIMORINが看板のすみに、白い小旗を一本。サングラスを額に押し上げる。目の切れ目が青く光る
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'caption', text: '何も並んでいない棚。札『空き棚』' },
  { t: 'say', who: 'KIMORIN', text: 'オレもいつか、obolo商店に並べるケン。……黒くて、しましまのやつがいいケン。' },
  { t: 'sprite', image: ['unchi-pinpon', 'kimorin-sun'] },
  { t: 'say', who: 'うんちピンポンくん', text: '……ピンポン♪' },

  // L2-URANUS-S005 海王星が開いた
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '次は、海王星だZE。' },
  { t: 'caption', text: '海王星が開いた' },
  { t: 'notice', text: '天王星でグッズを作る・飾る、アトリエやobolo商店を見て回ることは、このあとも自由にできます' },
  { t: 'sprite', image: null },
  ...chapterEnd(6),
];

/**
 * L2 chapter 7 【海王星】 — review/L2_海王星.md (L2-NEPTUNE-S001〜S003).
 * Islands of games over a deep-blue storm. The order's own game 『キモリンの帰り道』 — KIMORIN finds himself in it
 * (「…………オレや。」). No time limit, score or winning; the road chosen changes the story told to grandpa.
 */
export const L2_NEPTUNE: Step[] = [
  ...flight('海王星に着いた'),
  // 映像（豪華・約12秒）：白い嵐の渦→すごろくの盤・生け垣の迷路・町の模型の浮き島→光の橋 — a still for now
  { t: 'bgm', track: 'tender' },
  { t: 'still', image: 's/neptune-islands' },
  { t: 'caption', text: '『ようこそ、Obolo Order。ここは、扉の奥の星。今日から、結社が用意したゲームで、遊べる。』' },

  // L2-NEPTUNE-S002 結社のゲームで遊ぶ
  { t: 'still', image: 's/neptune-town' }, // 模型の町の島。札：『題　キモリンの帰り道　用意した人　結社』。門の前に、二頭身の人形
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '…………オレや。' }, // サングラスが、鼻先までずり落ちる。目の切れ目が、青く光る
  { t: 'notice', text: '島ごとに、結社が用意したゲームが一つずつ。〔あそぶ〕を押すと始まります。時間の制限・点数・勝ち負けはなく、評価や遊んだ数も出ません' },
  { t: 'sprite', image: null },
  { t: 'choice', key: 'game', options: [{ label: '〔あそぶ〕を押す', goto: 'nplay' }, { label: 'KIMORINが遊ぶのを、となりで見る', goto: 'nwatch' }, { label: '今はいい', goto: 'nskip' }] },
  { t: 'label', id: 'nwatch' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'では、私が、私を動かします。分かれ道は、{neo}が選んでください。' },
  { t: 'sprite', image: null },
  { t: 'label', id: 'nplay' },
  { t: 'l2', what: 'game' }, // 『キモリンの帰り道』：分かれ道（坂・川・たこ焼き屋）→じいちゃんの家
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '選んだ道で、お話の続きが変わりましたね。' },
  { t: 'say', who: 'KIMORIN', text: 'オレの帰り道に、付き合ってくれて、ありがとうケン！' },
  { t: 'goto', id: 'nend' },
  { t: 'label', id: 'nskip' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……そうですか。' },

  // L2-NEPTUNE-S003 地球に帰る
  { t: 'label', id: 'nend' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '次は、地球ですね。' },
  { t: 'notice', text: '海王星で、結社が用意したゲーム（『キモリンの帰り道』『星すごろく』『生け垣ラビリンス』）を遊ぶことは、このあとも自由にできます' },
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
