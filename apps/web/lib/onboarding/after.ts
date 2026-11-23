import type { Speaker, Step } from './script';

/**
 * After becoming Obolo Order (simple version, M-R198; script wip/P05m/c01.md): the three locked planets on the
 * back of the ticket open one a day — 天王星 (goods: クロコパトラ), 冥王星 (stories: たこ焼きブラザー), 海王星 (games:
 * the submarine's signs and KIMORIN) — and the third day ends with M-END-S001 (「ここから先は、自由に」).
 * Each day: arrive → the resident says in a word how works live on this planet → {bati}「工房に行こう！」 → make it in
 * the Moon atelier (the { t: 'l2', what: 'm-…' } screens, components/after) → into Bluena → 〔公開する〕 to the planet.
 * Every character line is the script's line, word for word (scripts/story-sync.ts checks the 「会員後」 section).
 * Played by components/lap2/Lap2Story.tsx (shared LAP2) and on the review page (?day=m1|m2|m3).
 *
 * No pictures were made for these days: the stills are the nearest that exist (s/uranus-field, s/uranus-shop,
 * s/pluto-plain for Pluto's ice plain (made in the M-R251 review), s/neptune-islands for the game map …), noted where they stand in.
 */

/** Uranus's resident (her standing picture: onboarding/crocopatra.webp, M-R251 review) */
const CROCO: Speaker = 'クロコパトラ';

/** the rocket from Earth (or the planet before) to today's planet */
function rocket(arrive: string, image: string): Step[] {
  return [
    { t: 'action', label: 'ロケットに乗る' },
    { t: 'sprite', image: null },
    { t: 'bgm', track: 'space' },
    { t: 'se', sound: 'rocket' },
    { t: 'still', image: 's/rocket-space' },
    { t: 'wait', s: 1.2 },
    { t: 'se', sound: 'arrive' },
    // 到着カット（止め絵＋ゆっくりしたカメラ） + 〔テロップ：〇〇に着いた〕
    { t: 'arrive', image, caption: arrive },
    { t: 'cam', move: 'in' },
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// 会員になって、1日目 — 天王星（グッズの星）
// ---------------------------------------------------------------------------------------------------------------
export const M_URANUS: Step[] = [
  // M-URANUS-S001 天王星の町／{neo}のお店に並べる
  { t: 'scene', id: 'M-URANUS-S001' },
  { t: 'bgm', track: 'morning' },
  { t: 'still', image: 's/earth-hall' }, // 〔背景 earth-hq（仮）〕
  { t: 'caption', text: '会員になって、1日目' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'おはようございます。……Obolo Orderになって、初めての朝ですね。' },
  { t: 'sprite', image: null },
  // {neo}のBluenaが光る。正方形のスクリーンに、切符の裏の星図。錠の印のついた三つの星のうち、青緑の星の錠が、かちり、と外れる
  { t: 'se', sound: 'blip' },
  { t: 'ticket', flip: true },
  { t: 'se', sound: 'chime' },
  { t: 'caption', text: '天王星が開いた' },
  // 青緑にかすむ天王星→雲の上の野原、点々と並ぶ小さな店→縄の橋を渡る気球→まん中の浮島に看板『obolo商店』
  ...rocket('天王星に着いた', 's/uranus-field'),
  { t: 'bgm', track: 'city' },
  // 気球のかごから、ワインレッドのドレスのワニの貴婦人が、扇子をひらいて降りてくる。頭に小さなティアラ
  { t: 'say', who: CROCO, text: 'あら。ようこそ、{neo}。わたくし、クロコパトラ。この町のマダムですわ。' },
  { t: 'say', who: CROCO, text: '天王星は、グッズの星。月の工房でお作りになったグッズが、この町で、品物になって並びますのよ。' }, // 扇子をあおぎながら
  // 町のはしに、{neo}の名前の札がかかった、小さな空き店。窓の向こうの棚は、まだ空いている
  { t: 'still', image: 's/uranus-shop', fade: 0.8 },
  { t: 'say', who: CROCO, text: 'こちらが、{neo}のお店。形を選んで、絵をのせて、ハンドルを回すだけ。お作りになるのは、月の工房ですわ。' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '工房に行こう！' },
  { t: 'sprite', image: null },
  { t: 'action', label: 'つくる' }, // 〔画面：〔🌙 つくる〕〕
  // Bluenaのレンズから光がのび、正方形のスクリーンが広がる。{bati}が、スクリーンをくぐって、黒い鉄の大きな刷り台に、ぴょんと跳びのる
  { t: 'se', sound: 'portal' },
  { t: 'still', image: 's/uranus-press', fade: 0.8 }, // the iron press with its handle (the workshop itself opens in the m-goods screen)
  { t: 'caption', text: '月の工房につながった' },
  {
    t: 'notice',
    text: '月の工房｜宝石（グッズ）が選ばれた状態で開きます｜①形を選ぶ〔Tシャツ〕〔マグカップ〕〔アクリルスタンド〕〔ステッカー〕〔缶バッジ〕〔トート〕〔おまかせ！〕｜②のせる絵を、Bluenaの中の自分のアートから選ぶ｜③ハンドルを回すと、見本が浮かぶ。見本だけでは、注文も支払いもしません',
  },
  {
    t: 'choice',
    key: 'uranus_pick',
    options: [
      { label: '一つ作って、店に並べる', goto: 'u-display' },
      { label: '作って、Bluenaにしまうだけ', goto: 'u-enough' },
      { label: '今は作らない', goto: 'u-none' },
    ],
  },
  { t: 'label', id: 'u-display' },
  { t: 'set', key: 'f_m_uranus_goods', value: 'displayed' },
  { t: 'goto', id: 'u-make' },
  { t: 'label', id: 'u-enough' },
  { t: 'set', key: 'f_m_uranus_goods', value: 'enough' },
  { t: 'label', id: 'u-make' },
  // {neo}がハンドルを回す。刷り台の上に、〈選んだ絵〉の〈選んだ形〉の見本が浮かぶ — shape, art, handle (sets f_m_uranus_template)
  { t: 'l2', what: 'm-goods' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'Bluenaに、しまったよ！' },
  { t: 'sprite', image: null },
  // 見本が、スクリーンのこちら側へ流れて、Bluenaの中へ。{bati}が戻ってくる。スクリーンが閉じる
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/uranus-shop', fade: 0.6 },
  { t: 'branch', key: 'f_m_uranus_goods', cases: { displayed: 'u-show' }, otherwise: 'u-kept' },
  { t: 'label', id: 'u-show' },
  { t: 'notice', text: '〔公開する〕（行き先：天王星）｜{neo}のお店に並びます。注文はしません' },
  { t: 'action', label: '公開する' },
  // Bluenaの側面の小さなレンズが光り、光が{neo}のお店の窓に届く。見本が形になって棚に収まる。店の小窓に、灯りがつく
  { t: 'l2', what: 'm-publish-goods' },
  { t: 'notice', text: '{neo}のお店に並べました。注文はしていません' },
  { t: 'say', who: CROCO, text: 'まあ、すてき。お店らしくなりましたわ。' }, // 扇子をとじて
  { t: 'goto', id: 'u-join' },
  { t: 'label', id: 'u-kept' },
  { t: 'notice', text: 'Bluenaの天王星のフォルダにしまいました。誰にも見えていません。〔公開する〕は、Bluenaから、いつでも押せます' },
  { t: 'goto', id: 'u-join' },
  { t: 'label', id: 'u-none' },
  { t: 'set', key: 'f_m_uranus_goods', value: 'none' },
  { t: 'still', image: 's/uranus-shop', fade: 0.6 }, // スクリーンが閉じる
  { t: 'say', who: CROCO, text: 'お作りになるのは、いつでもよろしくてよ。' },
  { t: 'label', id: 'u-join' },
  { t: 'notice', text: '〔ダチの店〕の札を押すと、ダチのお店を訪ねられます。気球で渡ります' },

  // M-URANUS-S002 obolo商店／冥王星は、明日
  { t: 'scene', id: 'M-URANUS-S002' },
  // 気球が、縄の橋を渡って、まん中の浮島へ。obolo商店。店番はいない。棚に、公式のグッズと住人たちのグッズの見本。どの品にも『受注生産』の札
  { t: 'se', sound: 'whoosh' },
  { t: 'still', image: 's/uranus-shop', fade: 0.8 },
  { t: 'say', who: CROCO, text: '品物に触れると、札が出ますわ。見て回るだけでも、よろしくてよ。' },
  {
    t: 'notice',
    text: 'obolo商店｜品物に触ると札が出ます（作った人・素材・大きさ・『受注生産：注文が入ってから作って届けます』）。〔購入〕を押した時だけ、買う画面が開きます。支払いはお金で、月額88円とは別の料金です。売り買いに、マナは使いません',
  },
  {
    t: 'choice',
    key: 'uranus_shop_pick',
    options: [
      { label: '棚の品物に触ってみる', goto: 'u-look' },
      { label: '今はいい', goto: 'u-skip' },
    ],
  },
  { t: 'label', id: 'u-look' },
  { t: 'set', key: 'f_m_uranus_shop', value: 'look' },
  // {neo}が、たこ焼き柄のトートバッグに触る。札が開く。いちばん下に〔購入〕 (〔購入〕: the purchase screen, outside the story)
  { t: 'l2', what: 'm-shop' },
  { t: 'say', who: CROCO, text: 'ご注文なされば、お家に届きますわ。値段と送料と届け先をご覧になって、欲しければご注文なさって。' },
  { t: 'goto', id: 'u-shop-join' },
  { t: 'label', id: 'u-skip' },
  { t: 'set', key: 'f_m_uranus_shop', value: 'skip' },
  { t: 'say', who: CROCO, text: 'ご覧になるのは、いつでも。' },
  { t: 'label', id: 'u-shop-join' },
  // いちばん奥に、何も並んでいない棚。札『空き棚』。KIMORINが、その前で止まる
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '公式のじゃなくて、オレが作ったのを、いつか並べるケン。……黒くて、しましまのやつがいいケン。' },
  { t: 'say', who: 'KIMORIN', text: '……失礼。ただの、計画です。' },
  { t: 'sprite', image: null },
  { t: 'say', who: CROCO, text: '次は、冥王星。……暗くて寒い星ですから、お気をつけて。' }, // 扇子をとじて
  { t: 'notice', text: '冥王星は、明日ひらきます。天王星で、グッズを作ってお店に並べる、ダチのお店やobolo商店を見て回ることは、このあとも自由にできます' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'では、私も今日はここまで。' },
  { t: 'set', key: 'f_m_uranus_done', value: 'true' },
  { t: 'end' },
];

// ---------------------------------------------------------------------------------------------------------------
// 会員になって、2日目 — 冥王星（物語の星）
// ---------------------------------------------------------------------------------------------------------------
export const M_PLUTO: Step[] = [
  // M-PLUTO-S001 物語の星
  { t: 'scene', id: 'M-PLUTO-S001' },
  { t: 'bgm', track: 'morning' },
  { t: 'still', image: 's/uranus-field' }, // 〔背景 uranus-town（仮）〕
  { t: 'caption', text: '会員になって、2日目' },
  { t: 'say', who: CROCO, text: 'おはようございます、{neo}。冥王星の錠が、開きましたわ。' }, // 扇子をひらいて
  { t: 'se', sound: 'chime' },
  { t: 'caption', text: '冥王星が開いた' },
  // 太陽からいちばん遠い、小さな冥王星→白い氷の平原、六角形の結晶に眠る本→暗い空の小さな灯り→三輪のバイカ（s/pluto-plain, M-R251 review）
  ...rocket('冥王星に着いた', 's/pluto-plain'),
  { t: 'bgm', track: 'night' },
  { t: 'sprite', image: 'takoyaki-brother' }, // バイカに乗って、{neo}の前に止まりながら
  { t: 'say', who: 'たこ焼きブラザー', text: 'よく来たZE、{neo}。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '冥王星は、物語の星だZE。' },
  { t: 'say', who: 'たこ焼きブラザー', text: '空の灯りは、ぜんぶ、誰かの物語だZE!!' },
  // 平原のはしに、{neo}の名前の札がかかった、小さな氷の書庫。中の棚は、まだ空いている
  { t: 'say', who: 'たこ焼きブラザー', text: 'ここが、{neo}の図書館だZE。公開した本が、ここに並ぶZE。書くのは、月の工房だZE。' },
  { t: 'notice', text: '冥王星｜下に〔本の空〕〔my図書館〕。行きたい場所をタップすると、バイカでそこまで走ります。図書館の形は、あとで{bati}と話して変えられます' },

  // M-PLUTO-S002 お話を書いて、空に灯す
  { t: 'scene', id: 'M-PLUTO-S002' },
  // 氷の平原のまん中に、大きな本の形の氷の台。開いたページは、まだ白い
  { t: 'say', who: 'たこ焼きブラザー', text: 'お話は、{bati}と話して書くZE。' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '工房に行こう！' },
  // 〔Bluenaの門が開き、月の工房へ〕 白い石の机に、開いた本。羽ペンが一本、ひとりでに立っている
  { t: 'se', sound: 'portal' },
  { t: 'label', id: 'p-ask' },
  { t: 'say', who: 'バティ', text: 'どんなお話にする？　だれが、どこで、何をするのか、できるだけ、くわしく教えて！' },
  { t: 'sprite', image: null },
  // 〔画面：月の工房｜開いた本（お話）が選ばれた状態で開きます｜〔🎙 話してみよう〕｜〔おまかせ〕｜〔旅で作ったものから〕…〕 (the choice shows the rest)
  { t: 'notice', text: '〔旅で作ったものから〕（Bluenaの中のコロリンの言葉・アート・曲を、お話の材料にできます）' },
  {
    t: 'choice',
    key: 'pluto_pick',
    options: [
      { label: '話してみる', goto: 'p-talk' },
      { label: '旅で作ったものから', goto: 'p-trip' },
      { label: 'おまかせ', goto: 'p-auto' },
      { label: '今日は書かない', goto: 'p-none' },
    ],
  },
  { t: 'label', id: 'p-talk' },
  { t: 'set', key: 'f_m_pluto_story', value: 'talk' },
  { t: 'goto', id: 'p-seed' },
  { t: 'label', id: 'p-trip' },
  { t: 'set', key: 'f_m_pluto_story', value: 'trip' },
  { t: 'goto', id: 'p-seed' },
  { t: 'label', id: 'p-auto' },
  { t: 'set', key: 'f_m_pluto_story', value: 'auto' },
  { t: 'label', id: 'p-seed' },
  // 〔🎙 話してみよう〕／Bluenaから一枚選ぶ（光の糸がページへ）／{bati}がお話の種を選ぶ
  { t: 'l2', what: 'm-story-seed' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'じゃあ、スペルは、こうなるね！' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'm-story-cards' }, // スペルの札が並ぶ｜下に〔✏️ スペルを組み替える〕
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'このスペルで、お話を書くよ。マナを少し使うけど、いい？' },
  { t: 'choice', key: 'pluto_use', options: [{ label: '使う', goto: 'p-write' }, { label: 'やめる（話し直す）', goto: 'p-ask' }] },
  { t: 'label', id: 'p-write' },
  // バティのおなかが、ぽう、と光る。空中に光の円
  { t: 'se', sound: 'magic' },
  { t: 'say', who: 'バティ', text: '〈{neo}のお話〉——ここに、かたちを。' },
  { t: 'sprite', image: null },
  // 羽ペンが走りだす。開いたページに、字が流れこむ → 〔画面：お話ができました｜題と本文｜〔▶ 読む〕｜〔🖼 絵本にする〕〕
  { t: 'l2', what: 'm-story-write' },
  { t: 'choice', key: 'pluto_book', options: [{ label: 'このお話にする', goto: 'p-text' }, { label: '絵本にする', goto: 'p-make' }] },
  { t: 'label', id: 'p-make' },
  { t: 'set', key: 'f_m_pluto_picturebook', value: 'make' },
  // ページがひとりでにめくれる → ページごとに絵の作り方を選ぶ → 表紙に、一枚目の絵
  { t: 'l2', what: 'm-picturebook' },
  { t: 'caption', text: '絵本ができた' },
  { t: 'goto', id: 'p-kept' },
  { t: 'label', id: 'p-text' },
  { t: 'set', key: 'f_m_pluto_picturebook', value: 'text' },
  { t: 'label', id: 'p-kept' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'Bluenaに、しまったよ！' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' }, // スクリーンが閉じて、氷の平原へ戻る
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '次は、公開だZE。' },
  { t: 'sprite', image: null },
  {
    t: 'notice',
    text: 'Bluenaのお話の〔公開する〕（行き先：冥王星）を押すと、お話が氷の結晶の本になって{neo}の図書館の棚に並び、冥王星の空に灯りがひとつともります。{neo}の顔のフクロウが本を抱えて、ダチの空をとび、また棚に戻ります',
  },
  { t: 'choice', key: 'pluto_send', options: [{ label: '公開する', goto: 'p-send' }, { label: '今は、Bluenaにしまっておく', goto: 'p-keep' }] },
  { t: 'label', id: 'p-send' },
  { t: 'set', key: 'f_m_pluto_publish', value: 'send' },
  // レンズの光→氷の結晶の本が棚に（絵本ならとなりに絵本の結晶）→暗い空に灯りがひとつ→{neo}の顔のフクロウが本を抱えて飛んでいく
  { t: 'l2', what: 'm-publish-book' },
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '灯ったZE!!' },
  { t: 'goto', id: 'p-kimorin' },
  { t: 'label', id: 'p-keep' },
  { t: 'set', key: 'f_m_pluto_publish', value: 'keep' },
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '公開するのは、いつでもいいZE。' },
  { t: 'notice', text: '〔公開する〕は、Bluenaから、いつでも押せます' },
  { t: 'goto', id: 'p-kimorin' },
  { t: 'label', id: 'p-none' },
  { t: 'set', key: 'f_m_pluto_story', value: 'none' },
  { t: 'set', key: 'f_m_pluto_publish', value: 'nobook' },
  { t: 'se', sound: 'whoosh' }, // スクリーンが閉じて、氷の平原へ戻る
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: '書かない日も、あっていいZE。ページは、逃げないZE。' },
  { t: 'label', id: 'p-kimorin' },
  // となりの氷の台の前で、KIMORINが、Bluenaの正方形のスクリーンに向かって、長いこと話している。身ぶり手ぶりも、ついている
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'bgm', track: 'comedy' },
  { t: 'say', who: 'KIMORIN', text: '……では、私も、一冊。自伝です。題は『天才の一生』。' },
  { t: 'l2', what: 'kimorin-life' }, // 字が浮かぶ。三行で、止まる。『KIMORIN⭐︎は、生まれた。／天才だった。／今も、天才である。』
  // サングラスが、鼻先までずり落ちる
  { t: 'say', who: 'KIMORIN', text: '……三行やん。なんやこれ。' },
  // こほん。サングラスを、指でかけ直す
  { t: 'say', who: 'KIMORIN', text: '……失礼。要点だけに、なりましたね。' },
  { t: 'bgm', track: 'night' },
  { t: 'sprite', image: ['takoyaki-brother', 'kimorin-sun'] },
  { t: 'say', who: 'たこ焼きブラザー', text: '次は、海王星だZE。' },
  { t: 'notice', text: '海王星は、明日ひらきます。冥王星で、お話や絵本を公開する、図書館を見て回ることは、このあとも自由にできます' },
  { t: 'say', who: 'KIMORIN', text: 'では、私も今日はここまで。' },
  { t: 'set', key: 'f_m_pluto_done', value: 'true' },
  { t: 'end' },
];

// ---------------------------------------------------------------------------------------------------------------
// 会員になって、3日目 — 海王星（ゲームの星）
// ---------------------------------------------------------------------------------------------------------------
export const M_NEPTUNE: Step[] = [
  // M-NEPTUNE-S001 深海の都／『ナガレを越えて』
  { t: 'scene', id: 'M-NEPTUNE-S001' },
  { t: 'bgm', track: 'morning' },
  { t: 'still', image: 's/pluto-plain' }, // 〔背景 pluto-plain〕 (the ice plain of the day before)
  { t: 'caption', text: '会員になって、3日目' },
  { t: 'sprite', image: 'takoyaki-brother' },
  { t: 'say', who: 'たこ焼きブラザー', text: 'おはようだZE、{neo}。海王星の錠が、開いたZE。' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'chime' },
  { t: 'caption', text: '海王星が開いた' },
  // 深い青の海王星、白い嵐の渦→潜水艇が沈んでいく→海の底のネオン→沈んだ都（s/neptune-town stands in: no deep-sea picture yet）
  ...rocket('海王星に着いた', 's/neptune-town'),
  { t: 'bgm', track: 'night' },
  // 都のまん中に、巻き貝の形の建物。入口のまわりだけ、ネオンが灯っている。看板『ナガレを越えて』／潜水艇の中の札
  { t: 'notice', text: '『ようこそ、Obolo Order。ここは、ゲームの星。深海の都の、結社のゲームセンター。建物の一つ一つが、遊びの館。何度でも、潜りに来ていい。』' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……海の底に、遊ぶためだけの都、ですか。' },
  { t: 'sprite', image: null },
  // 巻き貝の館の奥の丸い部屋。壁いっぱいの画面に、すごろくの地図。星のマスが並び、灰色の嵐がゆっくり回っている
  { t: 'still', image: 's/neptune-islands', fade: 0.8 },
  { t: 'notice', text: '『ナガレを越えて』｜結社が作った、遊べる見本です。主人公は、{neo}の小さな姿。1ステージ1〜2分。失敗しても、その場からやり直せます。結果は「クリア」だけが出ます。遊ぶのに、マナは使いません' },
  { t: 'choice', key: 'neptune_pick', options: [{ label: '遊んでみる', goto: 'n-trial' }, { label: '今は、見るだけ', goto: 'n-none' }] },
  { t: 'label', id: 'n-trial' },
  // 地図の土星のマスに、小さな{neo}が乗る → 土星のステージ（〈次〉〈まだ見てるの？〉…）→ コロリンが歌う → 〔画面：クリア〕
  { t: 'l2', what: 'm-nagare' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '……{neo}の声で、遊べた！' },
  { t: 'goto', id: 'n-join' },
  { t: 'label', id: 'n-none' },
  { t: 'set', key: 'f_m_neptune_trial', value: 'none' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……では、また今度。館は、逃げませんね。' },
  { t: 'label', id: 'n-join' },
  { t: 'sprite', image: null },

  // M-NEPTUNE-S002 {neo}のゲームを作る
  { t: 'scene', id: 'M-NEPTUNE-S002' },
  // 巻き貝の館を出る。灯りの入っていない、小さな貝の建物がいくつも並んでいる
  { t: 'still', image: 's/neptune-town', fade: 0.8 },
  { t: 'notice', text: '『ここに並ぶ遊びは、Obolo Orderが、月の工房で作ったもの。』' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'ねえ、{neo}。{neo}の曲と絵で、ちっちゃいゲーム、作ってみない？' },
  { t: 'say', who: 'バティ', text: '工房に行こう！' },
  // 〔Bluenaの門が開き、月の工房へ〕 作業台の上に、Bluenaの中の作品が並ぶ
  { t: 'se', sound: 'portal' },
  { t: 'label', id: 'n-ask' },
  { t: 'say', who: 'バティ', text: 'どんなゲームにする？　だれが、何をして、どうなったら勝ちか、できるだけ、くわしく教えて！' },
  { t: 'sprite', image: null },
  {
    t: 'choice',
    key: 'neptune_game_pick',
    options: [
      { label: '話してみる', goto: 'n-talk' },
      { label: 'おまかせ', goto: 'n-auto' },
      { label: '今は作らない', goto: 'n-nogame' },
    ],
  },
  { t: 'label', id: 'n-talk' },
  { t: 'set', key: 'f_m_neptune_game', value: 'talk' },
  { t: 'goto', id: 'n-seed' },
  { t: 'label', id: 'n-auto' },
  { t: 'set', key: 'f_m_neptune_game', value: 'auto' },
  { t: 'label', id: 'n-seed' },
  { t: 'l2', what: 'm-game-seed' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'じゃあ、スペルは、こうなるね！' },
  { t: 'sprite', image: null },
  { t: 'l2', what: 'm-game-cards' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'このスペルで、ゲームを作るよ。マナを少し使うけど、いい？' },
  { t: 'choice', key: 'neptune_use', options: [{ label: '使う', goto: 'n-make' }, { label: 'やめる（話し直す）', goto: 'n-ask' }] },
  { t: 'label', id: 'n-make' },
  { t: 'se', sound: 'magic' },
  { t: 'say', who: 'バティ', text: '〈{neo}のゲーム〉——ここに、かたちを。' },
  { t: 'sprite', image: null },
  // アートが広がり、曲が鳴りだし、音符が降ってきて、コロリンが受け止める → 〔画面：ゲームができました｜〔▶ 遊んでみる〕〔🎙 話して直す〕〕
  { t: 'l2', what: 'm-game-play' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: 'Bluenaに、しまったよ！' },
  { t: 'sprite', image: null },
  { t: 'se', sound: 'whoosh' }, // スクリーンが閉じて、潜水艇へ戻る
  { t: 'notice', text: 'Bluenaのゲームの〔公開する〕（行き先：海王星）を押すと、深海の都のゲームセンターに、{neo}の館が並びます。遊ぶのに、マナは使いません。点数の順位や、人と比べる数は出ません' },
  { t: 'choice', key: 'neptune_send', options: [{ label: '公開する', goto: 'n-send' }, { label: '今は、Bluenaにしまっておく', goto: 'n-keep' }] },
  { t: 'label', id: 'n-send' },
  { t: 'set', key: 'f_m_neptune_publish', value: 'send' },
  // レンズの光が海の底へ。灯りの入っていなかった貝の建物に、ネオンが灯る。看板に〈{neo}のゲームの題〉
  { t: 'l2', what: 'm-publish-game' },
  // KIMORINが、潜水艇を貝の館に寄せる
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'bgm', track: 'comedy' },
  { t: 'say', who: 'KIMORIN', text: '……では、遊ばせていただきます。' },
  // KIMORINの小さな姿が、音符を一つ、受けそこなう。また一つ。また一つ
  { t: 'se', sound: 'boing' },
  { t: 'say', who: 'KIMORIN', text: '……もう一回。' },
  { t: 'se', sound: 'boing' }, // また受けそこなう
  { t: 'say', who: 'KIMORIN', text: '……もう一回だけ、やらせてほしいケン。' },
  // こほん
  { t: 'say', who: 'KIMORIN', text: '……失礼。研究の、ためです。' },
  { t: 'goto', id: 'n-end' },
  { t: 'label', id: 'n-keep' },
  { t: 'set', key: 'f_m_neptune_publish', value: 'keep' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……公開するのは、いつでも、ですね。' },
  { t: 'notice', text: '〔公開する〕は、Bluenaから、いつでも押せます' },
  { t: 'goto', id: 'n-end' },
  { t: 'label', id: 'n-nogame' },
  { t: 'set', key: 'f_m_neptune_game', value: 'none' },
  { t: 'set', key: 'f_m_neptune_publish', value: 'nogame' },
  { t: 'se', sound: 'whoosh' }, // スクリーンが閉じて、潜水艇へ戻る
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……作るのは、いつでも。都は、逃げませんね。' },
  { t: 'label', id: 'n-end' },
  { t: 'set', key: 'f_m_neptune_done', value: 'true' },
  { t: 'sprite', image: null },
];

// ---------------------------------------------------------------------------------------------------------------
// M-END-S001 どこへでも (the same day, straight after Neptune)
// ---------------------------------------------------------------------------------------------------------------
export const M_END: Step[] = [
  { t: 'scene', id: 'M-END-S001' },
  // 潜水艇が、深海の都から浮かび上がる。ロケットが、海王星を離れる
  { t: 'bgm', track: 'space' },
  { t: 'se', sound: 'rocket' },
  { t: 'still', image: 's/rocket-space' },
  // 窓の外に、九つの星が並んで見える。どの星にも、錠の印は、もうない
  { t: 'ticket', flip: true },
  // {neo}のBluenaが光る。正方形のスクリーンに、金色の封蝋の手紙が一通
  { t: 'se', sound: 'paper' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……本部から、ですね。読みます。' },
  { t: 'say', who: 'KIMORIN', text: '『Obolo Orderへ。星への門は、すべて開いた。ここから先は、どの星へ、どの順で行ってもよい。』' },
  { t: 'say', who: 'KIMORIN', text: '『新しい星の物語は、季節ごとに、火星シアターにかける。』……だ、そうです。' },
  { t: 'say', who: 'KIMORIN', text: '……どこへでも、ですか。' },
  // サングラスを、指で押し上げる
  { t: 'say', who: 'KIMORIN', text: '……では、私は、まず、天王星の空き棚から。' },
  // 手紙が閉じる。スクリーンの中に、黒い球。OBOLON
  { t: 'bgm', track: 'obolon' },
  { t: 'sprite', image: ['obolon', 'kimorin-sun'] },
  { t: 'say', who: 'OBOLON', text: '{neo}。、、、星が、灯ってきたな。', hold: true },
  { t: 'say', who: 'OBOLON', text: '灯りが、増えるほど、、、obolo は、近くなる。', hold: true },
  { t: 'say', who: 'OBOLON', text: 'oboloとは、、、', hold: true },
  // 黒い球の後ろに、日食のような金の光の輪が、ちらりと広がる
  { t: 'se', sound: 'gong' },
  { t: 'bgm', track: 'monban' },
  { t: 'sprite', image: null },
  { t: 'screen', open: true },
  { t: 'say', who: 'MONBAN', text: 'おい待て、そこまでだ。' }, // スクリーンの中
  // スクリーンが、ぷつり、と閉じる
  { t: 'se', sound: 'blip' },
  { t: 'screen', open: false },
  { t: 'bgm', track: 'ending' },
  { t: 'sprite', image: ['@bati', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……また、そこまで、でしたね。' },
  { t: 'say', who: 'バティ', text: 'いつか、聞けるよ。' },
  { t: 'sprite', image: null },
  // 窓の外。土星のコロリン、木星の蝶、水星の船、火星のUFO、金星の電波、天王星の店の窓、冥王星の空の灯り、海王星のネオン
  { t: 'motes', count: 60 },
  { t: 'caption', text: 'ここから先は、自由に' },
  { t: 'motes', count: 0 },
  { t: 'notice', text: 'どの星へも、好きな順で行けます（星への門は1日88分。月の工房・Bluena・ダチとの通信は、いつでも）。新しい星の物語（特別なアニメ）は、季節ごとに火星シアターに届きます' },
  { t: 'set', key: 'f_m_end_seen', value: 'true' },
  { t: 'end' },
];

/** the days after joining, in the order of shared LAP2 (the end plays the same day as Neptune) */
export const AFTER_DAYS: Step[][] = [M_URANUS, M_PLUTO, [...M_NEPTUNE, ...M_END]];
