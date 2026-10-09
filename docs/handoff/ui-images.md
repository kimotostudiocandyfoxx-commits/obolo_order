# UIの画像をくり返し作る方法（デザイン担当チャット向け）

画面の案・キャラ・場面の絵を、**Novita AI** で何枚でも作って見比べられます。
この作業環境から Novita には直接つながらないので、**GitHub Actions が代わりに描いてブランチに保存** します。

## しくみ

```
あなた：design/ui-queue.json に「描いてほしい絵」を足す → commit → push
      ↓（GitHub Actions「UI images」が自動で動く。1〜3分）
GitHub：Novita で描いて design/ui/out/<id>-1.jpg に保存 → 同じブランチに commit
      ↓
あなた：pull → 画像ファイルを開いて見る → 直してまた足す（くり返し）
```

## 1. 描いてほしい絵を足す

`design/ui-queue.json` の `items` に足します。**一度描いた id は描き直さない**ので、直すときは id を変えます（`-v2`, `-v3` …）。どうしても同じ id で描き直すときは `"redo": true`。

```json
{
  "items": [
    {
      "id": "mars-mv-chat-v2",
      "model": "qwen",
      "size": "864*1536",
      "prompt": "A mobile app screen mockup, portrait ... Japanese text \"おまかせで作って\" ..."
    },
    {
      "id": "kimorin-happy-v1",
      "model": "animagine",
      "n": 2,
      "prompt": "1boy, fox mask, red robe, white mask with blue patterns, smiling, waving, simple background"
    }
  ]
}
```

| 項目 | 内容 |
|---|---|
| `id` | ファイル名になる（英数字とハイフン）。画面名-版 がおすすめ：`saturn-home-v3` |
| `model` | `qwen`＝**画面・UI**（文字・ボタン・レイアウトが得意、日本語の文字も入れられる。1枚 約3円）／`animagine`＝**キャラ・場面のアニメ絵**（Novita が古いアニメ用APIを終了したため、今は Qwen-Image にアニメ調の指定を足して描く。1枚 約3円。※自前GPUの Animagine に切り替わったらここを更新） |
| `size` | `幅*高さ`（256〜1536）。省略時：qwen はスマホ縦画面 `864*1536`、animagine は `832*1216` |
| `n` | animagine だけ：1回に何枚（1〜4）※いまは1枚ずつ |
| `negative` | animagine だけ：入れたくないもの（文章で「Avoid: …」として足される） |
| `prompt` | 英語で書くのがおすすめ。画面に出す日本語の文字は `"…"` で囲んで書く |

**プロンプトのコツ（qwen・画面）**：「A mobile app screen mockup, portrait」から始めて、上から順に何があるかを書く（上のバー、タブ、キャラ、吹き出しの文字、ボタンの文字と色）。世界観（宇宙、星ごとの色）も書く。

## 2. push して、できるのを待つ

```bash
git add design/ui-queue.json
git commit -m "UI queue: 火星のMV作成画面 v2"
git push -u origin <いまのブランチ>
```

できるまで待つ（バックグラウンドで実行すると、終わったら知らせてくれる）：

```bash
until git fetch -q origin <いまのブランチ> && git log --format=%s HEAD..FETCH_HEAD | grep -q "UI images"; do sleep 20; done; git pull --rebase origin <いまのブランチ>
```

## 3. 見る

- 画像：`design/ui/out/<id>-1.jpg`（animagine で `n` が2以上なら `-2`, `-3` …）
- 結果のまとめ：`design/ui/out/_last-run.md`（✅ 描けた／❌ 失敗の理由／⏭ 次回に回した）
- クライアントに見せるときは、その画像ファイルを送る

## 決まりごと

- 1回の push で描くのは **24枚まで**（超えた分は次の push のときに描かれる）。
- 費用の目安：いまはどちらも1枚 約3円。**1日 qwen 200枚（約600円）を超えそうなときは、先にクライアントに確認**する。
- 子ども向けアプリなので、不適切な絵は自動で捨てられる（animagine）。プロンプトにも入れない。
- 画面の絵はあくまで「案」。実装担当は、決まった案を見ながらコードで画面を作る（画像をそのまま画面に使うわけではない）。キャラや背景の絵は、そのまま素材として使うこともある。
