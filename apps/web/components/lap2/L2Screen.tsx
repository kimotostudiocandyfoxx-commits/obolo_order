'use client';

import { useState } from 'react';
import type { L2What } from '@/lib/onboarding/lap2';

/**
 * The second journey's screens ({ t: 'l2', what } — review/L2_*.md 〔画面〕). Each one shows what the script
 * describes and returns what was decided (merged into the story's answers, so later branches and the saved
 * chapter see it). This is the first pass: the panels and choices of the script, in the app's voice-first
 * layout; the full makers (jacket, island, theatre, booth, goods, the game) grow into them one by one.
 */
type Option = { label: string; answers?: Record<string, string>; then?: Panel };
type Panel = { title?: string; image?: string; caption?: string; body?: string[]; options: Option[] };

const OK = (label = 'つぎへ', answers?: Record<string, string>): Option => ({ label, answers });

const PANELS: Record<L2What, Panel> = {
  ask: {
    title: '💬 バティに聞く',
    body: ['知りたいことを話すと、バティが調べて答えます。', '（例）「土星の輪って、何でできてるの？」', 'バティ「氷と、石のかけらが、いっぱい集まってるんだって！」', 'バティの答えが、まちがっていることもあります。大事なことは、自分でも確かめてね'],
    options: [OK('つぎへ', { ask: 'ask' })],
  },
  relook: {
    title: '水盤',
    body: ['水盤のまん中に〔🎙 話してみよう〕。変えたいところや足したいものを話すと〔描く〕が光ります（色・髪・服・持ち物・翼など。現実にない姿でもいい）。', '描く前に、マナを使うか確認が出ます。4枚から選び、1回だけ要望を言って描き直せます。'],
    options: [OK('この姿にする', { look: 'change' }), OK('やめて今の姿のまま', { look: 'stay' })],
  },
  'dachi-rules': {
    body: [
      'ダチになれるのは、〔招待状〕でつながった人（招待した人・招待してくれた人。招待状を送る時はマナジェムを添えます）と、〔名前で探す〕で見つけて、おたがいに承認した人。物語の仲間（KIMORIN⭐︎たち）とも、ダチになれます（連絡はできません）。',
      '〔名前で探す〕は15歳から使えます。',
      '知らない人からダチの申しこみが来ても、承認しなくてかまいません。断っても、相手には知らせません',
    ],
    options: [OK()],
  },
  invite: {
    title: '✉ 招待状',
    options: [
      {
        label: '招待状を書いてみる',
        then: { title: '招待状の一言', body: ['まん中の〔🎙 話してみよう〕で一言。〔おまかせ〕〔パス〕も。', '下書きは{neo}だけに保存されます。まだ誰にも送りません'], options: [OK('下書きのまま残す', { invite: 'draft' })] },
      },
      { label: '🔍 名前で探す', answers: { invite: 'search' }, then: { body: ['15歳未満の人は、名前で探しても出てきません。', 'ダチを申しこむ／やめる。相手も承認すると、ダチになります'], options: [OK('やめる', { invite: 'search' })] } },
      { label: '今はいい', answers: { invite: 'skip' }, then: { caption: 'たこ焼きシスター「招きたい人ができたら、その時でいいワ。」', options: [OK()] } },
    ],
  },
  plaza: {
    title: '＋ ひろばをつくる',
    options: [
      {
        label: '広場を作る',
        then: {
          body: ['どんな話をする場所？　まん中の〔🎙 話してみよう〕。言ったことが、そのまま看板の名前になります（あとから変えられます）。', 'たこ焼きシスター「最初は自分だけでもいい。誰かを迎えるのは、あとで決めましょう。」', '入れる人：〔わたしだけ〕（はじめはこれ）'],
          options: [OK('このひろばをつくる', { plaza: 'make' }), OK('もどる', { plaza: 'later' })],
        },
      },
      { label: '今はいい', answers: { plaza: 'later' }, then: { caption: 'たこ焼きシスター「話したいことができたら、その時に作ればいいワ。」', options: [OK()] } },
    ],
  },
  jacket: {
    title: '🥚 アートをつくる',
    body: ['思い描いたまま、まん中の〔🎙 話してみよう〕。〔おまかせ〕（行ってみたい場所／まだない曲のジャケット／夢で見たもの）〔パス〕。', 'アートは〔写真を添える〕〔{bati}に描いてもらう〕〔字だけ〕から。{bati}に描いてもらう時だけ、描く前にマナを使うか確認が出ます。'],
    options: [OK('🔒 根っこにしまう', { jacket: 'keep' }), OK('🦋 投稿する（ダチへ）', { jacket: 'send' })],
  },
  'kimorin-jacket': {
    image: '/onboarding/s/kimorin-dragon.jpg',
    caption: '『ブラタゴンと、月で、お茶を』　@KIMORIN⭐︎',
    body: ['黒い虎じまのドラゴンの背中で、丸いサングラスの白い狐が、ティーカップを片手に月のまわりを飛んでいる。'],
    options: [OK()],
  },
  'kimorin-tree': { image: '/onboarding/s/jupiter-forest.jpg', caption: 'KIMORINのアトリエ。看板『宇宙一の天才発明』', options: [OK()] },
  'my-tree': { image: '/onboarding/s/jupiter-forest.jpg', caption: '丘のてっぺん、{neo}のアトリエ', options: [OK()] },
  'tree-deco': { title: '🎨 アトリエを飾る', body: ['部品の札を話して変え、入口の看板を〔🎙〕で言って〔飾る〕。'], options: [OK('飾る', { tree: 'deco' })] },
  'my-island': { image: '/onboarding/s/mercury-ice.jpg', caption: '{neo}の島。浜に、一周目にしまった曲のレコード', options: [OK()] },
  'kimorin-song2': { image: '/onboarding/s/mercury-port.jpg', caption: '帆に『KIMORIN⭐︎』の船。真っ白なジャケットのレコード、ラベルに『2』', options: [OK('▶ 聴く')] },
  'place-song': {
    title: '曲を置く',
    options: [
      OK('自分の曲を置く', { place: 'mine' }),
      { label: '新しく一曲作って置く', then: { body: ['フリージー「作るなら、話してみろ。今日の言葉で、一曲だ。」', '〔♫+ 作曲〕まん中に〔🎙 話してみよう〕。作曲の前に、マナを使うか確認が出ます。'], options: [OK('曲を置く', { place: 'new' })] } },
      OK('KIMORINの『2』を置く', { place: 'kimorin' }),
      OK('今は置かない', { place: 'none' }),
    ],
  },
  'theme-island': {
    title: 'どんな曲が流れる島？',
    body: ['まん中の〔🎙 話してみよう〕。〔おまかせ〕（雨の日の曲だけ／眠る前の曲／友達と聴いた曲の島）〔パス〕。', '形・浜・灯りを選んで〔この島にする〕。'],
    options: [OK('この島にする', { island: 'theme' })],
  },
  'island-deco': { title: '🏝️ 島を飾る', body: ['形・浜・灯り・名前から、変えたいものを選んで〔飾る〕。'], options: [OK('飾る', { island: 'deco' })] },
  'kimorin-island': { image: '/onboarding/s/arr-mercury-sea.jpg', caption: '沖に、ブラタゴン島。黒い岩に金色の虎のしま、背中に火山', options: [OK()] },
  relay: { caption: 'KIMORINのコロリン三つが、順番に歌ってつながる', options: [OK()] },
  'kimorin-ten': { image: '/onboarding/s/mars-screens.jpg', caption: 'KIMORINの十秒。扇の尾をばさっ。画面が少し傾いている', options: [OK()] },
  theater: {
    title: '上映館のテーマ',
    body: ['まん中の〔🎙 話してみよう〕。〔笑える映像だけ〕〔眠る前に見たい映像〕〔自分の作った映像だけ〕〔まだ決めない〕。'],
    options: [
      {
        label: '幕を上げる',
        then: {
          caption: '上映館ができた',
          body: ['①〔一本目を置く〕自分の映像か、ダチが届けてくれた映像から一本。新しく撮って置くこともできます（撮る時は、マナを使います）。', '②〔もう一本置く〕で足して、〔並べる順を決める〕。', '③〔ダチに見せる〕見せる相手はダチだけ。押さなければ、上映館は{neo}だけのものです'],
          options: [OK('ダチに見せる', { theater: 'show' }), OK('今は、自分だけ', { theater: 'private' })],
        },
      },
    ],
  },
  booth: {
    title: '奥のブース',
    body: ['①右のレコードの、入りたい所を押して〔印〕', '②〔SYNC〕を押す', '③真ん中のつまみを、右へ。ゆっくりでも、すっとでもいい', '④〔映像を選ぶ〕', '⑤〔あかり〕を押すと、ステージの光の色が変わります'],
    options: [OK('つないだ', { l2_synced: 'yes' })],
  },
  'kimorin-mix': { image: '/onboarding/s/venus-night.jpg', caption: '『漆黒の黙示録ミックス』　どぉん……。……どぉん……。', options: [OK()] },
  goods: {
    title: '🎨 天空のアトリエ',
    body: ['①形を選ぶ〔Tシャツ〕〔マグカップ〕〔アクリルスタンド〕〔ステッカー〕〔缶バッジ〕〔トート〕〔おまかせ！〕', '②のせる絵を選ぶ（自分のジャケットや作品。新しく描く時は〔🎙 話してみよう〕。描く時は、マナを使う前にたずねます）', '③ハンドルを回すと、見本が浮かぶ　④〔自分のアトリエに飾る〕。見本だけでは、注文も支払いもしません'],
    options: [OK('一つ作って、自分のアトリエに飾る', { goods: 'display' }), OK('作って、見本を見るだけ', { goods: 'enough' }), OK('今は作らない', { goods: 'none' })],
  },
  'kimorin-mug': { caption: '『封印されし黒虎竜の聖杯　——素手で触れるな』', body: ['黒地に虎じまのブラタゴン島がぐるりと一周。どちらから飲んでも、目が合う。'], options: [OK()] },
  shop: {
    title: '🏪 obolo商店',
    body: ['たこ焼き柄のトートバッグ。作った人・素材・大きさ・『受注生産：注文が入ってから作って届けます。届くまで日数がかかります』', '〔購入〕を押した時だけ、買う画面が開きます（月額88円とは別の料金。マナは使いません）。'],
    options: [OK('札を閉じる')],
  },
  game: {
    title: '『キモリンの帰り道』',
    body: ['じいちゃんに、土産話を届けよう', '分かれ道。立て札：『←坂の道』『川の道→』『まっすぐ：たこ焼き屋の前』'],
    options: [
      { label: '坂の道', answers: { road: 'slope' }, then: { caption: '細い坂のまん中に、猫が寝ている。しゃがんで待つ。猫があくびして、どく', options: [OK('じいちゃんの家へ')], body: ['じいちゃん「おかえり。で、どこから話す？」', 'KIMORIN「坂の猫の話から！」'] } },
      { label: '川の道', answers: { road: 'river' }, then: { caption: '橋のまん中で、川面に夕日がゆれている', options: [OK('じいちゃんの家へ')], body: ['じいちゃん「おかえり。で、どこから話す？」', 'KIMORIN「川の夕日の話から！」'] } },
      { label: 'たこ焼き屋の前', answers: { road: 'tako' }, then: { caption: '店主が、一個おまけしてくれる', options: [OK('じいちゃんの家へ')], body: ['じいちゃん「おかえり。で、どこから話す？」', 'KIMORIN「おまけのたこ焼きの話から！」'] } },
    ],
  },
  'round-cards': { title: 'ひと巡り', body: ['月・土星・木星・水星・火星・金星・天王星・海王星。作ったものだけが、カードになって並ぶ。'], options: [OK()] },
  route: { title: '地図', body: ['地球→月→土星→木星→水星→火星→金星→天王星→海王星→地球'], options: [OK()] },
  switchboard: { title: '連絡室', body: ['壁一面の古い交換台。まん中に{neo}の名札。隣に『ダチ　KIMORIN⭐︎』『ダチ　{inviter}』。'], options: [OK()] },
  comms: {
    title: '連絡室の机',
    options: [OK('ダチに連絡する', { comms: 'dachi' }), OK('名前で探して、ダチを申しこむ', { comms: 'search' }), OK('招待状を書く・贈る', { comms: 'invite' }), OK('今は何もしない', { comms: 'none' })],
  },
};

export function L2Screen({ what, fill, onDone }: { what: L2What; fill: (s: string) => string; onDone: (answers: Record<string, string>) => void }) {
  const [panel, setPanel] = useState<Panel>(PANELS[what]);
  const [got, setGot] = useState<Record<string, string>>({});
  const pick = (o: Option) => {
    const a = { ...got, ...o.answers };
    if (o.then) {
      setGot(a);
      setPanel(o.then);
    } else onDone(a);
  };
  return (
    <div className="absolute inset-0 z-[12] flex items-end justify-center bg-black/55 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div key={JSON.stringify(panel.options.map((o) => o.label))} className="w-full max-w-md animate-[fadeUp_0.5s_ease-out] rounded-3xl border border-amber-100/25 bg-[#0d0b18]/95 p-5 text-amber-50 shadow-[0_0_40px_rgba(255,200,120,0.18)]">
        {panel.title && <p className="text-center text-[15px] font-bold tracking-wider">{fill(panel.title)}</p>}
        {panel.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={panel.image} alt="" className="mt-3 aspect-video w-full rounded-xl object-cover" />
        )}
        {panel.caption && <p className="mt-3 text-center text-[14px] leading-relaxed">{fill(panel.caption)}</p>}
        {panel.body?.map((b, k) => (
          <p key={k} className="mt-2 text-[13px] leading-relaxed text-amber-50/80">
            {fill(b)}
          </p>
        ))}
        <div className="mt-4 flex flex-col gap-2">
          {panel.options.map((o) => (
            <button key={o.label} onClick={() => pick(o)} className="rounded-full border border-amber-200/50 bg-amber-200/10 py-3 text-[14px] tracking-wider active:scale-[0.98]">
              {fill(o.label)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
