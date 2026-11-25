# 惑星の作り直し：データの土台（引き継ぎ 01・2章）

物語セッションの引き継ぎ `docs/handoff/planets-01-foundation.md`（ブランチ claude/hopeful-pascal-udqkh2）の **2章 データの土台** を本番に入れたもの。
今の惑星の画面（M-R314 で没案）はまだ消していない。新しい惑星の画面（3章・惑星ごとの 02〜）は、この土台の上に作る。

ルールの本体は `packages/shared/src/planetWorks.ts`（純粋な関数。API と web で同じものを使う）。
API は `apps/api/src/planets/planet-works.service.ts`・`continents.service.ts`・`continents.controller.ts`。
表は migration `0056_planet_works.sql`。

## 2-1 作品のタグ（ユーザーには見せない）
- 表 `planet_work_meta`（`kind` + `work_id` で1行。kind は `planet_post`・`jupiter_post`・`saturn_post`・`radio_show`）：`main`（主分類1つ）、`moods_json`（雰囲気、10まで）、`bpm`（曲だけ）。
- **作った瞬間に付ける**：各ストアの作成（`PlanetPostsService.create`・`JupiterService.create`・`SaturnService.create`・`RadioService.createShow`）が `PlanetWorksService.tag()` を呼ぶ。失敗しても作成は止めない（ログ → backfill で拾う）。
- 値はスペル・設定から自動：
  - 曲（水星）：`songs.designJson` の genre・mood・bpm（＋アトリエで作った曲は、はいと言ったスペル `designJson.spell` も入るようにした）→ `songTags()`。スタジオのジャンル（約50）は大陸の言葉（EDM／ヒップホップ／バラード／ロック／ローファイ／シティポップ／アニソン／ジャズ／J-POP）に寄せる。表にないジャンルはそのままの名前。
  - アート（木星）：根っこ（`jupiter_roots.spell_json`、アトリエが `POST /jupiter/roots` に `spell` を添える）のスペルの style が主分類、color・light・mood・theme が雰囲気 → `artTags()`。アニメ風→アニメ塗り など。写真（スペルなし）は空。
  - MV・ラジオ・コロリン（と、これからのグッズ・物語・ゲーム）：同じ形の `genericTags()`。**値は 02 以降の文書で決まる**（今は空）。
- 前からある作品：`POST /admin/planet-works-backfill?limit=200`（x-admin-token）。曲は designJson から、アートは根っこのスペルが分かる時だけ付く。0 件になるまで繰り返す。

## 2-2 作品ごとの公開範囲
- `dachi`（ダチ・推しのホームだけ）／`public`（知らない人の大陸にも流れ着く）。`planet_work_meta.visibility`、**null = 初期値に従う**。
- 初期値は **1つの定数** `PLANET_WORK_DEFAULT_VISIBILITY`（`packages/shared/src/planetWorks.ts`、今は `'dachi'`＝物語の案、依頼主の答え待ち）。null の作品は全部これに従うので、1行変えれば前の作品も一緒に切りかわる。
- 効いている公開範囲（`effectiveVisibility`）：public を選んだ（または初期値が public）**かつ** 自動チェックが通った（`check_state = 'ok'`）時だけ public。行のない作品も public にならない。
- `dachi` の作品は **大陸・検索（数）・旅、ホームの遠くの景色（far）** に絶対に出ない（SQL：`continentWhere`、`farWhere` の `isPublicWork`）。
- 持ち主だけが変えられる：`PUT /planet-works/:kind/:id/visibility {visibility}`。

## 2-3 作品単位の通報・非表示・自動チェック
- 〔⋯〕「この人を表示しない」＝今の `POST /comms/block`（user_blocks）。
- 〔⋯〕「通報する」＝今の `POST /planet-works/:kind/:id/report`。作品単位で `user_reports`（kind＋target_id）に入り、**その作品は本人に見えなくなり（work_hides）、その人もブロック**（comms の block をそのまま使う：フォローは両方向とも切れる）。
- 自動チェック：作品が作られた時に1回、言葉（題・ひとこと・タグ）を作る時と同じ `moderateText`（@obolo/ai）で見る。通らなければ `check_state = 'held'`・`check_reason` に理由（カテゴリ）。held の作品は public を選んでも dachi のまま。
- **絵のチェックはまだない**（P-MOD-1）。アトリエで描いた絵は、チェックを通ったスペルから描かれる。アップロードした写真は見ていない。

## 2-4 大陸（データ）
- 表 `continents`：planet、key、name、`creator_id`（null＝運営。M-R297 のユーザーの大陸はここに行を足すだけ）、`rule_json` `{g, m, bpm?}`、`tags_json`（さがす時の #タグ）、絵3枚 `sky_url`（空から見た島）・`land_url`（降りた景色）・`shore_url`（岸から見た景色）、`sort_order`。
- 流れ着く判定（試作 `workScore`）：主分類が合えば +3、雰囲気1つごとに +2、bpm の範囲外なら −2（何か合った時だけ）。**2点以上で流れ着く**。1つの作品が複数の大陸に流れ着く。並びは点の高い順、同点はランダム（人気順にしない）。
- 種：水星・木星の10ずつ（試作の CONT／RULE そのまま）。試作で「by Nagi」などとなっていた5つも、本当の会員ではないので運営の大陸として入れた。お気に入りの初期値は `sort_order` の先頭5つ（試作の運営の5つ）。
- **まだない絵**：20大陸 × 3枚 ＝ 60枚（全部 null）。

## 2-5 ユーザーごとの保存
- お気に入りの大陸：`planet_homes.continent_favs_json`（5枠、null＝空き）。一度も選んでいなければ運営の5つ。消えた大陸の枠は空きになる。☆は空き枠へ、5つ埋まっていれば 409 `FULL`（枠を言えば入れかえ）。
- ブルーナ（☆ 作品の保存）：今の `bluena_saves` に `kind` を足して、どの惑星の作品でも入るようにした（前の行は `planet_post`）。自分の作品・ブロックした人の作品は入らない。
- 推し：今の follows のまま。空（大陸）で推した知らない人も、次からその惑星のホームに来る（ホームの around は follows を見る。planet-home.test.ts）。
- 見た大陸：表 `continent_seen`（`shown_at`＝旅で見せた、`landed_at`＝降りた）。〔旅〕はまだ見ていない大陸から、次に見たのが一番前のもの。

## 2-6 自分の姿
- `figureFor(planetFigures, planet)`（@obolo/shared）：`GET /me` の `planetFigures` から、その惑星で乗っている自分（土星＝コロリン：ちびキャラ＋ボール、木星＝蝶、水星＝船、火星＝UFO、金星＝DJ、天王星＝風船、冥王星＝本、海王星＝泡）。読むだけ（作るのは look のコード）。

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
| `POST /planet-works/:kind/:id/report` ・ `…/hide` | 通報（＋非表示＋ブロック）・見えなくする（前から） |
| `POST /admin/planet-works-backfill?limit=` | 前の作品のタグ・チェック |
| `GET /planet-home/:planet` | 前から。作品に `tags`、自分の作品に `visibility`・`heldReason` が付いた |

## まだのこと
- 公開範囲の初期値（依頼主の答え待ち。今は dachi）。
- 大陸の絵 60枚。
- MV・ラジオ・グッズ・物語・ゲーム・コロリンのタグの値（02 以降）。
- 木星のスタイル：スペルの style（水彩・油絵・クレヨン・絵本風・アニメ風・ドット絵・切り絵・えんぴつ画・立体）にゆめかわ・和モダン・レトロ・ポップがない。その大陸には雰囲気（パステル・和風・ポップ・あざやか）で流れ着く。
- 絵の自動チェック（P-MOD-1）。
