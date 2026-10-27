import type { Step } from '../script';
import { chapterEnd, flight } from './common';

/**
 * L2 chapter 2 【木星】 — review/L2_木星.md (L2-JUPITER-S001, S002, S005, S006).
 * The Kaiser has grown wild roots. A jacket from a daydream (photo / Bati draws / words only, side by side),
 * kept in the roots or flown to the dachi's sky; KIMORIN's 『ブラタゴンと、月で、お茶を』 (with a tea stain)
 * arrives, and 〔🌳 この人の木へ〕 leads to KIMORIN's showy tree (the eight-letter tag: 「家を、失いました」).
 * Last, the visitor's own tree: the first journey's flown jacket came back as a leaf.
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
  { t: 'say', who: '大根カイザー', text: '今日は、空想を、ジャケットにするダ。' },
  { t: 'say', who: '大根カイザー', text: 'それと、ダチの木を、訪ねるダ。' },

  // L2-JUPITER-S002 空想のジャケット
  { t: 'still', image: 's/jupiter-stone' }, // 世界樹の根もと。石のくぼみのまわりに、木もれ日
  { t: 'sprite', image: 'daikon-kaiser' },
  { t: 'say', who: '大根カイザー', text: '根っこの言葉からも、写真からも、ジャケットは作れたダ。' },
  { t: 'say', who: '大根カイザー', text: '今日は、まだ見たことのないものを描くダ。撮っていなくても、思い描いたものは、描けるダ。' },
  { t: 'say', who: '大根カイザー', text: '君の言葉も、空想も、ジャケットになるダ。' },
  { t: 'choice', key: 'jmake', options: [{ label: '空想をジャケットにする', goto: 'jmake' }, { label: '今日は作らない', goto: 'jnone' }] },
  { t: 'label', id: 'jmake' },
  { t: 'sprite', image: ['daikon-kaiser', '@bati'] },
  { t: 'say', who: 'バティ', text: '{neo}は、どんな景色を思い描く？' },
  { t: 'say', who: '大根カイザー', text: '思い描いたまま、声で言ってみるダ。' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'jacket' },
  { t: 'goto', id: 'jjoin' },
  { t: 'label', id: 'jnone' },
  { t: 'say', who: '大根カイザー', text: '作らん日も、あってよいダ。空想は、どこにも行かんダ。' },
  { t: 'label', id: 'jjoin' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'では、私も、空想を一枚。' }, // Bluenaに小声で何か吹きこむ
  { t: 'se', sound: 'whoosh' }, // 〔推し〕の空に、ジャケットが一枚、パタパタと飛んでくる。名札『@KIMORIN⭐︎』
  { t: 'l2', what: 'kimorin-jacket' }, // 黒い虎じまのドラゴンの背中で、白い狐が、ティーカップを片手に月のまわりを飛ぶ
  { t: 'say', who: 'KIMORIN', text: '空想ですので。ブラタゴンにも、乗れます。' },
  { t: 'say', who: 'KIMORIN', text: '……空想でも、紅茶は、こぼれましたね。' }, // ジャケットのすみに、小さな茶色いしみ

  // L2-JUPITER-S005 ダチの木を訪ねる
  { t: 'sprite', image: 'daikon-kaiser' },
  { t: 'say', who: '大根カイザー', text: 'ジャケットを開いたら、それを作った者の木へも行けるダ。' },
  { t: 'notice', text: 'ジャケット帳の〔🌳 この人の木へ〕で、そのダチの木に行けます（見るだけ。根っこは見えません。本人がいなくても行けます）' },
  { t: 'notice', text: '{inviter}の木にも、{inviter}のジャケットから行けます' },
  { t: 'sprite', image: null },
  { t: 'choice', key: 'jvisit', options: [{ label: 'KIMORINの木へ', goto: 'jkimorin' }, { label: '今は、自分の木へ戻る', goto: 'jmine' }] },
  { t: 'label', id: 'jkimorin' },
  { t: 'l2', what: 'kimorin-tree' }, // 隣の丘に、KIMORINの木。枝という枝にドラゴンのジャケット。いちばん高い枝に金の額縁の『プリプリ・ボカン』
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '枝の札は、八文字まで、だそうです。『宇宙一の天才発明家』は、九文字。' },
  { t: 'say', who: 'KIMORIN', text: '……家を、失いました。' },
  { t: 'goto', id: 'jvisited' },
  { t: 'label', id: 'jmine' },
  { t: 'sprite', image: 'daikon-kaiser' },
  { t: 'say', who: '大根カイザー', text: 'ダチの木は、いつ行ってもよいダ。' },
  { t: 'label', id: 'jvisited' },
  { t: 'sprite', image: ['kimorin-sun', 'daikon-kaiser'] }, // Bluenaを取り出しては、しまう。また取り出しては、しまう
  { t: 'say', who: 'KIMORIN', text: '……もし、、、ダチが、増えたら、、、訪ねる木も、増えるのですかね、、、' },
  { t: 'say', who: '大根カイザー', text: '増えるダ。' },
  { t: 'say', who: 'KIMORIN', text: '……そうですか。' }, // Bluenaを、そっとしまう
  { t: 'sprite', image: null },
  { t: 'l2', what: 'my-tree' }, // 丘のてっぺん、{neo}の木。地面の名札は『{neo}』
  { t: 'branch', key: 'l1_jacket', cases: { send: 'jleaf' }, otherwise: 'jstill' },
  { t: 'label', id: 'jleaf' },
  { t: 'sprite', image: 'daikon-kaiser' }, // 枝に、若い葉が一枚。一周目に飛ばしたジャケットが、帰ってきていた
  { t: 'say', who: '大根カイザー', text: 'おかえりダ。飛ばしたジャケットが帰ると、葉が出るダ。' },
  { t: 'goto', id: 'jtoday' },
  { t: 'label', id: 'jstill' },
  { t: 'sprite', image: 'daikon-kaiser' }, // 枝に、一周目のジャケットが、とまったまま
  { t: 'say', who: '大根カイザー', text: '飛ばせば、空をめぐって帰ってきて、葉になるダ。' },
  { t: 'label', id: 'jtoday' },
  { t: 'branch', key: 'jacket', cases: { send: 'jback' }, otherwise: 'jgrow' },
  { t: 'label', id: 'jback' },
  { t: 'say', who: '大根カイザー', text: '今日の空想も、88時間たったら、この枝に帰ってくるダ。' },
  { t: 'label', id: 'jgrow' },
  { t: 'say', who: '大根カイザー', text: '木は、君が育てるダ。形も、色も、飾りも、札の言葉も、変えてよいダ。' },
  { t: 'notice', text: '〔🌳 木を飾る〕で、形・色・飾り・枝の札を、いつでも変えられます（2回目からのボタンは〔飾る〕。〔やめる〕で選んだものは残ります）' },
  { t: 'sprite', image: null },
  { t: 'choice', key: 'jdeco', options: [{ label: '〔🌳 木を飾る〕で変える', goto: 'jdeco' }, { label: 'このままにする', goto: 'jkeep' }] },
  { t: 'label', id: 'jdeco' },
  { t: 'l2', what: 'tree-deco' },
  { t: 'goto', id: 'jend' },
  { t: 'label', id: 'jkeep' },
  { t: 'sprite', image: 'daikon-kaiser' },
  { t: 'say', who: '大根カイザー', text: 'そのままも、よい木ダ。' },

  // L2-JUPITER-S006 水星が開いた
  { t: 'label', id: 'jend' },
  { t: 'sprite', image: 'daikon-kaiser' },
  { t: 'say', who: '大根カイザー', text: '次は、水星ダ。' },
  { t: 'caption', text: '水星が開いた' },
  { t: 'notice', text: '木星でジャケットを作る・飛ばす、ダチの木を訪ねる、myツリーを飾るのは、このあとも自由にできます' },
  { t: 'sprite', image: null },
  ...chapterEnd(2),
];
