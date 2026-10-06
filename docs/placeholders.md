# 仮（PLACEHOLDER）一覧

仕様書 `docs/spec.md`（v1.7.1）で **OPEN / PLACEHOLDER / 未決定** の部分は、すべて「仮」で実装しています。
コード内では `PLACEHOLDER (P-XXX-n)` というコメントで場所を示しています。
差し替えるときは、ID でコードを検索してください（例: GitHub で `P-MOON-1` を検索）。

| 状態 | 意味 |
|---|---|
| 🟡 仮実装 | 動くけれど、仮の値・仮の仕組み |
| ⚪ 未実装 | 画面に「準備中」と表示しているだけ |
| 🔴 本番前に必須 | ローンチ前に必ず差し替える |

## 1. 認証・アカウント

| ID | 状態 | 内容 | 現在の仮実装 | 差し替え場所 |
|---|---|---|---|---|
| P-AUTH-1 | ⚪ | パスキー（WebAuthn）ログイン（仕様 §4.2） | メール＋6桁コードのみ。正式ドメイン決定後に追加 | `apps/api/src/auth/` |
| P-AUTH-2 | 🔴 | メール送信サービス | 送信せずログに出すだけ。`AUTH_DEMO_SHOW_CODE=true` で画面にコードを表示（デモ用）。Resend 用の仮アダプタあり | `apps/api/src/infra/email.ts`、環境変数 |
| P-AUTH-3 | 🔴 | 未成年の保護者同意・利用上限（OPEN #5） | 未対応 | 法務レビュー後 |

## 1.5 招待制・オンボーディング（2026-10-04 追加決定）

**決定事項**：OBOLO ORDER は**完全招待制**。URL を開くと全員まずメールアドレスを入力 → 招待されたアドレスなら1日目へ、ORDERならその人の続きへ、それ以外は入れない。1日目の物語で OBOLON に名前を伝えた時点でアカウントが作られる。動画はスキップ不可、会話はタップで進む。

**8日間の旅**（`packages/shared/src/journey.ts`）：1日目 招待状・本部 → 2日目 もう一度招待状・KIMORIN・宇宙行きに同意 → 3日目 宇宙行きの切符・KIMORINと月へ・月の案内人OBOLON・プロフィールとバティを作る → 4日目 土星・たこ焼きブラザー＆シスター・声のTwitterを教わり投稿 → 5日目 木星 → 6日目 水星 → 7日目 金星 → 8日目 火星 → 「ORDERになるか？」（決済）→ 太陽系。各日の終わりに「〇〇、また明日。」の24時間カウントダウン（「明日まで待てへん」でスキップ可）。

| ID | 状態 | 内容 | 現在の仮実装 | 差し替え場所 |
|---|---|---|---|---|
| P-OB-1 | 🟡 | 5〜8日目の物語（台本・動画）※2〜4日目は組み込み済み | 未着。仮画面で「その日の流れ（クライアントの箇条書き）」を表示し、「（仮）DAY n を体験したことにする」で次へ進める。プロフィール作成（3日目）・バティ作成（3日目）・土星の投稿（4日目）の組み込みもこの日の台本が届いてから | `components/onboarding/JourneyDayScreen.tsx` |
| P-OB-2 | 🟡 | 台本の解釈が必要だった箇所 | ①「門開（モーション11）」はボタンなしで自動再生 ②「やめておく」→ OBOLON「そうか。」→ MONBAN の締め（「おい！待て！」「喋りすぎた」は省略）③ モーション8・18・20〜26は台本で未使用 ④ 台本の「OBLON」は「OBOLON」に統一 ⑤ モーション6には「本部に到着しました」が動画内に入っているため、画面上の字幕は出さない | `apps/web/lib/onboarding/day1.ts` |
| P-OB-3 | 🟡 | 「また明日」の待ち時間と「明日まで待てへん」 | 1日目終了から24時間のカウントダウン。「明日まで待てへん」で何度でも無料でスキップでき、スキップしたことはその端末にだけ記録（2日目を作るときにサーバー側へ移す。将来 MANA 消費にする案もあり） | `components/onboarding/TomorrowScreen.tsx`、`lib/onboarding/progress.ts` |
| P-OB-9 | 🟡 | カウントダウン・時計演出の音 | ブラウザ内で合成（時計のチクタク・低い持続音・加速するチクタク＋上昇音＋鐘）。専用の効果音を作ったら差し替え | `lib/onboarding/sfx.ts` |
| P-OB-4 | 🟡 | 動画の配信元 | Web アプリ内（`apps/web/public/onboarding/`）に圧縮版を置いている。本番は Bunny CDN へ（`NEXT_PUBLIC_ONBOARDING_MEDIA_BASE`） | `scripts/encode-onboarding.sh`、`lib/onboarding/media.ts` |
| P-OB-5 | 🟡 | 招待状の招待者名 | モーション4の動画に「KIMORIN 木元駿之介」が焼き込まれているため、誰が招待しても動画上はKIMORIN。セリフ中の（招待者名）は実際の招待者になる。**名前なしの招待状動画**をもらえれば、名前を画面上に重ねて表示できる | — |
| P-OB-6 | ⚪ | 物語の英語版 | 台本は日本語のみ（英語表示でも日本語） | `lib/onboarding/day1.ts` |
| P-OB-7 | ✅ | 1日目のモーションはすべて届いて組み込み済み（19は17の直後に追加）。今後のモーションが未着のときは | 「MOTION n（動画準備中）」の仮画面を表示（再生系は約2.6秒で次へ）。届いたら `AVAILABLE_MOTIONS` に番号を足すだけ | `lib/onboarding/media.ts` |
| P-OB-8 | 🟡 | BGM の区間と音量 | ✅ 区間はクライアント指示で確定：オープニング（`bgm-opening`）＝最初〜本部到着、MONBANのテーマ（`bgm-monban`、元「VIDEO11」の曲）＝MONBAN登場（モーション7）〜／最後の再登場〜、OBOLONのテーマ（`bgm-obolon`、元「OBOLO」の曲）＝OBOLON登場（モーション13）〜。音量：動画の音・BGMとも −16 LUFS に揃え（`scripts/normalize-audio.sh`、新しい動画は `encode-onboarding.sh` が自動で揃える）、BGMは MONBAN の曲 1.0・ほか 0.9（動画の音とほぼ同じ大きさ）。iPad の消音スイッチがオンでもBGM・演出音が鳴るよう Audio Session を「再生」に設定（iOS 16.4 未満は通常の音声再生に自動切替）。全体に音割れ防止のリミッター | `lib/onboarding/day1.ts`（`bgm` の行）、`lib/onboarding/media.ts`（`BGM_VOLUME`） |
| P-INV-4 | 🟡 | デモモードの入口 | API 未接続のデモでは**どのメールアドレスでも KIMORIN からの招待扱い**で入れる（運営なしで通しテストできるように）。本番 API では招待のないアドレスは拒否 | `lib/api/demo.ts` |
| P-BILL-2 | 🟡 | 9日目「エクリプス」の決済（月88円） | Stripe 接続済み（埋め込み Checkout、物語の中で支払い→そのまま続く）。**キーを入れるまではデモモード**（請求なしで ORDER になる）。キーの入れ方は deploy.md「Stripe」 | `apps/api/src/billing/`、`components/onboarding/EclipsePay.tsx` |
| P-BILL-3 | ✏️ | 支払い画面の説明文 | 「毎月自動で更新されます。解約はいつでもでき、次の更新日から請求が止まります。」と特典3行は Claude の仮。特定商取引法の表示（事業者名・解約方法など）はクライアント確認が必要 | `components/onboarding/EclipsePay.tsx` |
| P-BILL-4 | 🔴 | 解約・支払い方法の変更 | まだ画面がない。当面は Stripe ダッシュボードで運営が対応（次は Stripe のカスタマーポータルをつなぐ予定）。Webhook を設定すれば解約・支払い失敗が `subscription_status` に反映される | `apps/api/src/billing/billing.service.ts` |
| P-OB-10 | 🟡 | 2日目の台本で解釈した箇所 | ①［認証］＝2日目の最初にメールアドレス＋確認コードを入れ直す（デモではコード自動入力） ②「承諾しない」「話さずに帰る」「やめておく」の後の流れが未記載のため、短いセリフのあと同じ選択肢に戻す ③「OBOLON『そう来なくっちゃ』（2モーション9）」はセリフ→2-9の順 ④ 2モーション9は送信上限（30MB）のため 480×854 の低画質版で組み込み済み（高画質版に差し替え可） ⑤ 2-2の招待状の文字は動画内のもの（台本の「昨日いなかったケン！」とは異なる） ⑥ BGMは1日目と同じ割当（オープニング→MONBAN→OBOLON）で、KIMORINが話す動画（2-9）の前にフェードアウト | `apps/web/lib/onboarding/day2.ts` |
| P-OB-11 | 🟡 | 3日目の台本（前半）で解釈した箇所 | ①「・宇宙行き切符」は3モーション1の中に含まれていると判断（3モーション2・5は台本に出てこず未着） ②「宇宙に行く」「やめておく」のどちらでも KIMORIN「宇宙なめんな。」に進む ③ 台本が「創って創って創りまくって…」で終わっているため、そこで「新しい姿の創造（準備中）」を出して3日目を終える（アバター作成・月・OBOLON・プロフィール・バティは続きの台本待ち） ④ BGM指定なし：オープニングの曲を KIMORIN の場面の前まで ⑤ KIMORIN の画像（画像1/2/3/8）は背景ループ（3-7）の上に重ねて表示 | `apps/web/lib/onboarding/day3.ts` |
| P-OB-12 | ✏️ | 3日目後半（Claude の仮のセリフ） | KIMORIN が OBOLO NEO を説明 → 8つの姿から選ぶ → ネオの名前を入力（表示名が変わる）→ 明日は土星へ。バティ作成は会員になった後の「2回目の月の神殿」に移動（クライアント決定） | `apps/web/lib/onboarding/day3.ts` |
| P-NEO-1 | ✏️ | OBOLO NEO の8つの姿 | 名前・ひとこと・色は仮。画像は絵文字の仮エンブレム（`neo-<id>.webp` を置くと自動で差し替え） | `packages/shared/src/neo.ts` |
| P-OB-13 | ✏️ | 4日目（土星） | クライアントの要点（原石の星／文字だけだと伝わらない…）をブラザーとシスターに振り分け、KIMORIN が友達として2人を紹介するセリフ、自己紹介・チュートリアル・締めのセリフは Claude の仮。ブラザーとシスターの登場動画は未着（4-2 は仮画面 → 神殿の静止画に2人を重ねて表示）。BGMは月→土星までオープニング、ころりんの前で消す | `apps/web/lib/onboarding/day4.ts`、`components/saturn/SaturnTutorial.tsx` |
| P-OB-14 | ✏️ | 5日目（木星） | 大根カイザーの説明はクライアントのセリフどおり（語尾「DA」を付加）。KIMORIN が同行して友達のカイザーを紹介するセリフ、「土星で目を覚ました」、自己紹介（「我こそは木星の王」）、チュートリアル・締めのセリフは Claude の仮。動画 5-1（土星→木星）と 5-2（木星の神殿へ）は未着で仮画面。大根カイザーは届いた1枚絵（jupiter-kaiser.jpg、縦に切り出し）を背景に表示 | `apps/web/lib/onboarding/day5.ts`、`components/jupiter/JupiterTutorial.tsx` |
| P-OB-15 | ✏️ | 6日目（水星） | フリージーと KIMORIN の説明はクライアントのセリフどおり。「木星で目を覚ました」、着陸後の KIMORIN、フリージーの紹介、「ある／ない」への返事（ある→「ほう、なかなかやるな。」、ない→「そうか。なら今日が、はじめての日だ。」）、締めは Claude の仮。動画 6-1（ロケットで水星へ）・6-2（海に浮かぶ島に着陸）・6-3（水星の神殿へ）は未着で仮画面 | `apps/web/lib/onboarding/day6.ts` |
| P-OB-16 | ✏️ | 7日目（火星） | KIMORIN とヒポキンの説明はクライアントのセリフどおり。「水星で目を覚ました」、着いた後の KIMORIN、ヒポキンの紹介、締めは Claude の仮。動画 7-1（ロケットで火星へ）・7-2（未来都市へ）は未着で仮画面。金星は8日目に後回し（クライアント 2026-10-05） | `apps/web/lib/onboarding/day7.ts`、`packages/shared/src/journey.ts` |
| P-OB-17 | ✏️ | 8日目（金星） | KIMORIN とゴリラの説明はクライアントのセリフどおり。ゴリラ3人へのセリフの割り振り、「火星で目を覚ました」、着いた後の KIMORIN、紹介、締め（「明日は太陽の神殿」）は Claude の仮。動画 8-1 は未着。3人の絵はクライアントの絵（longg/hatg/bossg.webp）。金星の背景はまだ自動で描いた仮（venus-market.jpg） | `apps/web/lib/onboarding/day8.ts` |
| P-OB-19 | ✏️ | 9日目（エクリプス） | 流れと KIMORIN・MONBAN のセリフはクライアントの台本どおり（2026-10-06）。「金星で目を覚ました」「{bati}の元気がない」、ボタン名、KIMORIN の事情説明の一言、選択肢「もう少し考える」と MONBAN の返事は Claude の仮。地球へ戻るロケットの動画 9-1・太陽へ発射する動画 9-2 は未着（本部は1日目の動画 6・7・9 を再利用）。元気のないバティは画像を暗く傾けて表現。太陽の神殿の背景（sun-temple.jpg）と OBOLON の立ち絵（obolon.webp、動画13の姿を描き起こし）は Claude が描いた仮。「太陽の神殿に着いた」「地球の結社に帰ってきた」も仮。9日目の後も「また明日」のカウントダウンがあり、明けると ORDER（太陽系）へ。バティがマナを受け取って進化する場面は台本待ち | `apps/web/lib/onboarding/day9.ts` |
| P-OB-18 | ✏️ | 3日目の姿づくり・たまご／4日目の誕生 | 流れはクライアント決定（2026-10-05：画像から＋オリジナルにする2つの質問＋描き直し3回）。KIMORIN の質問の言い回し・選択肢、待ち時間・たまご・誕生のセリフ、バティの最初のひとこと（「うれしい！よろしくね」）は Claude の仮。4日目の冒頭は月の神殿の静止画（m3-7.jpg）に、絵で描いたたまご | `lib/onboarding/day3.ts`、`day4.ts`、`components/onboarding/LookMaker.tsx`、`BatiSteps.tsx` |
| P-AI-3 | 🟡 | 画像生成（ネオの姿・バティ） | Gemini の画像モデル（既定 gemini-2.5-flash-image、変数 GEMINI_IMAGE_MODEL）。絵柄の指示は仮。キーが無い・失敗したときは、ネオは用意した8つの姿、バティは絵文字で描いた仮の姿。デモモード（API 無し）では、絵文字と色で描いた仮の絵 | `packages/ai/src/images.ts`、`apps/api/src/look/`、`apps/web/lib/look.ts` |
| P-MARS-1 | 🟡 | 火星の画面（星図・スタジオ） | クライアントのデザインどおりに実装（街中／郊外の2パターン）。絵はデザイン画から切り出したもの。描かれたタイトル・カードの上に本物を重ねている。正式な素材（文字・カードの入っていない背景、UFO）が届いたら差し替え | `components/mars/MarsWorld.tsx`、`public/onboarding/mars-*.jpg`、`pod-*.webp` |
| P-MARS-2 | 🟡 | 火星のデータと再生 | 8人の映像はサンプル。本物の動画はまだなく、サムネイル＋シーンの字幕＋BGM の仮の再生。自分のスタジオ・ロッカー・見た目の設定はこの端末だけに保存 | `lib/mars/sky.ts`、`lib/mars/state.ts`、`components/mars/Frame.tsx` |
| P-MARS-3 | ✏️ | 火星の撮影 | 作曲と同じ仮組み：KIMORIN（バティができたらバティ）に話しかけると映像になるチャット。映像はその場で作る仮のもの | `components/mars/ShootChat.tsx`、`lib/mars/make.ts` |
| P-VENUS-1 | 🟡 | 金星の画面 | クライアントのデザイン待ち。いまは ショップ／つくる／自分の店 の仮の画面 | `components/venus/VenusWorld.tsx` |
| P-VENUS-2 | 🟡 | 金星のデータと星 | グッズ12個はサンプル（絵文字）。星はデモでは88から。自分の店・コレクション・星はこの端末だけに保存。店を開いている間、ときどき誰かが買ってくれる（デモの演出） | `lib/venus/shop.ts`、`lib/venus/state.ts` |
| P-VENUS-3 | ✏️ | 金星のつくる | 作曲・撮影と同じ仮組み：KIMORIN（バティができたらバティ）に話しかけるとグッズになるチャット | `components/venus/VenusWorld.tsx`、`lib/venus/make.ts` |
| P-MER-1 | 🟡 | 水星の画面（海・島） | クライアントのデザイン（第2版）どおりに実装。海・船・島・宝箱の絵はデザイン画から切り出したもの。正式な素材（文字なしの海、船、島の種類）が届いたら差し替え。作曲画面は次のデザイン待ち | `components/mercury/MercuryWorld.tsx`、`public/onboarding/mercury-*.jpg`、`ship-*.webp`、`chest-*.webp` |
| P-MER-2 | 🟡 | 水星のデータ | 船8人とその曲はサンプル（絵文字のレコード、音はシンセ）。自分のデモ曲3つはデザイン画のレコード。自分の島・星はこの端末だけに保存。友達の島へ行く入口はまだない | `lib/mercury/sea.ts`、`lib/mercury/state.ts` |
| P-MER-3 | 🟡 | 水星の作曲 | **会話と曲の設計図は本物のAI（Gemini）**：パートナー（KIMORIN／バティ）と話す → ジャンルを選ぶ → 曲名・歌詞（ひらがな付き）・コード・テンポ・メロディ（1音ずつ）ができる。試し聴きはブラウザのシンセでメロディとコードを鳴らすだけ。**伴奏（MusicGen）と歌（DiffSinger）はまだ**（GPUサーバー待ち）。デモモードでは従来の仮の作曲 | `apps/api/src/compose/`、`packages/ai/src/song.ts`、`components/mercury/ComposeChat.tsx` |
| P-JUP-1 | 🟡 | 木星（パタパタ）の画面 | クライアントのデザイン（空・木）どおりに実装。蝶と木の絵はモックから切り出したもの。正式な素材（蝶の絵、写真・文字なしの木）が届いたら差し替え | `components/jupiter/PatapataWorld.tsx`、`public/onboarding/bf-*.webp`、`jupiter-tree.webp` |
| P-JUP-2 | 🟡 | 木星のデータ | 住人12人と投稿はサンプル（絵文字の写真）。自分の根っこ・投稿はこの端末だけに保存（サーバー未対応） | `lib/jupiter/residents.ts`、`lib/jupiter/state.ts` |
| P-JUP-3 | 🟡 | 8秒を超える動画 | 拒否せず、最初の8秒をくり返し再生。切り出し画面はまだない | `components/jupiter/PostCircle.tsx` |
| P-JUP-4 | ✏️ | 枝・実・加工 | 枝は4つ固定（旅行・ごはん・おさんぽ・おまつり：絵に描かれた札）。「実」は数字だけ。加工は5種類の色フィルター＋ひとこと | `lib/jupiter/residents.ts`、`lib/jupiter/state.ts` |
| P-VOICE-1 | ✏️ | ネオの声（読み上げ） | 端末の読み上げ機能で、7つの読み方（元気に／ゆっくり／早口／低い声で／高い声で／ささやき風／叫ぶ風）× ネオの姿ごとの声の高さ。本物のささやき・叫びは出せないので「〜風」。将来は Gemini などの表現力のある音声生成をサーバーで行い、音声ファイルにする（読み方の種類はそのまま） | `packages/shared/src/neoVoice.ts`、`apps/web/lib/audio.ts` |
| P-SAT-3 | ✏️ | ころりんのアイコンの絵 | 丸い体＋顔＋ネオの姿のバッジ（SVGの仮絵） | `components/saturn/BallAvatar.tsx` |
| P-SAT-4 | ✏️ | ころりんのサンプル住人 | 投稿が少ないうちは12人のサンプル住人で賑やかに見せる（声はブラウザの読み上げ） | `lib/saturnResidents.ts` |
| P-INV-1 | 🟡 | 1人が招待できる人数 | 30日で10人まで | `apps/api/src/invites/invites.service.ts` |
| P-INV-2 | 🟡 | 招待の有効期限 | 14日 | 環境変数 `INVITE_TTL_DAYS` |
| P-INV-3 | 🟡 | 未登録メールでのログイン | 「招待制です」とはっきり表示（＝登録の有無が分かってしまう）。メール送信を入れたら黙って「送信しました」にする | `apps/api/src/auth/auth.service.ts` |
| — | 🔴 | 最初の招待状の発行 | 運営用 API `POST /admin/invites`（環境変数 `ADMIN_TOKEN` が必要）。発行画面はまだない。デモモードでは `/invite/demo` がいつでも使える | — |

## 2. 月（バティ）

| ID | 状態 | 内容 | 現在の仮実装 | 差し替え場所 |
|---|---|---|---|---|
| P-MOON-1 | 🟡 | バティの正式キャラクター設定・見た目（OPEN #2） | 「明るく親しみやすい相棒」の仮人格、月に顔を描いた仮アバター | `packages/ai/src/prompts/bati.ts`、`apps/web/app/moon/MoonView.tsx`（`BatiFace`） |
| P-MOON-2 | 🟡 | 1日の無料枠のリセット時刻 | 日本時間 0:00 | `packages/shared/src/config.ts`（`QUOTA_TIMEZONE`） |
| P-MOON-3 | 🟡 | 長期記憶の要約タイミング | 10メッセージごとにバックグラウンドで要約 | `packages/shared/src/config.ts` |
| — | 🟡 | 無料枠超過時の 1 MANA/通 課金 | デモでは課金しないため、30通/日で停止（`BUDDY_OVERAGE_ENABLED=false`）。ロジックは実装・テスト済み | 環境変数 |
| — | ⚪ | バティの音声返答（ユーザーの声・キャラ声） | 未実装（フェーズ4） | — |

## 3. 土星

| ID | 状態 | 内容 | 現在の仮実装 |
|---|---|---|---|
| P-SAT-1 | 🟡 | 録音の最大長・最大サイズ | 60秒 / 3MB |
| P-SAT-2 | 🟡 | タイムラインの並び順・フォロー | 全員の投稿を新しい順に表示。フォロー・返信・リポストは未実装 |
| — | ⚪ | クローン音声での投稿（1 MANA） | フェーズ4 |

## 4. お金・MANA

| ID | 状態 | 内容 | 現在の仮実装 |
|---|---|---|---|
| P-WALLET-1 | 🟡 | 月額 88 MANA の付与 | サブスク未接続のため、**新規登録時に 88 MANA を1回だけ付与**（台帳理由 `demo_grant`） |
| P-MER-5 | 🔴 | 伴奏のAIモデル | いまは MusicGen-Melody（large）。**MusicGen の学習済みモデルは非商用ライセンス（CC-BY-NC）**なので、有料公開の前に商用OKのモデル（ACE-Step など）に替える。`MUSIC_MODEL` で切り替える作り | `gpu/music/app.py` |
| P-MER-4 | ✏️ | 作曲の回数 | 1人1日20曲まで（MANA での料金は未決） | `apps/api/src/compose/compose.controller.ts` |
| P-MEDIA-3 | ✏️ | 動画の長さの上限 | 既定60秒（木星は8秒）。火星の動画の最大の長さはクライアント未決 | `packages/shared/src/config.ts`（`MEDIA_POLICY`） |
| P-MEDIA-4 | ⚪ | Bunny の配信プラン | 少人数のうちは Standard。人が増えたら Volume に切り替え（docs/media.md） | Bunny 管理画面 |
| P-USE-1 | 🔴 | 1日88分の利用時間 | クライアントの決まり（全惑星合計で1日88分）。**まだ作っていない**。費用の上限の前提なので次に作る | — |
| P-BILL-1 | ⚪ | Stripe（¥88/月）、MANA購入、ストレージ追加購入 | 「準備中」表示のみ。MANA は表示だけ |
| P-LEDGER-1 | 🟡 | 92/8 分配の端数処理 | プラットフォーム側を切り捨て（クリエイター有利）。税理士確認待ち |
| — | 🔴 | 資金決済法の弁護士レビュー（仕様 §3.2） | 未実施 |
| — | 🟡 | MANA 価格表（OPEN #6） | 仕様 §3.1 の初期値を定数化 |
| — | ⚪ | GMO あおぞら（バーチャル口座・振込）、収益の引き出し | アース・バンクは ¥0 表示のみ |

## 5. メディア・インフラ

| ID | 状態 | 内容 | 現在の仮実装 |
|---|---|---|---|
| P-MEDIA-1 | 🔴 | Bunny Storage / CDN の認証情報 | 未設定の間は **音声を Postgres に保存して API から配信**（開発・プレビュー専用）。Bunny の値を入れると自動で Bunny に切り替わる |
| P-INFRA-1 | 🔴 | GCP プロジェクトID、Workload Identity、Cloud SQL インスタンス名、CORS 許可ドメイン | `docs/deploy.md` の手順で設定 |
| P-AI-1 | 🟡 | 使う LLM モデル名 | Gemini `gemini-2.5-flash-lite`（クライアント決定 2026-10-06：費用のため、バティとの会話・作曲の設計など文章のAIは全部これ）、予備 OpenAI `gpt-4o-mini`。キー未設定時はオフラインの仮返答 |
| P-MOD-1 | 🔴 | 投稿前モデレーション（仕様 §8：ローンチ必須） | 簡単な禁止語チェック＋Gemini 判定。通報・ストライク・管理画面は未実装 |
| P-PWA-1 | ⚪ | Service Worker・Web Push | マニフェストのみ（ホーム画面追加は可能） |
| P-BRAND-1 | 🟡 | ロゴ・アプリアイコン | 仮の SVG アイコン |

## 6. 見た目だけの惑星（10/10 デモ）

| ID | 状態 | 内容 |
|---|---|---|
| P-DEMO-1 | 🟡 | 木星・水星・金星・火星・天王星・海王星はサンプルデータ（`apps/web/lib/samples.ts`）。画像はCSSで生成、音はブラウザ内で自動生成（`apps/web/lib/synth.ts`）。水星の Star 評価・Loops はその端末内だけに保存 |

## 7. 仕様書の OPEN 項目（そのまま未決）

| 仕様 | 内容 | 扱い |
|---|---|---|
| OPEN #2 | バティの正式設定 | P-MOON-1 |
| OPEN #4 | LabelGrid 経由の LINE MUSIC 可否 | 未着手（フェーズ3） |
| OPEN #5 | 未成年アカウント | P-AUTH-3 |
| OPEN #6 | MANA 価格表 | 初期値で仮置き |
| OPEN #7 | Agora 契約時期 | 未着手（通話はフェーズ2+） |
| OPEN #8 | 商用ライセンスの伴奏生成モデル選定 | 未着手（フェーズ2）。`InstrumentalGenerator` を差し替え可能な設計にする予定 |
| OPEN #10 | obolo records のスカウト閾値・監査率・規約 | 未着手（フェーズ3） |
| OPEN #11 | 海王星の掲載料 100 MANA | 未着手（フェーズ3） |

## 8. その他の仮判断

- **ホーム画面の配置**：ラフ画像がこのセッションに届いていなかったため、文章の指示（中央に地球、上に月、時計回りに 土星→木星→水星→金星→火星→天王星→海王星）で配置しました。ラフと違う点があれば `apps/web/components/SolarSystem.tsx` の `ORBIT_R` / `EARTH` / `BASE` で調整できます。
- **Mercury の音源保存先**（仕様 §7.1「README に記載」）：音声は **Bunny Storage + CDN** に保存（Stream より安価）。
- **デモモード**：`NEXT_PUBLIC_API_URL` が空のとき、Web は API なしで動く「デモモード」になります（データはその端末のブラウザ内だけ）。画面上部に黄色い帯で表示されます。
