# 惑星の作り直し：データの土台（引き継ぎ 01・2章）

物語セッションの引き継ぎ `docs/handoff/planets-01-foundation.md`（ブランチ claude/hopeful-pascal-udqkh2）の **2章 データの土台** を本番に入れたもの。
今の惑星の画面（M-R314 で没案）はまだ消していない。新しい惑星の画面（3章・惑星ごとの 02〜）は、この土台の上に作る。

ルールの本体は `packages/shared/src/planetWorks.ts`（純粋な関数。API と web で同じものを使う）。
API は `apps/api/src/planets/planet-works.service.ts`・`continents.service.ts`・`continents.controller.ts`。
表は migration `0056_planet_works.sql`・`0057_person_hides_saturn_plazas.sql`。

## 2-1 作品のタグ（ユーザーには見せない）
- 表 `planet_work_meta`（`kind` + `work_id` で1行。kind は `planet_post`・`jupiter_post`・`saturn_post`・`radio_show`）：`main`（主分類1つ）、`moods_json`（雰囲気、10まで）、`bpm`（曲だけ）。
- **作った瞬間に付ける**：各ストアの作成（`PlanetPostsService.create`・`JupiterService.create`・`SaturnService.create`・`RadioService.createShow`）が `PlanetWorksService.tag()` を呼ぶ。失敗しても作成は止めない（ログ → backfill で拾う）。
- 値はスペル・設定から自動：
  - 曲（水星）：`songs.designJson` の genre・mood・bpm（＋アトリエで作った曲は、はいと言ったスペル `designJson.spell` も入るようにした）→ `songTags()`。スタジオのジャンル（約50）は大陸の言葉（EDM／ヒップホップ／バラード／ロック／ローファイ／シティポップ／アニソン／ジャズ／J-POP）に寄せる。表にないジャンルはそのままの名前。
  - アート（木星）：根っこ（`jupiter_roots.spell_json`、アトリエが `POST /jupiter/roots` に `spell` を添える）のスペルの style が主分類、color・light・mood・theme が雰囲気 → `artTags()`。アニメ風→アニメ塗り など。写真（スペルなし）は空。
  - 声のコロリン（土星・M-R316）：**吹きこんだ言葉から自動**。言葉は投稿の `saturn_posts.text`（打った言葉、または投稿の前に `POST /voice/transcribe` で聞き取った言葉。投稿は必ず言葉を持つ）。`PlanetWorksService.tag()` が、言葉のチェックと同じ安いモデル（`LLM`＝Gemini Flash-Lite の列）に1回だけ聞く（`voiceTopicTags`、@obolo/ai。温度0・答えは小さな JSON）。話題（主分類）は 雑談／恋バナ／推し／学校／夜／ゲーム／お笑い／アニメ／朝／眠い のどれか（ほかは雑談）、雰囲気はゆるい・日常・ドキドキ・好きな人・アイドル・ライブ・部活・テスト・深夜・眠れない・対戦・実況・ボケ・ツッコミ・名シーン・マンガ・おはよう・元気・おやすみ・夜 から4つまで（`PLANET_VOICE_TOPICS`・`PLANET_VOICE_MOODS`、@obolo/shared）。モデルなし（mock）の時は言葉のルール（`voiceTagsOfWords`）。
    - 原価：その投稿のリクエストの「小さな原価」（cost-scope：投稿した人・無料の機能。言葉のチェックと同じく、たまって1マナになったら引く。docs/マナの値段.md 3.）。管理の backfill の時は会員がいないので記録だけ（運営）。
    - モデルが失敗しても投稿は止めない：話題なし（`main` null）で行を書く → backfill が聞き直す（今つけられた分だけ数えるので、モデルが落ちていても 0 で止まる）。
  - MV・ラジオ・グッズ・物語・ゲーム：05 の値（下の「05」）。`mvTags`・`radioTags`・`goodsTags`・`bookTags`・`gameTags`（@obolo/shared）。
- 前からある作品：`POST /admin/planet-works-backfill?limit=200`（x-admin-token）。曲は designJson から、アートは根っこのスペルが分かる時だけ付く、コロリンは言葉から（話題のまだない行も聞き直す）。0 件になるまで繰り返す。スペルのない前のアート・写真はタグなし（大陸には出ない、ダチのホームには出る：受け入れ済み）。

## 2-2 作品ごとの公開範囲
- `dachi`（ダチ・推しのホームだけ）／`public`（知らない人の大陸にも流れ着く）。`planet_work_meta.visibility`、**null = 初期値に従う**。
- 初期値は **1つの定数** `PLANET_WORK_DEFAULT_VISIBILITY`（`packages/shared/src/planetWorks.ts`、今は `'dachi'`＝物語の案、依頼主の答え待ち）。null の作品は全部これに従うので、1行変えれば前の作品も一緒に切りかわる。
- 効いている公開範囲（`effectiveVisibility`）：public を選んだ（または初期値が public）**かつ** 自動チェックが通った（`check_state = 'ok'`）時だけ public。行のない作品も public にならない。
- `dachi` の作品は **大陸・検索（数）・旅、ホームの遠くの景色（far）** に絶対に出ない（SQL：`continentWhere`、`farWhere` の `isPublicWork`）。
- 持ち主だけが変えられる：`PUT /planet-works/:kind/:id/visibility {visibility}`。

## 2-3 作品単位の通報・非表示・自動チェック
- 〔⋯〕「この人を表示しない」＝今の `POST /comms/block`（user_blocks）。
- 〔⋯〕「通報する」＝今の `POST /planet-works/:kind/:id/report`。作品単位で `user_reports`（kind＋target_id）に入り、運営に届く。**その作品は本人に見えなくなり（work_hides）、通報した人の側から、その人の作品と姿が一方向に見えなくなる**（表 `person_hides`、M-R317）。ブロックはしない：ダチ・推しの関係は自動では変えない（切るのは本人が別に「この人を表示しない」で）。
  - 効く所：ホームの around・far、大陸（降りる・検索の数）、前からの各惑星のフィード（`planetWorkScope`）、ラジオ、☆の保存（`common/child.ts notPersonHidden`）。旅は大陸だけを返すので作品は出ない。
- 自動チェック：作品が作られた時に1回、言葉（題・ひとこと・タグ）を作る時と同じ `moderateText`（@obolo/ai）で見る。通らなければ `check_state = 'held'`・`check_reason` に理由（カテゴリ）。held の作品は public を選んでも dachi のまま。
- **絵のチェックはまだない**（P-MOD-1）。アトリエで描いた絵は、チェックを通ったスペルから描かれる。アップロードした写真は見ていない。

## 2-4 大陸（データ）
- 表 `continents`：planet、key、name、`creator_id`（null＝運営。M-R297 のユーザーの大陸はここに行を足すだけ）、`rule_json` `{g, m, bpm?}`、`tags_json`（さがす時の #タグ）、絵3枚 `sky_url`（空から見た島）・`land_url`（降りた景色）・`shore_url`（岸から見た景色）、`sort_order`。
- 流れ着く判定（試作 `workScore`）：主分類が合えば +3、雰囲気1つごとに +2、bpm の範囲外なら −2（何か合った時だけ）。**2点以上で流れ着く**。1つの作品が複数の大陸に流れ着く。並びは点の高い順、同点はランダム（人気順にしない）。
- 種：水星・木星・土星の10ずつ（試作の CONT／RULE そのまま。土星の広場は 0057、M-R316：おしゃべり広場・恋バナの部屋・推し語りステージ・放課後テラス・夜ふかしラウンジ・ゲーム実況の島・お笑い劇場・アニメ語りカフェ・おはよう広場・ねむねむ星）。試作で「by Nagi」などとなっていた5つずつも、本当の会員ではないので運営の大陸（`creator_id` null）。**運営の大陸は作った人の名前を送らない**（`creator: null`、M-R317）。お気に入りの初期値は `sort_order` の先頭5つ（試作の運営の5つ）。
- **まだない絵**：30大陸 × 3枚 ＝ 90枚（全部 null）。

## 2-5 ユーザーごとの保存
- お気に入りの大陸：`planet_homes.continent_favs_json`（5枠、null＝空き）。一度も選んでいなければ運営の5つ。消えた大陸の枠は空きになる。☆は空き枠へ、5つ埋まっていれば 409 `FULL`（枠を言えば入れかえ）。
- ブルーナ（☆ 作品の保存）：今の `bluena_saves` に `kind` を足して、どの惑星の作品でも入るようにした（前の行は `planet_post`）。自分の作品・ブロックした人の作品は入らない。
- 推し：今の follows のまま。空（大陸）で推した知らない人も、次からその惑星のホームに来る（ホームの around は follows を見る。planet-home.test.ts）。
- 見た大陸：表 `continent_seen`（`shown_at`＝旅で見せた、`landed_at`＝降りた）。〔旅〕はまだ見ていない大陸から、次に見たのが一番前のもの。

## 2-6 自分の姿
- `figureFor(planetFigures, planet)`（@obolo/shared）：`GET /me` の `planetFigures` から、その惑星で乗っている自分（土星＝コロリン：ちびキャラ＋ボール、木星＝蝶、水星＝船、火星＝UFO、金星＝DJ、天王星＝風船、冥王星＝本、海王星＝泡）。読むだけ（作るのは look のコード）。

## 3章 全惑星共通の型（画面）
新しいホームは `apps/web/components/planetTemplate/`（部品）と `apps/web/lib/planetTemplate/`（数字とルール。`layout.test.ts`）。**今の惑星の画面はそのまま**（消していない）。惑星ごとに切りかえるまでは、見比べ用の **`/planets-preview/<planet>`** だけで動く（アプリからはリンクしない）。データは `GET /planet-home/<planet>` と `GET /me`。ログインしていない・API なし（ブラウザの中の demo）・ダチの作品がまだ無い時は、見本の顔ぶれ（試作の絵、`public/planets/sample/`）で出す。`?sample=1` で見本に固定。
- 3-1 配置：惑星の背景（試作の template の絵、`public/planets/bg-*.webp`。9:16 の絵を画面いっぱいに）、右奥に自分の場所（試作の位置、タップでプロフィール）。ダチ・推しは試作の `JSLOT`（奥2・中4・手前2、奥ほど小さい）に8人まで、残りは順番待ち。開いて閉じた人の枠に、次の人が入る（`seat`・`replace`）。姿は `author.figure`（土星は `author.ball`）＝サーバーの `figureFor` と同じ絵。まだ無い人は惑星のスプライト＋顔。
- 3-2 さわる：タップで作品が開く。9px 動いたらドラッグ。離した所にとどまってその場で漂う。上に置くと小さく奥の段、下に置くと大きく手前の段（`dropAt`：高さ→大きさは試作の `[[.44,.5],[.62,.82],[.83,1.22]]`、段の境は .53／.74）。2本指が触れている間はドラッグしない（始まっていたら離す）。画像の標準ドラッグは止める。
- 3-3 右上の▶：惑星の色の丸いボタン（文字なし）。押すと「自分の場所からの眺め」（`public/planets/hv-*.webp`）、右下に自分の後ろ姿（左半分だけ。`GET /me` の `lookBack`、無ければ今の代わりの絵）。ダチの作品が1つずつ来て、終わると去り、次が来る。全部見たら自然に終わる。■ か画面タップで止める。
- 3-4 上の帯：左上に惑星のアイコン＋名前だけ。アイコンを触って横にすべらせると惑星の列が動き（指の 1.6 倍）、指を離した時に真ん中の惑星へ（`planetAtSlide`）。触っただけなら列が開いたまま、タップでも選べる。
- 3-5 プロフィール：上に ← とダチの列（先頭は「じぶん」、見ている人を光らせる）、下に持ち主の大きな姿（はみ出す）と名前。中身は惑星ごとの差しこみ口。作品の「by 名前」でその人のプロフィール。
- **惑星ごとの差しこみ口**（02 以降の文書で埋める。どれも初期値あり）：`hooks.opener`（作品の開き方。初期値：絵・ことば・題を大きく＋「by 名前」、音は再生）、`hooks.profileMiddle`（プロフィールの中身。初期値：作品の2列）、`hooks.config.allowed`（姿を置ける所。水星は海の上だけ — 数字は 02）、`hooks.config.introMs`（▶から最初の作品まで。土星 2300ms）、`hooks.config.holdMs`（1つの作品を見せる長さ。火星 9000ms）、`place`・`art`。
- 絵：背景・眺め・プロフィールの部屋・惑星のアイコンは試作（design/home/home-inline.html）から書き出したもの。土星は「レコードの床」の版。

## 02 水星（引き継ぎ planets-02-mercury.md）
まだ見比べ用の **`/planets-preview/mercury`** だけ（本番の水星の画面はそのまま。切りかえは 02 に書かれていない）。見本は `?sample=1`。スクリーンショットは `docs/handoff/shots/mercury-*.jpg`（390×844）。
- 置き方は惑星ごと（`config.motion`）：木星などは今まで通り JSLOT で漂う（`driftMotion`）。水星は `sailMotion`（`lib/planetTemplate/mercury.ts`）：試作の **MSLOT**（奥2・中3・手前2＝7隻、`[高さ, 大きさ, 段]`）の航路を左右に進み、画面の端から反対側へ回りこむ。波で上下・傾く。速さは試作の `(10+((i·7)%4)·4)·(奇数の枠は左)·(0.6+大きさ·0.5)` px/秒。ドラッグは海の上だけ（`seaOnly`：高さ .56〜.9、大きさ `[[.6,.5],[.69,.78],[.83,1.08]]`、段の境 .64／.78）。8人目からは順番待ち。
- §2 タップ：船が手前（画面の .5／.84、2.15倍）へ、ホームが寄ってぼける。0.45秒でその曲（もう一度タップするまでループ、M-R282）と**ピクチャーディスク**（ジャケットが円盤いっぱい・溝・穴）。歌詞は曲の時間に合わせて1行ずつ（左から白く色づく・次の行がうすく下）。2.2秒で曲名（曲ごとの字体と出方：試作の5曲は試作の組、ほかはジャンルから。字の種類で大きさ）。曲名の読み上げは `titleVoice` があれば、曲名が出るのと同時（2.2秒）に鳴らす（曲は下げない。曲名が出てから1.5秒より遅れて届いた読み上げは鳴らさない）。「NOW PLAYING」・by は出さない。
- データ：`GET /planet-works/planet_post/:id/song` → `PlanetSongView`（音・ジャケット・曲名・`titleVoice`・`lyrics: [{t, end, text}]`）。`titleVoice`（2026-11-25 物語チャットの答え）：曲を作った時、作った人に自分の声（登録した声のモデル `users.voice_self_id`、声を使ってよい人だけ `canUseMedia`）があれば、曲名だけをその声（Fish）で読み、ブルーナにしまって（袋に数える）`songs.design_json.titleVoice = {text, url, at}` に入れる（`compose/song-title-voice.service.ts`、キューの仕事 `song.title`。失敗しても曲には何も起きない）。声が無ければ読まない（null）。星に飛ばす時に曲名を変えたら、その曲名で読みなおす。返すのは、その投稿の曲名と同じ読み上げで、声がまだ登録されている時だけ。値段は曲に入れた（`docs/マナの値段.md`）。前からある曲は `POST /admin/title-voice-backfill?limit=50`（水星に飛んでいる曲だけ、運営が吸収）。歌詞の時間は曲の作りから計算（MV の焼きこみ歌詞と同じ `compose/lyrics.ts timedLyrics`）。歌詞の無い曲・曲の元が無い投稿は歌詞なし。見られるのは、作った人・ダチ／推し・その曲が public で流れ着く人だけ。
- §3 ▶：自分（`/me chibiPic`、見本は試作の踊る絵。無い人はその惑星の自分の姿、それも無ければ見本の姿：`dancerOf`。誰も出てこないことはない）が家から飛び出す → 夜の桟橋（花火）、右下に後ろ姿。船が左から来て手前で止まり、ディスク・曲名・歌詞・曲を**最後まで**、終わると右へ去って次。全部で「🏝 今日の曲、全部聴いたね！」。■・画面タップで止める。（`config.play`：道すじ・`untilDone`・夜・花火・踊り）
- §4 プロフィール：浜辺にその人の曲のレコードがスタンドに立って並ぶ（横スクロール）。タップでディスク・曲名・歌詞・曲（そのレコードも回る）。
- 空（06 の先取り・M-R295〜M-R312）：ホームで2本指でつまむ（PC は ctrl+ホイール）と「じぶんの空」（じぶんの島＋お気に入り5大陸）。〔🔍 大陸をさがす〕（タグは見せない、M-R310：ジャンルの札は「#」なしの言葉だけ、結果の下は「🌊 N曲」だけ — 単位は惑星ごと `SKY_COUNT_UNIT`：水星 曲・木星 作品・土星 人。入力欄は「大陸の名前・ジャンル」）・☆（5つ埋まっていれば「どの島と入れかえる？」→ 島をタップ）・〔✈ 旅〕（まだ見ていない6大陸）。島をタップで降りる：流れ着いた知らない人の船が航行（海の上だけドラッグ可）、タップで曲＋作った人（船の姿と名前）＋☆（ブルーナ）♡（推す）⋯（表示しない／通報）。右上▶で岸（`shore_url`）から1隻ずつ、止めるまでずっと。つまむ／← で空へ、空で広げる／じぶんの島でホームへ。15歳未満には作品が出ない。データは 2-4／2-5 の API。見本は試作の10大陸と曲（ブラウザの中だけ）。
- 大陸の絵：水星の10大陸 ×3枚（空の島・降りた景色・岸）を試作から書き出し（`public/planets/continents/mercury/`、migration `0058` で URL を入れた）。木星の10広場 ×3枚も同じく（`public/planets/continents/jupiter/`、空の海 `sea.webp`・じぶんの島 `me.webp` も、migration `0059`）。土星の10広場も（`public/planets/continents/saturn/`、migration `0060`）。

## 03 木星（引き継ぎ planets-03-jupiter.md）
まだ見比べ用の **`/planets-preview/jupiter`** だけ（本番の木星の画面はそのまま）。見本は `?sample=1`。スクリーンショットは `docs/handoff/shots/jupiter-*.jpg`（390×844）。数字とルールは `lib/planetTemplate/jupiter.ts`（`jupiter.test.ts`）、部品は `components/planetTemplate/jupiter/`。
- §1 ホーム：背景・右奥の木（タップでプロフィール）・JSLOT の8体は共通の型のまま（`driftMotion`）。蝶は**羽だけ**がはばたく：同じ絵を「左の羽（0〜L+2%）・右の羽（R−2%〜100）・体（L〜R、いちばん上）」の3枚に切って重ね、羽は体の付け根（高さ 52%）から `scaleX(1→0.3)`。体は 3px だけ上下（0.6 秒）。はばたきの速さは1匹ずつ 0.26〜0.38 秒（試作の makeBf）。体を羽の上に描くので、羽が顔にかかることはない。切れ目 L・R：会員の姿は**描いた時に測る**（`apps/api/src/look/wings.ts`：切り抜いた PNG の不透明な所の箱の上 65%・中 70% から肌色の固まりを探し、まん中に近いものを顔として、その左右の端から 3% 外。`planet_figures[look]['jupiter#wings'] = "L,R"`、測れなければ `"none"`）→ ホームの `author.wings`・`GET /me` の `figureWings` → `wingCutOf`。測れなかった姿だけ初期値 [18, 76]。見本の6人は試作の WB 表。前に描いた姿は `POST /admin/wings-backfill`（測るだけ、描き直さない）。共通の型に `hooks.figure`（姿の描き方）を足した（ホームと▶の両方で使う）。
- §2 蝶をタップ：ホームが寄ってぼける（×1.65・ぼかし5px・明るさ .55）。蝶が左下（.15／.93）へ寄り、名前が下に出る。0.12 秒で掛け軸（4種からランダム、`public/planets/jupiter/kakejiku-1..4.webp`）が上から下へほどけ、正方形の和紙の所にアートが**画面の幅の95%**（上は高さの9%）。カメラの寄り方は5種からランダム（スッ／ギュッと弾む／ブルッ／傾き／横からビュッ。弾む・震えるは画面も揺れる）。題名はアートの上（下の方、下を少し暗く）に、作品ごとの字体と出方で1文字ずつ（漢字×1.14・ひらがな×0.8）。「NEW ART」「〜のアート」「by」は出さない（作った人は蝶と名前だけ）。もう一度タップで素早く巻き上がり、蝶は木へ飛んでいく → 次の順番待ちの蝶が空いた持ち場へ。全部見たら「🌳 今日のアート、全部見たね！」。
  - 題名：作品の題（`jupiter_roots.title` → 飛ばした `jupiter_posts.title`、0061）。月のアトリエで絵ができると{bati}がスペルから1つ提案（`POST /moon/art-title`、曲名と同じ LYRICS_LLM・小さな費用は 'lyrics'）、ことばで変えられる（「タイトルは〇〇にして」「ほかのタイトルにして」→ `PATCH /jupiter/roots/:id`）。題の無い作品だけ**ことばの1行目**。{bati}のせりふは仮（`packages/shared/src/artTitle.ts`、PROVISIONAL）。字体と出方：試作の5作品は試作の組、ほかは作った時に付いたタグの画風（`planet_work_meta.main`：水彩・アニメ塗り・ドット絵…）から（同じ作品はいつも同じ）。**AI が選んで保存する形はまだ**（下）。
  - 題名の読み上げ（作った人の声）：音がまだ無いので鳴らない（試作にも無い）。
- §3 ▶：自分の蝶が木から出て、夜のポーチ（`hv-jupiter.webp`）にほたる18匹。右下に後ろ姿。1.7 秒で最初の蝶が上から飛んで来て手前で止まり（0.85 秒）、左下へ寄って掛け軸が開く（約3秒）→ 巻き上がって右上へ去り、次。全部で「🌳 今日のアート、全部見たね！」。■・画面タップで止める。（`config.play`：`PORCH_PATH`・`fireflies`・`danceAs: 'figure'`）
- §4 プロフィール：アトリエ（`prof-jupiter.webp`）の壁に、その人のアートが金の額（ひもと釘つき）で2列、縦にスクロール、少しずつ傾いて掛かる。額をタップで同じ掛け軸（もう一度タップで閉じる）。
- API：足していない（ホームの `GET /planet-home/jupiter` の作品に絵・ことば・タグがあり、それで開ける）。
- 空：03 には無い（06 で木星の空を作る）。木星の大陸の絵は入れた（0059、10広場の key と絵の名前は全部一致）。

## 04 土星（引き継ぎ planets-04-saturn.md）
まだ見比べ用の **`/planets-preview/saturn`** だけ（本番の土星の画面〔器〕〔広場〕〔つぶやく〕はそのまま。消すのは後）。見本は `?sample=1`。スクリーンショットは `docs/handoff/shots/saturn-*.jpg`（390×844）。
**共通の型の例外**：段（JSLOT）に浮かばない。型の枠（上の帯・▶・プロフィールの骨組み・順番待ち）はそのまま、置き方だけ土星の `floorMotion`（`lib/planetTemplate/saturn.ts`、`saturn.test.ts`）。型には差しこみ口を足しただけ（`playStage`・`profileFull`・`config.ownOnHome`・`config.placeArm`・`openLook.dim`・`play.dance.from`）。
- §1 ホーム（M-R307・M-R308）：背景は虹の空＋小石＋レコード（`bg-saturn.webp`）。コロリンは**8体**（自分のボールも1つ。名前は出さない）、残りは順番待ちで、割れた分だけ上から落ちてくる。
  - 床は試作の REC（9:16 の絵の上の楕円）。位置 (gx, gz) と高さ h：x = cx + gx·rx、y = cy + gz·ry·0.86 − h·大きさ。大きさは奥 0.58 → 手前 1.18。重なりは gz（手前が前）。
  - 約1〜2.3秒ごとにぴょんと跳ねる（上 330〜530、横 0.28〜0.49/秒、外側に寄りすぎたら内側へ）。着地でつぶれてばねで戻る。影は床に（高いほど小さく薄く）。床の上でぶつかったら押し合う（画面の大きさで測る）。
  - タップ：その場で割れてちびキャラ（`author.figure`＝figureFor のちび、自分は `/me` の土星のちび）、ひと言（`text`）が上・「by 名前」が下の小さな字（タップでその人のプロフィール）、声（`url`）。2.3秒で手を振り、レコードのラベルへ帰る。ホームは暗くならない（ほかのコロリンは跳ね続ける）。
  - ドラッグ：持ち上げて好きな所へ（奥へ運ぶと小さく）。離すと投げた向きに床に沿って飛ぶ。名前はボールの中・顔の下。グラサン（丸7割・他3割）は試作どおり**音楽中だけ**出る形（ホームでは見えない）。
  - レコードのラベル（今の場所の輪）とトーンアームをタップ：自分のプロフィール。
- §2 ▶（M-R287〜M-R290・M-R304）：自分（`/me chibiPic`）が空からレコードに落ちて着地 → 巨大なレコードの寄り（`hv-saturn.webp`、ミラーボール・針なし）、右下に後ろ姿（左半分）。コロリンは溝の楕円（PATH：中心 1.02, .455・半径 .8, .32・262°→72°・152°で割れる・10.5秒）を流れ、割れて喋りながら流れ続ける。最初の3体は溝の途中から（最初の声まで約2.3秒＝`firstVoiceMs()`＝`config.introMs`）、以降は2.6秒ごと。全部流れたら「🎉 今日のコロリン、全部聞いたね！」。■・画面タップで止める。自分のコロリンは流さない。
- §3 プロフィール（M-R304）：2D舞台（ぼかしたクラブ `prof-saturn.webp`、石の地面 `planets/saturn/floor.webp`、左右のスピーカー `speaker.webp`）。その人の過去のコロリンが上から降って積もる（一番新しいのに NEW）。タップで割れて喋る、ドラッグで投げる。データは `GET /planet-home/saturn/person/:id`（見本は自分18・ダチ10〜13）。
- 空（06）：まだつないでいない（2本指で何も起きない）。広場の絵は入れた：10広場 ×3枚＋海と自分の島（`public/planets/continents/saturn/`、migration `0060`。10広場の key と絵の名前は全部一致）。
- まだ：音楽中のビートで跳ねる・レーザー・クラブの音楽（▶の間はホームが隠れるので、ビートの跳ねは見えない）、レコードの色（M-R262）。

## 05 火星・金星・天王星・冥王星・海王星（引き継ぎ planets-05-five.md）
まだ見比べ用の **`/planets-preview/<planet>`** だけ（本番の画面はそのまま）。見本は `?sample=1`。スクリーンショットは `docs/handoff/shots/<planet>-*.jpg`（390×844。海王星は PRESS START を押した所 `neptune-game.jpg` も）。
5つとも**共通の型そのまま**（JSLOT の漂い `driftMotion`、ドラッグ、▶、プロフィールの骨組み）。違うのは乗り物（各自の姿＝figureFor：UFO・DJブース・風船・空飛ぶ本・泡）・作品の開き方・プロフィールの真ん中だけ。数字とルールは `lib/planetTemplate/five.ts`（`five.test.ts`）、部品は `components/planetTemplate/five/`（`fiveHooks(planet)`：5つで1組）。
- タップ（試作 popG5）：ホームが寄ってぼける（×1.65・5px・.55）。姿が左下（.15／.92）へ、名前がその下。作品はその星の開き方で上から（top：火星12%・金星14%・天王星16%・冥王星22%・海王星12%）：
  - 火星：**正方形のスクリーン**に MV（音つき、閉じるまでくり返し）。題名は下。見本は試作どおり絵＋曲。
  - 金星：番組の**サムネ**（角丸の正方形、回るレコードではない）＋「ON AIR」＋波形15本。0.5秒後に番組の音（作った人の声）。
  - 天王星：**トートバッグ**にアートが印刷された形（ゆれる）。題名は下。
  - 冥王星：**開いた本**（左ページ＝表紙の絵、無ければ題名の紙。右ページ＝題名と書き出し：1章の最初の160字から2段落まで）。
  - 海王星：**ゲームのケース**（絵が無いので、作品ごとのネオンの面＋頭の1文字）＋「OBOLO GAMES」＋点滅する「PRESS START」。押すとそのゲームを砂場（`GameFull`）で遊べる（ホーム・棚から。▶の中では押せない）。
  - 題名は作品ごとの字体（試作の TSTYLE、無ければ 05 のタグの主分類から、無ければ Dela Gothic One。ゲームはドット）。by・タグは出さない。もう一度タップで閉じ、姿は自分の場所へ飛んで消え、順番待ちの次が入る。
- ▶（試作 playG5）：自分が場所から飛び出し → 眺め（`hv-*.webp`）、右下に後ろ姿。1人ずつ来て開く：**火星は MV の終わりまで**（`untilDone`）、ほかは 5.2 秒。全部で「✨ 今日の作品、全部見たね！」。
- プロフィールの真ん中（試作 pgal）：2列・縦スクロール。火星＝MVのサムネ（ポスター形）、金星＝番組のサムネ（横長のモニター）、天王星＝棚の上の小さなトート、冥王星＝本棚（表紙）、海王星＝ケースの棚。タップで同じ開き方（もう一度タップで閉じる）。
- データ：
  - 火星＝`planet_posts`（mars、正方形の動画 `url`＋ポスター `thumbUrl`）、金星＝`radio_shows`（音 `url`・サムネ）— 前から。
  - **冥王星＝`books`、海王星＝`games`（ストアをつないだ）**。ホームに出るのは**飛ばした**本・ゲームだけ（`flown_at`、88時間は飛ばした時から）。`POST /moon/books/:id/fly`・`/moon/games/:id/fly` `{on}`（`on:false`＝月へもどす。ホームの〔外す〕も同じ）。本の `text`＝1章の書き出し、`thumbUrl`＝表紙。ゲームの `title`・`text`＝表の版の題・遊び方、コードは PRESS START の時に `GET /moon/games/:id`（作った人・送られたダチに加えて、**その星のホームに届く人**＝作った人・ダチ／推し（88時間なしで）・流れ着く人：`seesWork`）。本も同じく `GET /moon/books/:id`。
  - **天王星＝まだストアなし**：グッズを作る所がまだ無い（月のアトリエにも無い）。ホームは見本だけ。タグの関数（`goodsTags`）は用意した。
- タグ（2-1 の残り。作った瞬間に `PlanetWorksService.tag()`、`POST /admin/planet-works-backfill` で前の作品も）：
  - 火星 MV：`mvTags`＝その MV の曲の `songTags` の主分類と雰囲気（bpm は持たない）。投稿の 裏スタジオの動画 → MV（`mv_projects` の動画）→ 曲。MV でない動画はタグなし。
  - 金星 ラジオ：`radioTags`＝主分類は題名から土星の話題（言葉のルール `voiceTagsOfWords`、無ければ雑談）。雰囲気（話し方）は にぎやか・しっとり・ゆったり・深夜・朝・夜・音楽たっぷり・トーク から4つまで：題名の言葉、ループ（pulse にぎやか／ripple・still しっとり／drift ゆったり／stars 夜）、作った時刻（22〜4時 深夜、5〜9時 朝）、流した曲（3曲以上 音楽たっぷり、0 トーク）。
  - 天王星 グッズ：`goodsTags(種類, アートのスペル)`＝主分類 トート・Tシャツ・ステッカー・アクスタ・マグカップ・缶バッジ、雰囲気＝アートの画風（`artTags` の主分類）＋その雰囲気。
  - 冥王星 物語：`bookTags`＝主分類 ファンタジー・恋愛・ホラー・日常・SF・ミステリー（本のスペルのジャンル：冒険→ファンタジー、学園もの→日常、ちょっと怖い→ホラー。無ければ言葉から、無ければ日常）。雰囲気＝長さ（書いた字数：5000まで 短い・12000まで 中くらい・その先 長い）＋気分（泣ける・笑える・こわい・やさしい・わくわく）。章を書くたびと飛ばす時に付け直す。
  - 海王星 ゲーム：`gameTags`＝主分類 アクション・パズル・レース・リズム・シューティング・クイズ（スペルのジャンル：集める・よける・ジャンプ・タップ・ブロックくずし→アクション。レース・リズムの言葉が先）。雰囲気＝ひとりで／みんなで ＋ すぐ終わる（秒・かんたん・30こ）／じっくり（パズル・クイズ・むずかしい・ライフ・ハイスコア）。版を作るたびと飛ばす時に付け直す。
  - backfill：本・ゲームのタグの無い行、と前の火星の動画・金星の番組でタグが空の行（今わかる分だけ数える）。
- 空（06）・音：まだ（大陸の単位は 05 に無いので 作品 のまま）。

## API
| | |
|---|---|
| `GET /planet-continents/:planet` | じぶんの空：大陸の一覧＋お気に入り5枠 |
| `PUT /planet-continents/:planet/favourites` `{slots: (key\|null)[5]}` | 5枠をまとめて（入れかえ） |
| `PUT /planet-continents/:planet/:key/favourite` `{on, slot?}` | ☆ 1つ（409 FULL） |
| `GET /planet-continents/:planet/search?q=&tag=` | 🔍 大陸をさがす（名前+3・タグ+2・作った人+1、同点ランダム、`count`＝流れ着いた public の作品数） |
| `GET /planet-continents/:planet/travel?n=6` | ✈ 旅（まだ見ていない大陸から。見せたものを記録） |
| `GET /planet-continents/:planet/:key` | 降りる：大陸と流れ着いた作品（`tags`・`score`・`rel`）。15歳未満は作品なし |
| `POST /planet-continents/:planet/:key/visit` | 降りたことを記録 |
| `GET /planet-works/:kind/:id/visibility` ・ `PUT …/visibility {visibility}` | 公開範囲（持ち主だけ） |
| `PUT /planet-works/:kind/:id/save {on}` ・ `GET /planet-works/saved` | ☆ ブルーナ |
| `POST /planet-works/:kind/:id/report` ・ `…/hide` | 通報（＋作品の非表示＋その人を一方向に非表示）・見えなくする（前から） |
| `POST /admin/planet-works-backfill?limit=` | 前の作品のタグ・チェック |
| `GET /planet-works/planet_post/:id/song` | 02 水星：曲を開く（音・ジャケット・曲名・歌詞と時間） |
| `GET /planet-home/:planet` | 前から。作品に `tags`、自分の作品に `visibility`・`heldReason` が付いた |
| `POST /moon/books/:id/fly` ・ `POST /moon/games/:id/fly` `{on}` | 05：本を冥王星へ・ゲームを海王星へ飛ばす（`on:false` で月へ） |
| `GET /moon/games/:id` ・ `GET /moon/books/:id` | 05：飛んだゲーム・本は、その星のホームに届く人も開ける |
| `GET /planet-home/:planet/person/:id` | 04 土星：その人の過去の作品（プロフィールの2D舞台）。自分＝自分の作品、ダチ・見られる推し＝88時間なしで、ほかの人＝何も返さない（`person: null`）。新しい順・24まで |

## まだのこと
- 公開範囲の初期値（依頼主の答え待ち。今は dachi）。
- 大陸の絵：水星（0058）・木星（0059）・土星（0060）の90枚は全部入った。
- 05：天王星のグッズのストア（作る所がまだ無い）。本・ゲームの〔星へ飛ばす〕をアトリエにつなぐこと（API はある。`FLY_READY_KINDS` はまだ変えていない）。
- 木星（03）：題名の字体と出方を作る時に AI が選んで保存すること、題名の読み上げの声、題の提案と変更の{bati}のせりふ（仮）を物語の部屋で確認。羽の切れ目の自動測定は本番の姿の絵で見比べ（肌色の無い姿・顔が横を向いた姿は初期値になる）。
- 木星のスタイル：アートのスペルの style に **ゆめかわ・和モダン・レトロ・ポップ** を足した（`packages/shared/src/spell.ts`、スペルのモデルの案内 `packages/ai/src/prompts/spell.ts` も）。これからのアートはその広場に画風でも流れ着く。
- 絵の自動チェック（P-MOD-1）。
