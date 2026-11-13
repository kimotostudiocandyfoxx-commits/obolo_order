# MV キット

歌1曲から、油絵の止め絵・ゆっくりしたカメラ・立体感・金の歌詞・光の演出で、正方形のミュージックビデオ（MP4）をつくる道具一式。
手順は **[MANUAL.md](MANUAL.md)**（動画化しない版。動画化は完成後に決める任意のステップ12）。

```bash
bash mv-kit/tools/setup.sh                                          # 1回だけ
bash mv-kit/tools/new_project.sh ~/mv-projects/my-song song.mp3     # プロジェクト（公開リポジトリの外に置く）
# … project.json を書き、art/ に絵を置く（MANUAL.md ステップ1〜9）
mv-kit/engine/qa.sh   ~/mv-projects/my-song round1 12,30,60,90        # チェック用の静止画
mv-kit/engine/make.sh ~/mv-projects/my-song                           # MP4 を書き出す
```

プロジェクトフォルダ（曲・歌詞・写真・名前が入る）は共有しない。共有するのはこのキットだけ。
