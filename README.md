# Obolo Order

音でつながる、ひとつの太陽系 — 地球をホームに 8 つの惑星を旅する SNS。
製品仕様は **[docs/spec.md](docs/spec.md)（v1.7.1）が唯一の正**です。

- 仮で作った部分の一覧 → **[docs/placeholders.md](docs/placeholders.md)**
- デプロイ手順（iPad だけで完結） → **[docs/deploy.md](docs/deploy.md)**
- 設計メモ（スケール方針・API 一覧） → **[docs/architecture.md](docs/architecture.md)**

## 10/10 デモの範囲

| 惑星 | 状態 | 内容 |
|---|---|---|
| 🏠 ホーム | ✅ | 中央に地球、上に月、時計回りに 土星→木星→水星→金星→火星→天王星→海王星 |
| 🌍 地球 | ✅ 本当に動く | メール＋コードでログイン、プロフィール編集、MANA 残高・履歴（表示のみ） |
| 🌙 月 | ✅ 本当に動く | バティと Gemini で会話、長期記憶、性格スライダー、1日30通 |
| 🪐 土星 | ✅ 本当に動く | 声を録音して投稿、タップで声を再生、Star |
| 💧 水星 | 🎨 見た目（丁寧） | TikTok 型の発見フィード、星3段階 → 自動プレイリスト、Loops、ブラウザ内で音楽生成 |
| 🟤 木星 / 🟡 金星 / 🔥 火星 / ⭕ 天王星 / 🔵 海王星 | 🎨 見た目 | サンプルデータ |

課金は動かしません（MANA は表示のみ）。

## 2つの動作モード

- **デモモード**：Vercel の環境変数 `NEXT_PUBLIC_API_URL` が空 → API なしで全画面が動く（データは端末内）。画面上部に黄色い帯。
- **本番モード**：`NEXT_PUBLIC_API_URL` に Cloud Run の URL → 本物の DB / Redis / Gemini を使用。

## 開発コマンド（PC がある場合）

```bash
pnpm install
pnpm build:packages        # 共有パッケージをビルド
pnpm test                  # ledger / ai / media / api のテスト
cp apps/api/.env.example apps/api/.env   # Postgres と Redis をローカルで用意
pnpm dev:api               # http://localhost:8080
pnpm dev:web               # http://localhost:3000（apps/web/.env.local に NEXT_PUBLIC_API_URL）
```

DB スキーマを変えたら `pnpm --filter @obolo/api db:generate` でマイグレーション SQL を生成してコミットします（起動時に自動適用）。

## 技術的な決定（仕様 §7.1 で README 記載を求められているもの）

- Mercury の楽曲音源は **Bunny Storage + CDN**（オーディオのみ、Stream より安価）に保存する。
