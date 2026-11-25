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
  - MV・ラジオ（と、これからのグッズ・物語・ゲーム）：同じ形の `genericTags()`。**値は 02 以降の文書で決まる**（今は空）。
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
- §2 タップ：船が手前（画面の .5／.84、2.15倍）へ、ホームが寄ってぼける。0.45秒でその曲（もう一度タップするまでループ、M-R282）と**ピクチャーディスク**（ジャケットが円盤いっぱい・溝・穴）。歌詞は曲の時間に合わせて1行ずつ（左から白く色づく・次の行がうすく下）。2.2秒で曲名（曲ごとの字体と出方：試作の5曲は試作の組、ほかはジャンルから。字の種類で大きさ）。曲名の読み上げは `titleVoice` があれば鳴らす（今は無い：null）。「NOW PLAYING」・by は出さない。
- データ：`GET /planet-works/planet_post/:id/song` → `PlanetSongView`（音・ジャケット・曲名・`titleVoice`・`lyrics: [{t, end, text}]`）。歌詞の時間は曲の作りから計算（MV の焼きこみ歌詞と同じ `compose/lyrics.ts timedLyrics`）。歌詞の無い曲・曲の元が無い投稿は歌詞なし。見られるのは、作った人・ダチ／推し・その曲が public で流れ着く人だけ。
- §3 ▶：自分（`/me chibiPic`、見本は試作の踊る絵）が家から飛び出す → 夜の桟橋（花火）、右下に後ろ姿。船が左から来て手前で止まり、ディスク・曲名・歌詞・曲を**最後まで**、終わると右へ去って次。全部で「🏝 今日の曲、全部聴いたね！」。■・画面タップで止める。（`config.play`：道すじ・`untilDone`・夜・花火・踊り）
- §4 プロフィール：浜辺にその人の曲のレコードがスタンドに立って並ぶ（横スクロール）。タップでディスク・曲名・歌詞・曲（そのレコードも回る）。
- 空（06 の先取り・M-R295〜M-R312）：ホームで2本指でつまむ（PC は ctrl+ホイール）と「じぶんの空」（じぶんの島＋お気に入り5大陸）。〔🔍 大陸をさがす〕・☆（5つ埋まっていれば「どの島と入れかえる？」→ 島をタップ）・〔✈ 旅〕（まだ見ていない6大陸）。島をタップで降りる：流れ着いた知らない人の船が航行（海の上だけドラッグ可）、タップで曲＋作った人（船の姿と名前）＋☆（ブルーナ）♡（推す）⋯（表示しない／通報）。右上▶で岸（`shore_url`）から1隻ずつ、止めるまでずっと。つまむ／← で空へ、空で広げる／じぶんの島でホームへ。15歳未満には作品が出ない。データは 2-4／2-5 の API。見本は試作の10大陸と曲（ブラウザの中だけ）。
- 大陸の絵：水星の10大陸 ×3枚（空の島・降りた景色・岸）を試作から書き出し（`public/planets/continents/mercury/`、migration `0058` で URL を入れた）。残りは木星・土星の 60 枚。

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

## まだのこと
- 公開範囲の初期値（依頼主の答え待ち。今は dachi）。
- 大陸の絵：水星の30枚は入った（0058）。木星・土星の60枚。
- MV・ラジオ・グッズ・物語・ゲームのタグの値（02 以降）。
- 木星のスタイル：アートのスペルの style に **ゆめかわ・和モダン・レトロ・ポップ** を足した（`packages/shared/src/spell.ts`、スペルのモデルの案内 `packages/ai/src/prompts/spell.ts` も）。これからのアートはその広場に画風でも流れ着く。
- 絵の自動チェック（P-MOD-1）。
