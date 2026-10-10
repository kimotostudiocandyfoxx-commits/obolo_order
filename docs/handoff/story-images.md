# 物語の画像をくり返し作る方法（物語担当チャット向け）

物語の場面・キャラ・背景の絵を、**Seedream 5.0 Pro**（ByteDance）で何枚でも作って見比べられます。
この作業環境から画像サービスには直接つながらないので、**GitHub Actions が代わりに描いてブランチに保存** します。

## しくみ

```
あなた：design/story-queue.json に「描いてほしい絵」を足す → commit → push
      ↓（GitHub Actions「Story images」が自動で動く。1〜3分）
GitHub：Seedream 5.0 Pro で描いて design/story/out/<id>-1.jpg に保存 → 同じブランチに commit
      ↓
あなた：pull → 画像を開いて見る → 直してまた足す（くり返し）
```

## 1. 描いてほしい絵を足す

`design/story-queue.json` の `items` に足します。**一度描いた id は描き直さない**ので、直すときは id を変えます（`-v2`, `-v3` …）。どうしても同じ id で描き直すときは `"redo": true`。

```json
{
  "items": [
    {
      "id": "ch1-arrival-v1",
      "size": "landscape",
      "refs": ["design/story/refs/kimorin.jpg"],
      "prompt": "The same character as the reference picture (KIMORIN ...), arriving at a small island floating in space ... Soft Japanese anime illustration. No text."
    }
  ]
}
```

| 項目 | 内容 |
|---|---|
| `id` | ファイル名になる（英数字とハイフン）。`章-場面-版` がおすすめ：`ch1-arrival-v2` |
| `prompt` | 英語がおすすめ。何が・どこで・どんな光・どんな画風か。絵の中に文字を入れたいときは `"…"` で囲んで書く |
| `size` | `portrait`（縦 1152×1536、省略時）／`landscape`（横 1536×1152）／`square`（1536×1536）／`"幅x高さ"` |
| `n` | 1回に何枚（1〜4）。案を見比べたいときに |
| `refs` | **参考画像**（最大10枚、リポジトリ内のパス）。キャラの見た目や画風をそろえたいときに必ず使う |

### キャラをそろえるコツ
- キャラの設定画は `design/story/refs/` に置く（きもりん：`design/story/refs/kimorin.jpg`）。新しいキャラの設定画を作ったら、気に入った出力を `design/story/refs/` にコピーして、次からそれを `refs` に入れる。
- prompt にも「The same character as the reference picture (名前: 見た目の要点)」と書く。
- 同じ場面の続きは、前の出力（`design/story/out/…-1.jpg`）も `refs` に入れると画風と色がそろう。

## 2. push して、できるのを待つ

```bash
git add design/story-queue.json design/story/refs
git commit -m "Story queue: 第1章 到着の場面 v1"
git push -u origin <いまのブランチ>
```

できるまで待つ（バックグラウンドで実行すると、終わったら知らせてくれる）：

```bash
until git fetch -q origin <いまのブランチ> && git log --format=%s HEAD..FETCH_HEAD | grep -q "Story images"; do sleep 20; done; git pull --rebase origin <いまのブランチ>
```

## 3. 見る

- 画像：`design/story/out/<id>-1.jpg`（`n` が2以上なら `-2`, `-3` …）
- 結果のまとめ：`design/story/out/_last-run.md`（✅ 描けた／❌ 失敗の理由／⏭ 次回に回した／費用の目安）
- クライアントに見せるときは、その画像ファイルを送る

## 決まりごと

- 1回の push で描くのは **16枚まで**（超えた分は次の push のときに描かれる）。
- 費用の目安：1枚 約7円（参考画像は2枚目から1枚 約0.5円）。**1日 1,000円を超えそうなときは、先にクライアントに確認**する。
- 子ども向けアプリなので、怖すぎる・暴力的・性的な絵は描かない。
- 画面の中に「AI」という言葉は出さない。
