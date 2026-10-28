import type { Step } from '../script';
import { chapterEnd, flight } from './common';

/**
 * L2 chapter 2 【木星】 — story wip/P06 (L2-JUPITER-S001, S002, S005, S006; draft 21: M-R151 art, M-R155〜157).
 * The Kaiser has grown wild roots. An art from a daydream (photo / Bati draws / words only, side by side),
 * kept in the roots or carried by the {neo} butterfly to the dachi's sky; KIMORIN's butterfly brings
 * 『ブラタゴンと、月で、お茶を』 (with a tea stain), and 〔🎨 この人のアトリエへ〕 leads to KIMORIN's showy atelier (the
 * eight-letter sign: 「家を、失いました」). Last, the visitor's own atelier: the first journey's flown art came back
 * with a leaf on its frame.
 * Branches: `l1_jacket` (first journey Jupiter: send / keep), `jacket` (today: send / keep / none).
 */
export const L2_JUPITER: Step[] = [
  ...flight('木星に着いた'),
  { t: 'bgm', track: 'jupiter' },
  { t: 'still', image: 's/jupiter-forest' }, // 雲を突き抜ける世界樹。根もとの大森林。根とつるに巻かれた大根
  { t: 'sprite', image: ['daikon-kaiser', 'kimorin-sun'] }, // 牙をむいた険しい顔。体は、根とつるのかたまり
  { t: 'say', who: '大根カイザー', text: 'おかえりダ、{neo}。' },
  { t: 'say', who: 'KIMORIN', text: '……王様、少し、ワイルドに、なられましたね。' },
  { t: 'say', who: '大根カイザー', text: '根を、深く張ったダ。' },
  { t: 'say', who: '大根カイザー', text: '今日は、空想を、アートにするダ。' },
  { t: 'say', who: '大根カイザー', text: 'それと、ダチのアトリエを、訪ねるダ。' },

  // L2-JUPITER-S002 空想のアート
  { t: 'still', image: 's/jupiter-stone' }, // 世界樹の根もと。石のくぼみのまわりに、木もれ日
  { t: 'sprite', image: 'daikon-kaiser' },
  { t: 'say', who: '大根カイザー', text: '根っこの言葉からも、写真からも、アートは作れたダ。' },
  { t: 'say', who: '大根カイザー', text: '今日は、まだ見たことのないものを描くダ。撮っていなくても、思い描いたものは、描けるダ。' },
  { t: 'say', who: '大根カイザー', text: '君の言葉も、空想も、アートになるダ。' },
  // M-R167 スペルコンパス：手のひらほどの金色のコンパス。針のかわりに、光る羽ペン
  { t: 'say', who: '大根カイザー', text: '{neo}。もう一つ、持っていくダ。' },
  { t: 'se', sound: 'sparkle' },
  { t: 'caption', text: 'スペルコンパスを、もらった' },
  { t: 'say', who: '大根カイザー', text: 'スペルコンパスダ。気になる絵に向ければ、その絵のスペルの方角を指すダ。' },
  { t: 'notice', text: '〔🧭 スペルコンパス〕｜好きな絵を送ると、その絵のスペルを、札にして読み取ります（読み取る前に、何のスペルがほしいか選べます）。人や作品の名前は札にしません。送った画像は残しません。マナは使いません' },
  { t: 'sprite', image: ['daikon-kaiser', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: 'では、試しに。' }, // 自分の顔の写真に、コンパスを向ける
  { t: 'l2', what: 'compass-kimorin' }, // 羽ペンがくるくる回って、ぴたりと止まる。〈白い狐〉〈丸いサングラス〉〈自信〉〈自信〉〈自信〉
  { t: 'say', who: 'KIMORIN', text: '……自信が、三枚。正確な道具ですね。' },
  { t: 'say', who: '大根カイザー', text: '……正直な、コンパスダ。' },
  { t: 'choice', key: 'jmake', options: [{ label: '空想をアートにする', goto: 'jmake' }, { label: '今日は作らない', goto: 'jnone' }] },
  { t: 'label', id: 'jmake' },
  { t: 'sprite', image: ['daikon-kaiser', '@bati'] },
  { t: 'say', who: 'バティ', text: '{neo}は、どんな景色を思い描く？' },
  { t: 'notice', text: 'こんな絵にしたい、という絵があれば、〔🧭 スペルコンパス〕で読み取ってから話してもいい' },
  { t: 'say', who: '大根カイザー', text: 'Obolo Orderは、スペルを、自分の手で、組み替えられるダ。札を一枚変えれば、絵も変わるダ。' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'jacket' },
  { t: 'branch', key: 'jacket', cases: { keep: 'jkept' }, otherwise: 'jjoin' },
  { t: 'label', id: 'jkept' },
  { t: 'sprite', image: 'daikon-kaiser' },
  { t: 'say', who: '大根カイザー', text: '飛ばすのは、いつでもできるダ。' },
  { t: 'goto', id: 'jjoin' },
  { t: 'label', id: 'jnone' },
  { t: 'say', who: '大根カイザー', text: '作らん日も、あってよいダ。空想は、どこにも行かんダ。' },
  { t: 'label', id: 'jjoin' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'では、私も、空想を一枚。' }, // Bluenaに小声で何か吹きこむ
  { t: 'se', sound: 'whoosh' }, // 〔推し〕の空に、KIMORINの蝶が、アートを抱えて、パタパタと飛んでくる。名札『@KIMORIN⭐︎』
  { t: 'l2', what: 'kimorin-jacket' }, // 黒い虎じまのドラゴンの背中で、白い狐が、ティーカップを片手に月のまわりを飛ぶ
  { t: 'say', who: 'KIMORIN', text: '空想ですので。ブラタゴンにも、乗れます。' },
  { t: 'say', who: 'KIMORIN', text: '……空想でも、紅茶は、こぼれましたね。' }, // アートのすみに、小さな茶色いしみ

  // L2-JUPITER-S005 ダチのアトリエを訪ねる
  { t: 'sprite', image: 'daikon-kaiser' },
  { t: 'say', who: '大根カイザー', text: 'アートを開いたら、それを作った者のアトリエへも行けるダ。' },
  { t: 'notice', text: 'アート帳の〔🎨 この人のアトリエへ〕で、そのダチのアトリエに行けます（見るだけ。根っこは見えません。本人がいなくても行けます）' },
  { t: 'notice', text: '{inviter}のアトリエにも、{inviter}のアートから行けます' },
  { t: 'sprite', image: null },
  { t: 'choice', key: 'jvisit', options: [{ label: 'KIMORINのアトリエへ', goto: 'jkimorin' }, { label: '今は、自分のアトリエへ戻る', goto: 'jmine' }] },
  { t: 'label', id: 'jkimorin' },
  { t: 'l2', what: 'kimorin-tree' }, // 隣の丘に、KIMORINのアトリエ。建物が、やけに派手。壁という壁にドラゴンのアート、奥の壁に金の額縁の『プリプリ・ボカン』
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '看板は、八文字まで、だそうです。『宇宙一の天才発明家』は、九文字。' },
  { t: 'say', who: 'KIMORIN', text: '……家を、失いました。' },
  { t: 'goto', id: 'jvisited' },
  { t: 'label', id: 'jmine' },
  { t: 'sprite', image: 'daikon-kaiser' },
  { t: 'say', who: '大根カイザー', text: 'ダチのアトリエは、いつ行ってもよいダ。' },
  { t: 'label', id: 'jvisited' },
  { t: 'sprite', image: ['kimorin-sun', 'daikon-kaiser'] }, // Bluenaを取り出しては、しまう。また取り出しては、しまう
  { t: 'say', who: 'KIMORIN', text: '……もし……ダチが、増えたら……訪ねるアトリエも、増えるのですかね……' },
  { t: 'say', who: '大根カイザー', text: '増えるダ。' },
  { t: 'say', who: 'KIMORIN', text: '……そうですか。' }, // Bluenaを、そっとしまう
  { t: 'sprite', image: null },
  { t: 'l2', what: 'my-tree' }, // 丘のてっぺん、{neo}のアトリエ。地面の名札は『{neo}』
  { t: 'branch', key: 'l1_jacket', cases: { send: 'jleaf' }, otherwise: 'jstill' },
  { t: 'label', id: 'jleaf' },
  { t: 'sprite', image: 'daikon-kaiser' }, // 額のすみに、若い葉が一枚。一周目に飛ばしたアートが、空をめぐって帰ってきていた
  { t: 'say', who: '大根カイザー', text: 'おかえりダ。飛ばしたアートが帰ると、葉が出るダ。' },
  { t: 'goto', id: 'jtoday' },
  { t: 'label', id: 'jstill' },
  { t: 'sprite', image: 'daikon-kaiser' }, // 壁に、一周目のアートが、飾られたまま
  { t: 'say', who: '大根カイザー', text: '飛ばせば、空をめぐって帰ってきて、葉になるダ。' },
  { t: 'label', id: 'jtoday' },
  { t: 'branch', key: 'jacket', cases: { send: 'jback' }, otherwise: 'jgrow' },
  { t: 'label', id: 'jback' },
  { t: 'say', who: '大根カイザー', text: '今日の空想も、88時間たったら、この壁に帰ってくるダ。' },
  { t: 'label', id: 'jgrow' },
  { t: 'say', who: '大根カイザー', text: 'アトリエは、君が育てるダ。札も、看板の言葉も、変えてよいダ。' },
  { t: 'notice', text: '〔🎨 アトリエを飾る〕で、部品の札・入口の看板を、いつでも変えられます（2回目からのボタンは〔飾る〕。〔やめる〕で選んだものは残ります）' },
  { t: 'sprite', image: null },
  { t: 'choice', key: 'jdeco', options: [{ label: '〔🎨 アトリエを飾る〕で変える', goto: 'jdeco' }, { label: 'このままにする', goto: 'jkeep' }] },
  { t: 'label', id: 'jdeco' },
  { t: 'l2', what: 'tree-deco' },
  { t: 'goto', id: 'jend' },
  { t: 'label', id: 'jkeep' },
  { t: 'sprite', image: 'daikon-kaiser' },
  { t: 'say', who: '大根カイザー', text: 'そのままも、よいアトリエダ。' },

  // L2-JUPITER-S006 水星が開いた
  { t: 'label', id: 'jend' },
  { t: 'sprite', image: 'daikon-kaiser' },
  { t: 'say', who: '大根カイザー', text: '次は、水星ダ。' },
  { t: 'caption', text: '水星が開いた' },
  { t: 'notice', text: '木星でアートを作る・飛ばす、ダチのアトリエを訪ねる、myアトリエを飾るのは、このあとも自由にできます' },
  { t: 'sprite', image: null },
  ...chapterEnd(2),
];
