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
- 空（06 の先取り・M-R295〜M-R312。**今は 06 の章**）：ホームで2本指でつまむ（PC は ctrl+ホイール）と「じぶんの空」（じぶんの島＋お気に入り5大陸）。〔🔍 大陸をさがす〕（タグは見せない、M-R310：ジャンルの札は「#」なしの言葉だけ、結果の下は「🌊 N曲」だけ — 単位は惑星ごと `SKY_COUNT_UNIT`：水星 曲・木星 作品・土星 人。入力欄は「大陸の名前・ジャンル」）・☆（5つ埋まっていれば「どの島と入れかえる？」→ 島をタップ）・〔✈ 旅〕（まだ見ていない6大陸）。島をタップで降りる：流れ着いた知らない人の船が航行（海の上だけドラッグ可）、タップで曲＋作った人（船の姿と名前）＋☆（ブルーナ）♡（推す）⋯（表示しない／通報）。右上▶で岸（`shore_url`）から1隻ずつ、止めるまでずっと。つまむ／← で空へ、空で広げる／じぶんの島でホームへ。15歳未満には作品が出ない。データは 2-4／2-5 の API。見本は試作の10大陸と曲（ブラウザの中だけ）。
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
- 空：06 の章（蝶・掛け軸）。木星の大陸の絵は入れた（0059、10広場の key と絵の名前は全部一致）。

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
- 空：06 の章（レコード広場で跳ねるコロリン）。広場の絵は入れた：10広場 ×3枚＋海と自分の島（`public/planets/continents/saturn/`、migration `0060`。10広場の key と絵の名前は全部一致）。
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
  - **天王星＝`goods`（2026-11-25 物語の部屋の答え）**：月のアトリエの「グッズ」で作る（下の「05 のつづき」）。ホームに出るのは飛ばしたグッズだけ（`flown_at`）。`text`＝種類（その見本で描く）、`thumbUrl`＝のせたアート。`GET /moon/goods/:id` は本・ゲームと同じ人が開ける。
- タグ（2-1 の残り。作った瞬間に `PlanetWorksService.tag()`、`POST /admin/planet-works-backfill` で前の作品も）：
  - 火星 MV：`mvTags`＝その MV の曲の `songTags` の主分類と雰囲気（bpm は持たない）。投稿の 裏スタジオの動画 → MV（`mv_projects` の動画）→ 曲。MV でない動画はタグなし。
  - 金星 ラジオ：`radioTags`＝主分類は題名から土星の話題（言葉のルール `voiceTagsOfWords`、無ければ雑談）。雰囲気（話し方）は にぎやか・しっとり・ゆったり・深夜・朝・夜・音楽たっぷり・トーク から4つまで：題名の言葉、ループ（pulse にぎやか／ripple・still しっとり／drift ゆったり／stars 夜）、作った時刻（22〜4時 深夜、5〜9時 朝）、流した曲（3曲以上 音楽たっぷり、0 トーク）。
  - 天王星 グッズ：`goodsTags(種類, アートのスペル)`＝主分類 トート・Tシャツ・ステッカー・アクスタ・マグカップ・缶バッジ、雰囲気＝アートの画風（`artTags` の主分類）＋その雰囲気。
  - 冥王星 物語：`bookTags`＝主分類 ファンタジー・恋愛・ホラー・日常・SF・ミステリー（本のスペルのジャンル：冒険→ファンタジー、学園もの→日常、ちょっと怖い→ホラー。無ければ言葉から、無ければ日常）。雰囲気＝長さ（書いた字数：5000まで 短い・12000まで 中くらい・その先 長い）＋気分（泣ける・笑える・こわい・やさしい・わくわく）。章を書くたびと飛ばす時に付け直す。
  - 海王星 ゲーム：`gameTags`＝主分類 アクション・パズル・レース・リズム・シューティング・クイズ（スペルのジャンル：集める・よける・ジャンプ・タップ・ブロックくずし→アクション。レース・リズムの言葉が先）。雰囲気＝ひとりで／みんなで ＋ すぐ終わる（秒・かんたん・30こ）／じっくり（パズル・クイズ・むずかしい・ライフ・ハイスコア）。版を作るたびと飛ばす時に付け直す。
  - backfill：本・ゲームのタグの無い行、と前の火星の動画・金星の番組でタグが空の行（今わかる分だけ数える）。
- 空：下の「07 5惑星の空」。

## 06 空から探す（引き継ぎ planets-06-sky.md）
水星・木星・土星の **`/planets-preview/<planet>`** で動く（本番の画面はそのまま）。見本は `?sample=1`（試作の10大陸・作品、ブラウザの中だけ）。スクリーンショットは `docs/handoff/shots/<planet>-{sky,search,swap-drag,travel,continent,continent-work,continent-shore}.jpg`（390×844、水星・木星・土星）。
部品は `components/planetTemplate/sky/`（`SkyExplore.tsx`＝全惑星で1つ、`skyKits.tsx`＝惑星ごとの乗り物と開き方）、数字とルールは `lib/planetTemplate/skyPlanets.ts`（`skyPlanets.test.ts`）・`pinch.ts`（`pinch.test.ts`）・`sky.ts`。空があるかどうかは `templateConfig(planet).sky`（海と自分の島の絵）。`planetHooks` が全惑星に `sky` をつなぐ（空のない惑星は何も起きない）。
- §1 ピンチ：`PinchTracker`（ホームと空で同じ）。2本指が 0.72 倍以下で空へ、空で 1.35 倍以上でホームへ、大陸の上で 0.72 倍以下で空へ（作品を開いている間は無し）。1回の動きで1回だけ。2本目の指が触れたらドラッグは離す（ピンチが勝つ）。ホーム・空の全体は `touch-action: none`（ブラウザの拡大はしない、一覧のスクロールはそのまま）。PC は ctrl＋ホイール（`WheelPinch`：続けて来るイベントは1回にまとめる）。上がる時、ホームは縮めず 1.12 倍に寄って薄れる、ダチ・コロリンはすぐ隠す。空の絵（海・自分の島）は惑星を開いた時に先に読む。初回の「✌️」はそのまま、旅の初回「✈ ← でじぶんの空にもどれるよ」。
- §2 じぶんの空：5枠・自分の島の位置は 06 の数字（`SKY_SLOTS`・`SKY_ME`）。水星＝海の島、木星＝森の広場、土星＝輪の上のレコード広場（絵は 0058〜0060）。▶ の色は惑星の色。
- §3 さがす：前のまま（タグのチップは言葉だけ、数は惑星の単位）。☆ で5つ埋まっていれば「どの島と入れかえる？」：新しい島を**枠へドラッグ**（指の下の島が大きく光る。当たりは `hitSlot`：島の絵の箱＋14px、重なれば中心の近い方）、または枠をタップ。
- §4 旅：前のまま（6大陸、まだ見ていない順、連打できる）。
- §5 降りる：大陸の名前は幅の 46% に収まる大きさ（`landNameSize`）。知らない人は最大7、その惑星の乗り物で（`landMotionOf`）：水星＝船が左右に航行（海の上だけ、`seaMotion`）、木星＝小さなアートを持った蝶が森の7か所（試作 GLADE）でひらひら（`flutterMotion`、羽だけはばたく 03 の `Wings`）、土星＝コロリンが広場のレコードの上で跳ねる（ホームと同じ跳ね方・影・押し合い・投げ、床は降りた絵のレコード `PLAZA_REC`）。ドラッグで動かせる。タップ → その惑星の開き方（水星＝ディスク・曲名・歌詞・曲、木星＝掛け軸、土星＝割れてちびキャラ＋ひと言＋声、5惑星＝05 の開き方。ゲームの PRESS START は空では押せない）。下に作った人の姿（乗り物）と名前だけ、丸い ☆（ブルーナ）♡（推す。「これから{きみの島／きみの森／きみのレコード}にも来てくれるよ」）、右下〔⋯〕（この人を表示しない＝`POST /comms/block`／通報＝`POST /planet-works/:kind/:id/report`）。タグ・作った人の名前の無い運営の大陸（`creator: null`）はそのまま。
- §6 ▶：岸の絵（`shore_url`）に切りかえ、右下に後ろ姿。1つずつ（ランダム、止めるまでくり返し）：水星＝船が左から来て曲の終わりまで、木星＝蝶が上から来て左下に止まり掛け軸 7 秒、土星＝コロリンが上から来て割れて喋る 5 秒（5惑星＝07）。終わると去って次。⋯ で非表示・通報するとその人は消えて次へ。■・画面タップで止めて元の景色。
- API：足していない（2-4／2-5 のまま。土星の降りた作品の姿は `author.ball`、ちびは `author.figure`）。
- 5惑星（火星・金星・天王星・冥王星・海王星）の空：下の 07。
- まだ：推した人がホームに来るのは API（follows）のまま、空から自分の作品が見える時の「★ じぶん」。

## 07 火星・金星・天王星・冥王星・海王星の空（引き継ぎ planets-07-five-skies.md、M-R323）
06 の仕組みのまま、5惑星の大陸・絵・言葉を足して空を開いた（`config.ts` の `fiveOwn` に `sky: skyOf(p)`）。**`/planets-preview/<planet>`** で動く（本番の画面はそのまま）。見本は `?sample=1`。スクリーンショットは `docs/handoff/shots/<planet>-sky-{sky,search,travel,continent,continent-work,continent-shore}.jpg`（390×844、5惑星）。
- 空の世界（07 §1）：火星＝夜のネオンの街を真上から（大陸＝地区）、金星＝夕焼けの雲の海（雲の放送局）、天王星＝パステルの空に浮かぶお店、冥王星＝星空に浮かぶ図書室、海王星＝深海を上から（泡のドーム）。じぶんの島＝小さな映画館／雲のラジオブース／小さなお店／読書部屋／泡のゲーム小屋（`me.webp`）。
- 大陸（07 §2）：各10、migration **`0063_five_sky_continents.sql`**（名前・rule・tags・絵の URL まで1つで）。後ろの5つは試作では「by 〜」だが運営の大陸（`creator_id` NULL、名前は出さない）。条件：火星＝水星と同じ（BPM も）、金星＝土星と同じ話題、天王星＝グッズの種類（g）か絵の画風（m）、冥王星＝本のジャンル＋雰囲気、海王星＝ゲームのジャンル＋遊び方。見本は `sky.ts` の `SAMPLE_MARS` など（同じ中身）、見本の作品は試作の `WORKS.<惑星>`（`sampleFiveWorks`）。
- 数え方（検索の🌊、`SKY_COUNT_UNIT`）：火星 本・金星 番組・天王星 個・冥王星 冊・海王星 こ。
- ♡（`SKY_PLANETS[p].home`）：「これから{きみのシアター／きみのブース／きみのお店／きみの図書館／きみのゲーム小屋}にも来てくれるよ」（仮の「きみの星」は無くなった）。
- 降りる（07 §3）：知らない人は 05 の乗り物（UFO・DJブース・風船・空飛ぶ本・泡）で、木星の蝶と同じ漂い（`flutterMotion`、試作 SKYV の motion:'flutter'）。開くと 05 の開き方。**作った人の姿と名前は画面の上**（`whoTop` 7.5%）、作品はその下から（`workTop` 16%：その惑星の 05 の位置より上には来ない。冥王星は 22% のまま）、題名は作品の下なので重ならない。☆♡⋯ は下。
- 岸の▶（07 §3、試作 pierFrom／pierTo／pierOut）：乗り物は上（.5, −.1）から来て**左下**（.2, .88）に止まり、右上へ去る。見せる長さ：火星＝MV の終わりまで、金星 6 秒・天王星 5 秒・冥王星 6 秒・海王星 5 秒。海王星の PRESS START は空では押せない（06 のまま）。
- 音：06 の音のまま（上がる・降りる・旅・岸へでシュッ、岸に着くとザバッ、開くとザバッ＋海王星ピコピコ、☆♡で鈴。`sound.test.ts`）。
- 絵：`public/planets/continents/<planet>/`（各32枚＝空 `sea.webp`・`me.webp`・大陸ごとに `-sky`・`-land`・`-shore`）。物語のブランチの `design/mv-art/out/`（`exp-<惑星>-*.jpg`・`isl-<惑星>-*.jpg`）から webp に（景色は 540×960、島は 320／じぶんの島 380 で透明）。島は試作の build.py と同じく、ふちにつながる白だけを抜いた。**海王星の島は白い背景ではなく深海の景色ごと描かれていた**ので、泡のドームのまわりだけを丸くぼかして残した（ドームの位置は円の検出、外れた6枚は目で測った値）。
- タグ（07 §2 の終わり・05 の続き）：冥王星の雰囲気に 魔法・宇宙・冒険（`bookTags`、雰囲気は5つまで）、海王星の遊び方に レトロ・ドット絵（`gameTags`：スペルの画風 ドット絵・レトロ、題名の 8bit など）、天王星は 和モダン（絵の画風 和モダン がそのまま雰囲気に入る。言葉の 和モダン からも）。ゲームのスペルに レトロ（画風）を足し、本とゲームのスペルの案内（`packages/ai/src/prompts/spell.ts`）にも言葉を書いた。

## 音（全惑星まとめて・物語の部屋 2026-11-25、M-R319「効果音は全惑星まとめて」）
試作 `design/home/template.html` の音をそのまま Web Audio で作る（音のファイルは無し）。決まりは `lib/planetTemplate/sound.ts`（`sound.test.ts`）、鳴らすのは `lib/planetTemplate/sfx.ts`（`sfx.test.ts`、偽の AudioContext）。
- 音の種類：鈴（`chime`）・シャボン玉のポッ（`popSound`）・ザバッ（`splash`）・シュッ（`whoosh`）・ピコピコ（`chip`）・花火のドン（`firework`、曲が流れている間は小さく）。▶ の音楽：土星＝クラブ（3つの型からランダム、124/128/120BPM）、木星＝森の夜祭り（太鼓・シェイカー・五音の弦、92/96/100BPM）。
- どこで鳴るか（`cuesFor`）：ホームでタップ＝土星ポッ／木星 鈴→0.12秒でポッ（掛け軸）／水星ザバッ／5惑星 鈴（海王星はピコピコも）。▶＝自分が飛び出してポッ（土星は針に着地の 0.56 秒）、景色が変わってシュッ、木星・5惑星は1人ずつ鈴、作品が開く時 木星ポッ・水星ザバッ（桟橋）・海王星ピコピコ、土星は溝のコロリンが割れるたびにポッ、水星の花火にドン。プロフィール＝開くとシュッ、土星の2D舞台のコロリン・木星のアトリエの絵でポッ、海王星のゲームでピコピコ。空＝上がる・降りる・旅・旅から戻る・岸へ（▶）でシュッ、岸に着くとザバッ、作品が開くとザバッ（＋土星ポッ・木星 鈴・海王星ピコピコ）、☆（島・ブルーナ）♡ で鈴。
- 作品の音が必ず聞こえる：▶ の音楽は、声（コロリンのひと言・題名の読み上げ）の間は 0.32 倍（試作の .5→.16）、曲・MV・ラジオ（動画・ループ・20秒より長い音）の間は無音にし、終わると戻す。ページの `<audio>`／`<video>` は自動で、`new Audio()` は `trackMedia` で見る。
- 土星：▶ のクラブの間、ホームのコロリンは拍に合わせて1つおきに跳ねる（`beatHop`、試作の startSim3D）。
- 最初のタップまでは何も鳴らない（ページを開いただけでは鳴らない）。AudioContext はアプリ共通の1つ（`lib/onboarding/audio`：マナーモードで鳴らない）、惑星の音は親の音量 0.6 の下に効果音と音楽の2本。この端末の設定に従う：会話の〔声を消す〕（`obolo.talk.muted`）で全部消える、物語のミキサー（`obolo.story.mix` の se／bgm）で効果音と音楽の大きさ。ホーム・▶・空を閉じる（■）と、その音楽と待っている音は全部止まる。

### 05 のつづき（物語の部屋の答え 2026-11-25）
スクリーンショット：`docs/handoff/shots/uranus-home-goods*.jpg`・`atelier-goods*.jpg`・`neptune-game-cover*.jpg`・`atelier-game-cover-*.jpg`・`neptune-game-full.jpg`／`-closed.jpg`（390×844）。
- **グッズ（月のアトリエ）**：「グッズを作りたい」→ {bati} が言葉で聞く（ボタンなし）：種類（トート／Tシャツ／ステッカー／アクスタ／マグカップ／缶バッジ、`goodsKindOf`）→ どのアート（自分の木星のアートを小さく並べる。絵の名前・「いちばん新しいの」・「2番目」・「おまかせ」、`pickArt`）。言葉に先に出ていればその質問はとばす。ブルーナから持ってきたアートはそれを使う。そろったらすぐ作る（**無料**：絵は描かない。確認のカードなし・0マナ、小さな原価だけ。1日 `GOODS_PER_DAY`＝30。`docs/マナの値段.md` 3.）。名前＝アートの題名＋種類（「夕焼けトート」、`goodsTitle`）。絵はアプリがコードでアートを見本に合成（`components/planetTemplate/five/GoodsMock.tsx`。カード・天王星のビューア・棚が同じ物）。スペルの札は出さない（描かないので唱える物がない）。
  - 保存：`goods` 表（種類・元のアート `root_id`・`art_url`・題名・`flown_at`、migration `0062`）。作った時と飛ばした時に `goodsTags`。ブルーナの天王星のフォルダ・☆・消す（`DELETE /storage/works/goods/:id`）・ホームの〔外す〕・通報・見えなくするは他の作品と同じ。
  - {bati} のせりふ（仮・全スタイル）：`packages/shared/src/goods.ts` の `GOODS_LINES`・`GOODS_VARIANTS`。
- **〔星へ飛ばす〕**：グッズ（天王星）・本（冥王星）・ゲーム（海王星）も（`FLY_READY_KINDS`）。本は題名と1章（書き出し）がある時だけ（`canFly`）。飛んだ本は今のデータを読む（ホームの書き出し＝1章、開くと `GET /moon/books/:id` で全部の章）ので、あとで書いた章もそのまま見える。
- **海王星の PRESS START**：全画面で遊べる（`GameFull`、プレビューで確認：390×800 の枠）。✕で閉じると星のホームにもどる（開いていたケースのまま）。
- **金星の話題**：番組の題名を、土星のコロリンと同じ安いテキストモデルに聞く（`showTopicTags`、`@obolo/ai`、温度0・小さな JSON。原価はその要求の小さな原価）。答えが無い時（オフライン・失敗）は言葉のルールのまま。番組の説明・話した言葉はまだ保存していないので、題名だけ（`talk` に渡せば一緒に読む）。
- **ゲームのケースの絵**：ゲームができたら（最初の版）{bati} が聞く：自分のアートから選ぶ／{bati} が描く（アートと同じ値段 `jacketArt`、アートのスペル・OK・引き落としそのまま。描いた絵はアートとしても残る）／「いらない」でネオンの顔のまま。あとで「ケースの絵を変えて」でもう一度。`games.cover_url`（`PUT /moon/games/:id/cover {rootId|null}`、自分のアートだけ）。海王星のケース・棚が見せる。せりふ（仮）：`GAME_COVER_LINES`。
- **安全**：ダチ公開（dachi）の本・ゲーム・グッズは、流れ着いていない知らない人には開けない（`GET /moon/books|games|goods/:id` は 404）。Postgres を使うテスト `apps/api/src/craft/goods.test.ts`（`TEST_DATABASE_URL`、CI で設定：`.github/workflows/ci.yml` の `pnpm test` に Postgres 16 のサービスの URL を渡している。`moon-to-planet.pg.test.ts`・`readiness.pg.test.ts` も同じ変数で走る。テストは自分で migration を当てないので、CI は `pnpm test` の前に migration を当てる）。

## 月で作る → 星（M-R326 といっしょの依頼：8種類の点検）

月（工房・ブルーナ）で作ったものは、〔星へ飛ばす〕でその種類の星へ行く（`KIND_HOME_PLANET`）。飛ばす入口は工房のカード・ブルーナの作品カードの2つで、どちらも同じ `fly()`（`apps/web/components/atelier/makers.ts`）を呼ぶ。新しい家（`GET /planet-home/:planet`）は、下の「星の入れもの」をそのまま読む。

| 月で作るもの | 星 | 飛ばす時に呼ぶもの | 星の入れもの（表） | 飛んだ時刻（88時間のもと） | 開く時に要るもの |
|---|---|---|---|---|---|
| 声コロリン | 土星 | `POST /saturn/posts/:id/publish` | `saturn_posts`（`room` 1→0） | `created_at`（飛ばした時に今に直す） | 声 `voice_audio_url`・言葉 `text`・作った人のボール |
| アート | 木星 | `POST /jupiter/posts` `{rootId}` | `jupiter_posts`（`jupiter_roots` から1行作る） | 投稿の `created_at` | 絵 `url`・題 `title`・蝶の羽の切り方 |
| 曲 | 水星 | `POST /planets/mercury/posts` `{sourceId: 曲}` | `planet_posts`（`kind` song） | 投稿の `created_at` | 音 `url`・歌詞と時間（曲から）・曲名の読み上げ |
| 動画・MV | 火星 | `POST /planets/mars/posts` `{sourceId: 裏スタジオ}` | `planet_posts`（`kind` video） | 投稿の `created_at` | 動画 `url`・ポスター `poster_url` |
| ラジオ | 金星 | `POST /venus/shows/:id/publish` `{on}` | `radio_shows`（`status` public） | `published_at` | 音 `audio_url`・絵 `thumb_url` |
| グッズ | 天王星 | `POST /moon/goods/:id/fly` `{on}` | `goods.flown_at` | `flown_at` | 種類 `kind`・のせた絵 `art_url` |
| 本 | 冥王星 | `POST /moon/books/:id/fly` `{on}` | `books.flown_at` | `flown_at` | 表紙 `cover_url`・1章の書き出し（本文は `GET /moon/books/:id`） |
| ゲーム | 海王星 | `POST /moon/games/:id/fly` `{on}` | `games.flown_at` | `flown_at` | ケースの絵 `cover_url`・遊び方（遊ぶ版は `GET /moon/games/:id`） |

どの種類も：飛ばすとタグとチェックが付く（`planet_work_meta`）。自分の場所にはずっと、ダチ・推しのホームには88時間、大陸には「公開（public）でチェックに通った時」だけ出る。〔外す〕（`DELETE /planet-home/:planet/own/:id`）で星から消え、ブルーナと工房のカードの「星にいる」も消える。月で捨てる（`DELETE /storage/works/:kind/:id`）と星からも消える。種類ごとに1本ずつ、本物の Postgres での通しの試験がある（`apps/api/src/planets/moon-to-planet.pg.test.ts`。`TEST_DATABASE_URL` がない時は飛ばす）。

点検で直したこと（2026-11-27）：
- アートを月で捨てても、木星の投稿が残っていた → いっしょに消える。
- 飛ばした曲を月で直す（自分の声で歌い直す・言葉を変える・調整）と、水星では前の音に新しい歌詞の時間が重なっていた → 飛んだ投稿が今の音についていく（`planets/song-follow.ts`）。
- ラジオだけ、一度さげてから飛ばし直しても88時間が始まり直さなかった → ほかの種類と同じに、飛ばし直すと今から88時間。
- ブルーナがアートと動画の「星にいる」を知らなかった（何度も飛ばせて、同じ絵が木星に何枚も出た）→ 分かるようにした。

決まったこと（物語の部屋 2026-11-27・M-R331。スイッチに関係なく、いつも）：
- **1つの作品＝1つの投稿**：アート・曲・動画も、飛ばし直すと同じ投稿が新しくなる（今の絵・音・動画・題になり、88時間が今から始まる。〔外す〕のあとに飛ばし直しても同じ投稿）。2つ目の投稿はできない（`planets/one-post.ts`、`JupiterService.create`・`PlanetPostsService.create`）。★・返信・公開範囲・タグはその投稿に残る。
  - この決まりの前に2回飛んでいた作品（同じ作品に生きた投稿が2つ）：前の画面ではそのまま読める。新しい家・大陸・曲を開く所は、いちばん新しい1つだけを出す（`newestOfArt`・`newestOfSource`）。〔外す〕は全部いっしょに外す。**migration・backfill は無い**（消さない・書きかえない）。
- **88時間たって帰ってきた時の知らせ**（{bati}の「〜から帰ってきたよ」）：グッズ（天王星）・本（冥王星）・ゲーム（海王星）も入る（`MoonWorksService.homecomings`）。★の数え方：前の画面の★（star_events）と、新しい家の☆＝ブルーナにしまった人（bluena_saves）を合わせて、1人1回。グッズ・本・ゲームは☆だけ。飛ばし直して、もう一度帰ってきたら、もう一度知らせる（知らせた時刻と、帰ってきた時刻を比べる）。しまう場所の言葉（仮）：お店・図書館・ゲーム小屋（`HOME_PLACE`）。
- **MV を作り直した時**（場面の描き直し・切り方の変更・歌詞入り）：飛んでいる火星の投稿が、今の動画・ポスター・長さになる。投稿は新しい裏スタジオの動画のものになる（ブルーナの「星にいる」が新しい動画に付き、それを飛ばしても同じ投稿）。題・88時間・★はそのまま（`planets/mv-follow.ts`）。
- **曲の題を、作ったあとに言葉で変える**：「タイトルは〇〇にして」「〇〇ってタイトルにして」「曲名は〇〇にして」（`songTitleTalk`、@obolo/shared）。いちばん新しく作ったカードが曲ならその曲、言葉に「曲名・曲の名前」があればいちばん新しい曲。`PATCH /compose/songs/:id/title`：題のチェック（アートの題と同じ。だめなら `MODERATION`）→ 曲の題・飛んでいる水星の投稿の題 → 曲名の読み上げを作り直す（`song.title` の仕事）。{bati}のせりふはアートの題と同じもの（`ART_TITLE_LINES` の changed・flagged・failed）。「ほかのタイトルにして」（{bati}の別の案）は曲にはまだ無い。
- **新しい家に入る作品の出どころ**：スイッチを入れた星は、前の画面の投稿の入口を閉じる（下の「新しい家への切り替え」）。作るのは月だけ。

## 切り抜き（M-R325・M-R326・M-R328）

本番の切り抜きは1つ（`apps/api/src/media/cutting.ts`。中身は `cut.ts` と `keying.ts`）。通るもの：星の姿9つ（土星のボールも）、コロリンのデザインと蝶、立ち姿・ちび・話す時の表情と部品・後ろ姿、{bati}の絵。Web では切り抜かない（PNG を見せるだけ）。蝶の羽の切り方は、切り抜いた絵で測る（切り直したら測り直す）。

切り方（M-R325）：背景の色はふちの中央値で測る／外側は「背景色との差12以下」で「りんかくがない（明るさの勾配60未満）」所だけをふちから塗り進める／ふちにつながらない背景色のかたまりは「絵の0.06%以上・平ら（差の平均7以下、明るさのばらつき3以下）・まわりの輪（3px）が背景色でない（差の平均45超）」時だけ消す／キー色の絵はキーで抜いたあと、ふちから「キー色との差60未満」の所をもう一度消す。こちらで足したもの：輪の2割以上が背景より100以上暗い（りんかく）時だけ穴とする（明るい体のつやを守る）／姿の3割より大きい「穴」は体なので消さない（海王星の泡は別）／床の影（下45%、背景より暗いだけで色がなく、なめらか）は消すが、その上に姿がある時は消さない。

確かめ（M-R326、`inspectCut`）：a 面積（種類ごとの範囲 `CUT_AREA`：ボール20〜75%、蝶20〜72%、土星のちび10〜62%、船12〜55%、UFO 12〜60%、DJ 14〜60%、風船10〜55%、本14〜65%、泡16〜75%、ほか4〜90%。食べられた（外とつながった消えた所が、姿に8方向で囲まれている割合8%超／穴の合計35%超）・残った（ふちの25%超が残る）も a）／b 中の背景色のかたまり／c ふち2pxの15%超が背景色／d 背景を取るモデルの切り抜きとの IoU 0.9未満／e 見るモデル（Gemini Flash-Lite）が NG。モデルがない時（鍵なし・テスト）は d・e を飛ばす。

やり直し（`cutLadder`）：色で切る → 背景を取るモデルの切り抜き → 服と重ならないキー色で描き直す（白い背景の姿もキー色で）→ もう一度描き直す。通った所で止まる。全部落ちたら見せない：星の姿は前の姿のまま（その姿にまだ無い時は、今までどおり型の代わりの絵）、`planet_figures` の `<姿>#cutfail` に「colour:shape|model:area|…」を残し、ログに出す。**立ち姿・ちび・{bati}の絵（生まれた絵・着せ替えの候補）** は代わりの絵がまだ無いので、全部落ちた時は色で切った絵を今までどおり使い、ログに出すだけ（決めてほしいこと）。コロリンのデザインは、落ちた候補を出さない。

表情と後ろ姿（2026-11-27 利用者決定：背景なしで見せる絵は、いつも同じ仕組みできれいに切る）：{bati}の表情（`batiFaces`）、話す時の表情とまばたき・口の部品（`talkLook`、自分と{bati}）、後ろ姿（`backView`）は、`LookService.cutOrNothing` → `ladder` → `cutLadder` を通ってから保存する。やり直しは3回まで（モデルの切り抜き → 残りのキー色2つへ1回ずつ背景を描き直す）。全部落ちたら**保存しない・見せない**（星の姿と同じ）：表情はふつうの顔が代わり、部品は無し（ゆれるだけ）、後ろ姿はアプリの代わりの絵。キー色の背景がついたままの絵を保存することも無くなった。記録は `onboardingJson` の `bati.faces.cutfail`／`look.back.cutfail`（`{ of: 元の絵, faces: { 顔: "colour:vision|model:…" } }`。元の絵が変われば無効）で、同じ絵については描き直さない。ログは `[Look] cut-out failed every retry and is not shown (…)`（error）と、落ちた段ごとの `cut-out of …: <段> failed its checks`（warn）。やり直しの原価：マナを引いた仕事の中（プロフィールの姿）ならその仕事の原価に入るだけで、もう一度引かない。それ以外（{bati}の表情など、小さな原価として引く所）では、最初の確かめに落ちた後の分（描き直し・その確かめ）を `cutRetry` として運営が吸収する（`ABSORBED_FEATURES`）。

前の人の姿（切り抜く前の絵は残していなかった）：`POST /admin/figures-recut` は、切り抜いた PNG の上でできることだけをする — 中に残った背景（すきま）は消せる。**食べられた白は戻せない**（描き直しが要る）。同じ確かめをして、通ったものは入れかえ（`#cut` r2）、落ちたものは前の絵のまま印を付ける（`#cut` x2:…）。これからは切り抜く前の絵も残す（`<姿>#src`）ので、次に切り方を変えた時は描かずに切り直せる。

火星（M-R328）：UFO の下から光を出さない。プロンプトの版を `mars#v` に残す（今は 2）。前の火星の姿は `POST /admin/figures-repaint` で描き直す（今着ている姿だけ。確かめとやり直しを通す。運営がかぶる）。見本の6人の火星の姿 `apps/web/public/planets/sample/fig-mars-{user,kimorin,monban,mikie,brother,sister}.webp` は、物語の部屋が描き直した絵（`design/mv-art/out/p5-mars-*.jpg`）を本番の切り抜きと確かめに通して入れかえた（`npx tsx apps/api/scripts/sample-figures.ts mars <絵のフォルダ>`）。光の出ている絵でまだ残っているファイル：`apps/web/public/planet-home/sp-ufo.webp`（知らない人の UFO の見本）、ラボの見本 `art/lab/runware-planet-avatar/mars-ufo__*.jpg`（前のプロンプトの記録）。

## 新しい家への切り替え（準備だけ、M-R326）

今の星の画面を、新しい家（共通の型。今は `/planets-preview/<星>` だけ）に替えるためのスイッチ。**切ったまま**（進め方は依頼主と確認中）。前の画面のコードは残す。スイッチは **Web と API の2か所**（同じ決まり `planetHomeIsNew`、@obolo/shared）。必ず両方を同じに入れる。

| 変数（Vercel、ビルドの時に入る） | 意味 | 今 |
|---|---|---|
| `NEXT_PUBLIC_PLANET_HOMES` | `new` で全部の星が新しい家。ほかの値・空は前の画面 | 空 |
| `NEXT_PUBLIC_PLANET_HOMES_NEW` | ここに書いた星だけ新しい家（例 `saturn,jupiter`）。上が空でも効く | 空 |
| `NEXT_PUBLIC_PLANET_HOMES_OLD` | ここに書いた星は前の画面のまま（上が `new` でも）。両方に書いた星は前の画面 | 空 |

| API（Cloud Run の変数、入れると新しいリビジョン。ビルドは要らない） | 意味 | 今 |
|---|---|---|
| `PLANET_HOMES` | `new` で全部の星。Web の `NEXT_PUBLIC_PLANET_HOMES` と同じ | 空 |
| `PLANET_HOMES_NEW` | ここに書いた星だけ。Web の `…_NEW` と同じ | 空 |
| `PLANET_HOMES_OLD` | ここに書いた星は前のまま。Web の `…_OLD` と同じ | 空 |

効く道：`/saturn` `/jupiter` `/mercury` `/mars` `/venus` `/uranus` `/neptune`、それと `/pluto`（冥王星には前の画面がないので、スイッチが入った時だけある。切っている間は今までどおり「見つかりません」）。太陽系の入口（`/` の `SolarSystem`）は道を変えない（冥王星は入口に無い：新しい家の星の切り替えから行く）。わくは前のまま：上の帯、ログインの壁、旅の鍵（金星・天王星・海王星の `PlanetGate`）。

**スイッチを入れた星は、前の投稿の入口を閉じる**（物語の部屋 2026-11-27。切っている間は何も変わらない）：
- Web：その星の道は新しい家だけを出す。土星の〔つぶやく〕〔器〕〔広場〕、木星・水星・火星の星の上の投稿、金星のブース（`?dj=1`・`?booth=1` も新しい家になる）は、画面に出ない。
- API：前の入口は **403 `MADE_ON_MOON`** で断る（`planets/moon-only.ts`。変数は呼ばれるたびに読む）。
  - 土星：`POST /saturn/posts`（部屋にしまうだけ＝`room: true` は通す。月の工房のコロリン）、`POST /saturn/plazas`
  - 木星：`POST /jupiter/posts`・`POST /jupiter/posts/:id/replies`
  - 水星・火星：`POST /planets/:planet/posts`・`…/posts/:id/replies`
  - 金星：`POST /venus/shows`・`POST /venus/lives`
  - 月の〔星へ飛ばす〕と月の録音は `via: 'moon'` を付けて同じ道を通る（`makers.ts fly`・`keepShow`、ブルーナの〔投影〕）。`POST /saturn/posts/:id/publish`・`POST /venus/shows/:id/publish`・`/moon/*/fly` は月の道なので閉じない。
- 前のデータを見るのは、そのまま（読む道は閉じない。★・フォロー・〔外す〕・消すも前のまま）。
- 前のアプリを開いたままの人（切りかえの前に読みこんだ画面）は、投稿しようとすると断られる（前の画面の「できなかった」の言葉が出る）。

**何も無い人の新しい家**（B7）：本当の星の道では、作品が1つも無く、だれも来ていない人には、**自分の場所だけ**を出す（見本の顔ぶれは出さない。`liveHomeShows`・`emptyHome`）。見比べ用の `/planets-preview/<星>` と、物語の中は、今までどおり見本・台本の顔ぶれ。

**はじめの旅（3〜7日目）**：スイッチを入れた星の日は、物語の中の星の画面が新しい家になる（物語 M-R330。`lib/onboarding/newHomeScenes.ts`・`components/onboarding/StoryNewHome.tsx`・`lib/planetTemplate/storyCast.ts`）。切っている間は、前の日のまま（`DAYn_BEFORE`、1字も変えていない）。
- 台本（物語のブランチ `f733ae6a`＝M-R334 まで。M-R330 を含む）を取り込んだ。`story-sync` は**新しい家の日**（`STORIES_NEW_HOMES`）と台本を照らし合わせる：0件。
- 物語のブランチの M-R336（`c0bb5ea7`：3日目にスシモンがロケットに乗る・2日目の「8回まで」）は**まだ取り込んでいない**（新しい話者7人の絵と声が要る）。
- 並ぶ人：その星の住人の場所（土星 たこ焼き兄妹・木星 大根カイザー・水星 フリージー・火星 ヒポキン・金星 ボスG）には KIMORIN⭐︎（推し。『プリプリ・ボカン』／「うんち。」／すね毛）・MONBAN（ダチ）と、見本の住人。{neo}の場所には、招待した人（いなければ MIKIE⭐︎DRILL）と KIMORIN⭐︎、その朝に飛ばしていれば{neo}の作品。
- 進むきっかけ：住人の場所＝〔次へ〕（前の土星と同じ。さわる・▶・空は自由）。{neo}の場所＝台本の「扉をタップする」：自分の場所を開くと〔次へ〕が出る。土星の{neo}のレコードは〔次へ〕（前は「全部聞くと進む」もあった）。
- 場面の対応とスクリーンショット：`docs/handoff/shots/story-<日>-<星>[-neo][-door|-play].jpg`（390×844。`npx tsx apps/web/scripts/story-home-steps.ts` が場面の番号を出す → `/kakunin-…/play?day=N&i=<番号>`）。
- まだ：新しい台詞の声（`public/story/voices/lines`、声の仕事はまだ回していない）。旅のあとの案内（`AfterScreens`）・2周目（`lap2`：`AtelierVisit`・`IslandWorks` が前の部品）・練習（`SaturnLesson` など。3〜7日目はもう呼ばない）は前のまま。

**スイッチを入れる時の順番**：
1. データの準備（下の「今あるデータの準備」）：`works` → `figures` → `recut` → `mars-repaint` → `wings` → `title-voice` → `readiness` が `ready: true`。
2. API の変数（`PLANET_HOMES` か `PLANET_HOMES_NEW`）を入れる → 前の入口が閉じる。
3. すぐ続けて Web の変数（`NEXT_PUBLIC_PLANET_HOMES…`、同じ星）を入れてビルド → 新しい家が出る。（2 と 3 の間は、前の画面から投稿できないだけ。逆の順だと、開いたままの前の画面から投稿が入る）
4. もどす時：Web → API の順に空にする。

**今あるデータの準備**：`GET /admin/planets-readiness`（数えるだけ）と、GitHub の Actions「Planets backfill」（`.github/workflows/planets-backfill.yml`。Cloud Run の一度きりのジョブ、管理トークンは Google Cloud の中）。`action` で選ぶ。順番（`all` はこの順）：

1. `works` — 前の作品のタグとチェック（大陸に要る）。全部 0 になるまで。
2. `figures` — まだ無い星の姿を描く（描く：運営がかぶる）。裏で描くので、少し待ってもう一度。
3. `recut` — 前の姿を描かずに切り直して確かめる。`members` が 0 になるまで。
4. `mars-repaint` — 光の出る火星の姿を描き直す（描く：運営がかぶる）。
5. `wings` — 蝶の羽の切り方を測る（切り直し・描き直しのあと）。
6. `title-voice` — 声のある人の水星の曲名を読む（運営がかぶる）。
7. `readiness` — もう一度数える。`ready: true` になるまで緑にならない。

`planets-readiness` の数：`worksWithoutTags`（種類ごと）、`figures.membersMissing`／`membersWithNone`（姿が足りない人／1つも無い人）、`membersToRecut`（切り直す前の姿がある人）、`figuresToRepaint`（切り直しても確かめに落ちた前の姿：描き直しが要る）、`cutFailures`（やり直しに全部落ちて見せていない絵）、`oldPrompt`／`oldPromptOtherLooks`（光の出る火星の姿：今の姿／ほかの姿）、`wingsNotMeasured`、`songsWithoutTitleVoice`。`figuresToRepaint`・`cutFailures`・`oldPromptOtherLooks` は `ready` に入れていない（運営が見て決める）。

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
| `GET /admin/planets-readiness` | 切り替えの前に：まだ準備のできていないデータの数（M-R326） |
| `POST /admin/figures-recut?limit=` | 前の星の姿を描かずに切り直して確かめる（M-R325／M-R326） |
| `POST /admin/figures-repaint?limit=` | 光の出る火星の姿を描き直す（M-R328、運営がかぶる） |
| `GET /planet-works/planet_post/:id/song` | 02 水星：曲を開く（音・ジャケット・曲名・歌詞と時間） |
| `GET /planet-home/:planet` | 前から。作品に `tags`、自分の作品に `visibility`・`heldReason` が付いた |
| `POST /moon/books/:id/fly` ・ `POST /moon/games/:id/fly` `{on}` | 05：本を冥王星へ・ゲームを海王星へ飛ばす（`on:false` で月へ） |
| `POST /moon/goods` `{kind, rootId, title?}` ・ `GET /moon/goods` ・ `GET /moon/goods/:id` ・ `POST /moon/goods/:id/fly` `{on}` | グッズ：自分のアートで作る（無料）・一覧・開く・天王星へ飛ばす |
| `PUT /moon/games/:id/cover` `{rootId \| null}` | ゲームのケースの絵（自分のアート、null でネオンの顔） |
| `GET /moon/games/:id` ・ `GET /moon/books/:id` | 05：飛んだゲーム・本は、その星のホームに届く人も開ける |
| `PATCH /compose/songs/:id/title` `{title}` | 曲の題を言葉で変える（水星の投稿の題・曲名の読み上げも）。2026-11-27 |
| `GET /planet-home/:planet/person/:id` | 04 土星：その人の過去の作品（プロフィールの2D舞台）。自分＝自分の作品、ダチ・見られる推し＝88時間なしで、ほかの人＝何も返さない（`person: null`）。新しい順・24まで |

## まだのこと
- 公開範囲の初期値（依頼主の答え待ち。今は dachi）。
- 大陸の絵：水星（0058）・木星（0059）・土星（0060）の90枚、5惑星（0063）の160枚は全部入った。
- 05 のつづき：グッズ・ケースの絵の {bati} のせりふは仮（物語の部屋で確認）。金星の番組の説明・話した言葉は保存していない（話題は題名だけから）。おためしのデモでは、{bati} が描いたケースの絵は `idb:` のままなので海王星では出ない（本番は https）。
- 木星（03）：題名の字体と出方を作る時に AI が選んで保存すること、題名の読み上げの声、題の提案と変更の{bati}のせりふ（仮）を物語の部屋で確認。羽の切れ目の自動測定は本番の姿の絵で見比べ（肌色の無い姿・顔が横を向いた姿は初期値になる）。
- 木星のスタイル：アートのスペルの style に **ゆめかわ・和モダン・レトロ・ポップ** を足した（`packages/shared/src/spell.ts`、スペルのモデルの案内 `packages/ai/src/prompts/spell.ts` も）。これからのアートはその広場に画風でも流れ着く。
- 絵の自動チェック（P-MOD-1）。
